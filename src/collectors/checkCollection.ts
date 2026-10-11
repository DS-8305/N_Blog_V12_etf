import { join } from 'node:path';import { readJson } from '../state/jsonStore.js';import { parseJobRequest } from '../domain/job.js';import { parseFacts,validateFacts } from '../domain/etf.js';import { readHints,loadProvider } from '../providers/registry.js';import { fingerprint } from '../editorial/fingerprint.js';import type { ValidationReport } from '../domain/validation.js';
export async function checkCollection(job:string){
 const request=parseJobRequest(await readJson(join(job,'request.json'))),facts=parseFacts(await readJson(join(job,'facts.json'))),hints=await readHints(job);
 const errors=validateFacts(facts,request),warnings:ValidationReport['warnings']=[];
 try{
  const r=await readJson(join(job,'receipts','source-review.json')) as Record<string,unknown>;
  if(r.factsFingerprint!==fingerprint(facts)||r.hintsFingerprint!==fingerprint(hints)||r.requestFingerprint!==fingerprint(request)||facts.jobId!==request.jobId)throw Error('source_review_changed');
  if(hints.provider?.kind==='reviewed_json'&&(await loadProvider(job,request,hints)).sourceFingerprint!==r.sourceFingerprint)throw Error('source_review_changed');
 }catch{errors.push({code:'source_review_changed',path:'source-review',message:'Sources or facts changed; run collect:run before using this data.'});}
 const age=Math.round((+new Date(request.asOfDate)-+new Date(facts.facts.exposures.asOf))/86400000);
 if(age>31)warnings.push({code:'holdings_older_than_31_days',path:'exposures',message:'Holdings are '+age+' days old; retain their independent date.'});
 return {request,facts,hints,report:{errors,warnings,fingerprint:fingerprint({request,facts,hints})}};
}
