import { join } from 'node:path';
import { acquireJobLock } from '../browser/runLock.js';import { openCollectionSession,type SessionOptions,type OwnedCollectionSession } from '../browser/session.js';
import { readJobState,writeJobState } from '../state/jobStore.js';import { atomicWriteJson } from '../state/jsonStore.js';
import { checkCollection } from '../collectors/checkCollection.js';import { renderDataCards } from './cards.js';import { captureOverview } from '../capture/captureAsset.js';import { generateConcept } from './conceptImage.js';
import { createPost } from '../editorial/postValidation.js';import { validateAssets } from '../editorial/assetValidation.js';import type { CapturedAsset } from '../domain/bundle.js';
import type { JobState } from '../domain/job.js';
export async function renderJob(job:string,options?:Omit<SessionOptions,'jobId'>,cardsOnly=false):Promise<void>{
 const release=await acquireJobLock(job);let state:JobState|undefined,session:OwnedCollectionSession|undefined;
 try{
  state=await readJobState(job);
  if(state.saveAttempt.status!=='not_attempted'||state.lastAcknowledgedEvent>=0)throw Error('needs_user:draft_started_render_locked');
  const {request,facts,hints,report}=await checkCollection(job);if(report.errors.length)throw Error('needs_user:'+report.errors.map(e=>e.code).join(','));
  const cards=await renderDataCards(job,facts,request.asOfDate);await atomicWriteJson(join(job,'assets.partial.json'),{schemaVersion:1,jobId:request.jobId,assets:cards});
  if(cardsOnly)return;
  if(!hints.capture)throw Error('needs_user:official_capture_configuration_required');
  if(!options)throw Error('needs_user:cdp_profile_required');
  session=await openCollectionSession({...options,jobId:request.jobId});
  const overview=await captureOverview(job,await session.newPage(),facts,hints.capture);
  await atomicWriteJson(join(job,'assets.partial.json'),{schemaVersion:1,jobId:request.jobId,assets:[overview,...cards]});
  const concept=await generateConcept(job,facts,hints.concept),assets:CapturedAsset[]=[overview,...cards,concept],manifest={schemaVersion:1 as const,jobId:request.jobId,assets};
  const errors=await validateAssets(job,manifest,facts);if(errors.length)throw Error('validation_failed:'+errors.map(e=>e.code).join(','));
  await atomicWriteJson(join(job,'assets.json'),manifest);await atomicWriteJson(join(job,'post.json'),createPost(facts));
  await writeJobState(job,{...state,phase:'validated',error:null});
 }catch(e){const code=e instanceof Error?e.message:String(e);if(state)await writeJobState(job,{...state,phase:code.startsWith('needs_user:')?'needs_user':'failed',error:{code,message:code,resumePhase:state.phase}});throw e;}
 finally{try{await session?.release();}finally{await release();}}
}
