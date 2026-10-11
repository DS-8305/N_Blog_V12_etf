import { join } from 'node:path';
import type { Page } from 'playwright';
import { openEditorSession,type OwnedSession,type SessionOptions } from '../browser/session.js';
import { pageTargetId } from '../browser/ownedPage.js';
import { normalizeEndpoint,acquireJobLock } from '../browser/runLock.js';
import { loadBundle } from '../editorial/loadBundle.js';
import { compileDraft,validateBundle } from '../editorial/compileDraft.js';
import { readJobState,writeJobState } from '../state/jobStore.js';
import { atomicWriteJson } from '../state/jsonStore.js';
import type { DraftRunResult,DraftReceipt } from './receipts.js';
import { prepareBlankEditor,firstVisible } from './editorHelpers.js';
import { verifyOwnedSession } from './sessionProbe.js';
import { writePreparedDraft } from './inputController.js';
import { readEditorSnapshot,readDraftCount,confirmDraft,matchesDraftEvidence } from './draftVerifier.js';
import { partialDraft,readInputProgress,writeInputProgress,type InputProgress } from './inputProgress.js';
import { selectors } from './selectors.js';
import type { PreparedDraft } from '../domain/bundle.js';

interface DraftDependencies {
 open:typeof openEditorSession; verify:typeof verifyOwnedSession; prepare:typeof prepareBlankEditor;
 write:typeof writePreparedDraft; snapshot:(page:Page,draft:PreparedDraft)=>ReturnType<typeof readEditorSnapshot>;
 count:typeof readDraftCount; save:(page:Page)=>Promise<void>; confirm:typeof confirmDraft;
 targetId:typeof pageTargetId;
}
const defaults:DraftDependencies={
 open:openEditorSession,verify:verifyOwnedSession,prepare:prepareBlankEditor,write:writePreparedDraft,
 snapshot:readEditorSnapshot,count:readDraftCount,targetId:pageTargetId,
 save:async page=>{await (await firstVisible(page,selectors.draftSave,5000)).click({timeout:5000});},confirm:confirmDraft
};
export async function runDraft(jobPath:string,options:Omit<SessionOptions,'jobId'>,dependencies:Partial<DraftDependencies>={}):Promise<DraftRunResult>{
 let release:()=>Promise<void>;
 try{release=await acquireJobLock(jobPath);}catch(error){const code=(error as Error).message;return {status:'needs_user',code,message:code};}
 try{return await runDraftLocked(jobPath,options,dependencies);}finally{await release();}
}
async function runDraftLocked(jobPath:string,options:Omit<SessionOptions,'jobId'>,dependencies:Partial<DraftDependencies>):Promise<DraftRunResult>{
 const deps={...defaults,...dependencies},bundle=await loadBundle(jobPath),report=await validateBundle(jobPath,bundle);
 let state=await readJobState(jobPath);
 const fail=async(status:'needs_user'|'failed'|'draft_unconfirmed',code:string):Promise<DraftRunResult>=>{
  const resumePhase=state.phase;state={...state,phase:status,error:{code,message:code,resumePhase}};
  await writeJobState(jobPath,state);return {status,code,message:code};
 };
 if(report.errors.length)return fail('failed','validation_failed:'+report.errors.map(e=>e.code).join(','));
 const draft=compileDraft(jobPath,bundle,report);
 if(state.saveAttempt.status==='confirmed'){
  const receipt=state.saveAttempt.receipt as DraftReceipt;
  if(receipt.jobId!==draft.jobId||receipt.fingerprint!==draft.fingerprint||receipt.title!==draft.title)return fail('needs_user','confirmed_fingerprint_changed');
  state={...state,phase:'draft_saved',error:null};await writeJobState(jobPath,state);return {status:'draft_saved',receipt};
 }
 if(state.saveAttempt.status==='attempted_unconfirmed'&&state.saveAttempt.fingerprint!==draft.fingerprint)return fail('draft_unconfirmed','fingerprint_changed');
 let progress:InputProgress|undefined;
 if(state.saveAttempt.status==='attempted_unconfirmed'){
  try{progress=await readInputProgress(jobPath,draft,options);}catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')return fail('draft_unconfirmed',(error as Error).message);}
 }
 if(state.saveAttempt.status==='not_attempted'){
  try{if(state.lastAcknowledgedEvent>=0)progress=await readInputProgress(jobPath,draft,options);}
  catch(error){return fail('needs_user',(error as Error).message);}
 }
 let session:OwnedSession|undefined;
 try{
  session=await deps.open({...options,jobId:draft.jobId,...(progress?{editorTargetId:progress.editorTargetId}:{})});
  const refreshed=await readJobState(jobPath);
  if(JSON.stringify(refreshed)!==JSON.stringify(state)){
   const receipt=refreshed.saveAttempt.receipt as DraftReceipt|undefined;
   if(refreshed.saveAttempt.status==='confirmed'&&receipt?.jobId===draft.jobId&&receipt.fingerprint===draft.fingerprint&&receipt.title===draft.title)return {status:'draft_saved',receipt};
   return {status:refreshed.saveAttempt.status==='attempted_unconfirmed'?'draft_unconfirmed':'needs_user',code:'job_changed_during_open',message:'job_changed_during_open'};
  }
  const auth=await deps.verify(session);if(auth!=='authenticated')return await fail('needs_user',auth);
  if(state.saveAttempt.status==='not_attempted'){
   let beforeCount:number,editorTargetId:string;
   if(progress){
    const prefix=partialDraft(draft,progress.index),current=await deps.snapshot(session.editorPage,prefix);
    if(progress.index<state.lastAcknowledgedEvent||!matchesDraftEvidence(prefix,{...progress.snapshot,beforeCount:progress.beforeCount,receipts:progress.receipts},current))return await fail('needs_user','partial_input_changed');
    state.lastAcknowledgedEvent=progress.index;beforeCount=progress.beforeCount;editorTargetId=progress.editorTargetId;
   }else{
    await deps.prepare(session.editorPage);const count=await deps.count(session.editorPage);
    if(count===null)return await fail('needs_user','draft_list_unsupported');
    beforeCount=count;editorTargetId=await deps.targetId(session.editorPage);
   }
   state.phase='inserting';state.error=null;await writeJobState(jobPath,state);
   const receipts=await deps.write(session,draft,async(index,ackReceipts)=>{
    const prefix=partialDraft(draft,index),snapshot=await deps.snapshot(session!.editorPage,prefix),recorded=ackReceipts??[];
    if(!matchesDraftEvidence(prefix,{...snapshot,beforeCount,receipts:recorded},snapshot))throw Error('partial_content_unconfirmed');
    await writeInputProgress(jobPath,{schemaVersion:1,jobId:draft.jobId,fingerprint:draft.fingerprint,editorTargetId,cdpEndpoint:normalizeEndpoint(options.cdpEndpoint),profilePath:options.profilePath,index,beforeCount,snapshot,receipts:recorded});
    state.lastAcknowledgedEvent=index;await writeJobState(jobPath,state);
   },{startIndex:progress?progress.index+1:0,receipts:progress?.receipts??[]});
   const snapshot=await deps.snapshot(session.editorPage,draft),proof={...snapshot,beforeCount,receipts};
   if(!matchesDraftEvidence(draft,proof,snapshot))return await fail('failed','input_content_unconfirmed');
   const saveAuth=await deps.verify(session);if(saveAuth!=='authenticated')return await fail('needs_user',saveAuth);
   const finalReport=await validateBundle(jobPath,await loadBundle(jobPath));
   if(finalReport.errors.length||finalReport.fingerprint!==draft.fingerprint)return await fail('needs_user','bundle_changed_before_save');
   await atomicWriteJson(join(jobPath,'input-proof.json'),proof);
   state.saveAttempt={status:'attempted_unconfirmed',startedAt:new Date().toISOString(),fingerprint:draft.fingerprint};await writeJobState(jobPath,state);
   try{await deps.save(session.editorPage);}catch{return await fail('draft_unconfirmed','save_dispatch_unconfirmed');}
  }
  const receipt=await deps.confirm(session,draft);
  if(!receipt)return await fail('draft_unconfirmed','draft_content_unconfirmed');
  if(receipt.jobId!==draft.jobId||receipt.fingerprint!==draft.fingerprint)return await fail('draft_unconfirmed','wrong_receipt');
  state={...state,phase:'draft_saved',saveAttempt:{...state.saveAttempt,status:'confirmed',receipt},error:null};
  await writeJobState(jobPath,state);return {status:'draft_saved',receipt};
 }catch(error){
  const code=error instanceof Error?error.message:String(error);
  return await fail(state.saveAttempt.status==='attempted_unconfirmed'?'draft_unconfirmed':/needs_user|session_locked|cdp|browserType.connectOverCDP|ECONNREFUSED/.test(code)?'needs_user':'failed',code);
 }finally{await session?.release();}
}
