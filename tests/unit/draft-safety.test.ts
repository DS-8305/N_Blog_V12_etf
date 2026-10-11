import { it,expect,afterEach,vi } from 'vitest';import { rm } from 'node:fs/promises';
import { runDraft } from '../../src/automation/draftRunner.js';import { readJobState } from '../../src/state/jobStore.js';import { preparedJob } from '../fixtures/job.js';import type { PreparedDraft } from '../../src/domain/bundle.js';import type { OwnedSession } from '../../src/browser/session.js';import type { DraftReceipt } from '../../src/domain/receipt.js';
const roots:string[]=[];afterEach(async()=>{for(const r of roots.splice(0))await rm(r,{recursive:true,force:true});});
const options={cdpEndpoint:'http://127.0.0.1:9222',profilePath:'C:\\fixture-profile'};
function dependencies(){
 let clicks=0,writes=0;let saved:PreparedDraft|undefined;
 const receipt=(d:PreparedDraft):DraftReceipt=>({jobId:d.jobId,fingerprint:d.fingerprint,title:d.title,bodyText:d.expected.bodyText,confirmedAt:new Date().toISOString(),imageAssetIds:d.expected.imageAssetIds,captions:d.expected.captions,sources:d.expected.sources,identity:{listText:d.title,reopenedUrl:'https://blog.naver.com/PostWriteForm.naver'}});
 const deps={
  open:async()=>({editorPage:{},release:async()=>{}} as unknown as OwnedSession),
  verify:async()=> 'authenticated' as const,prepare:async()=>{},count:async()=>0,targetId:async()=> 'owned-1',
  write:async(_s:OwnedSession,d:PreparedDraft)=>{writes++;saved=d;return d.assets.map((a,index)=>({assetId:a.assetId,blockKey:'image-'+index,index,confirmedAt:new Date().toISOString()}));},
  snapshot:async(_p:unknown,d:PreparedDraft)=>({title:d.title,bodyText:d.expected.bodyText,images:d.assets.map((a,index)=>({key:'image-'+index,src:'https://postfiles.pstatic.net/'+a.assetId+'.png',loaded:true,width:a.width,height:a.height}))}),
  save:async():Promise<void>=>{clicks++;throw Error('502');},confirm:async(_s:OwnedSession,d:PreparedDraft)=>null as DraftReceipt|null
 };
 return {deps,receipt,get clicks(){return clicks;},get writes(){return writes;}};
}
it('persists an uncertain save before dispatch and never saves again on resume',async()=>{
 const p=await preparedJob();roots.push(p.root);const d=dependencies();
 const result=await runDraft(p.job,options,d.deps);expect(result.status).toBe('draft_unconfirmed');expect((await readJobState(p.job)).saveAttempt.status).toBe('attempted_unconfirmed');expect(d.clicks).toBe(1);
 await runDraft(p.job,options,d.deps);expect(d.clicks).toBe(1);expect(d.writes).toBe(1);
});
it('accepts only a reopened receipt and makes confirmed reruns idempotent',async()=>{
 const p=await preparedJob();roots.push(p.root);const d=dependencies();d.deps.save=async()=>{};d.deps.confirm=async(_s,draft)=>d.receipt(draft);
 expect((await runDraft(p.job,options,d.deps)).status).toBe('draft_saved');
 await runDraft(p.job,options,d.deps);expect(d.writes).toBe(1);expect((await readJobState(p.job)).phase).toBe('draft_saved');
});
it('blocks existing text/recovery dialogs without dispatching input',async()=>{
 const p=await preparedJob();roots.push(p.root);const d=dependencies();d.deps.prepare=async()=>{throw Error('needs_user:existing_draft');};
 expect((await runDraft(p.job,options,d.deps)).status).toBe('needs_user');expect(d.writes).toBe(0);expect(d.clicks).toBe(0);
});
