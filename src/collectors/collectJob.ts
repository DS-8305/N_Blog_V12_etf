import { join } from 'node:path';
import { acquireJobLock } from '../browser/runLock.js';
import { atomicWriteJson,readJson } from '../state/jsonStore.js';
import { readJobState,writeJobState } from '../state/jobStore.js';
import { parseJobRequest } from '../domain/job.js';
import { readHints,loadProvider } from '../providers/registry.js';
import { validateFacts,type FactDocument,type FactKey } from '../domain/etf.js';
export async function collectJob(job:string):Promise<FactDocument>{
 const release=await acquireJobLock(job);let state=await readJobState(job);
 try{
  if(state.saveAttempt.status!=='not_attempted'||state.lastAcknowledgedEvent>=0)throw Error('needs_user:draft_started_collection_locked');
  const request=parseJobRequest(await readJson(join(job,'request.json'))),hints=await readHints(job),provider=await loadProvider(job,request,hints);
  const identity=await provider.resolve(request.symbol,request.market);
  state={...state,phase:'collecting',error:null};await writeJobState(job,state);
  let checkpoint:{fingerprint:string;completed:FactKey[];facts:Partial<FactDocument['facts']>}={fingerprint:provider.sourceFingerprint,completed:[],facts:{}};
  try{const old=await readJson(join(job,'collection-checkpoint.json')) as typeof checkpoint;if(old.fingerprint===checkpoint.fingerprint)checkpoint=old;}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e;}
  const tasks=[['overview',()=>provider.overview(identity)],['aum',()=>provider.aum(identity)],['expenses',()=>provider.expenses(identity)],['quote',()=>provider.exchangeQuote(identity)],['range52w',()=>provider.priceRange52w(identity)],['exposures',()=>provider.holdingsOrExposures(identity)]] as const;
  for(const [key,run] of tasks){
   // Re-read the validated provider document every run; checkpoints are progress evidence, not trusted numeric caches.
   (checkpoint.facts as Record<string,unknown>)[key]=await run();
   if(!checkpoint.completed.includes(key))checkpoint.completed.push(key);
   await atomicWriteJson(join(job,'collection-checkpoint.json'),checkpoint);
  }
  const document={...provider.document,identity,facts:{...provider.document.facts,...checkpoint.facts}};
  const errors=validateFacts(document,request);if(errors.length)throw Error('needs_user:'+errors.map(e=>e.code).join(','));
  await atomicWriteJson(join(job,'facts.json'),document);
  await atomicWriteJson(join(job,'receipts','source-review.json'),{schemaVersion:1,jobId:request.jobId,sourceFingerprint:provider.sourceFingerprint,collectedAt:new Date().toISOString(),provider:hints.provider?.kind,licenseNote:hints.provider?.licenseNote});
  await writeJobState(job,{...state,phase:'collected'});return document;
 }catch(e){const code=e instanceof Error?e.message:String(e);await writeJobState(job,{...state,phase:'needs_user',error:{code,message:code,resumePhase:state.phase}});throw e;}
 finally{await release();}
}
