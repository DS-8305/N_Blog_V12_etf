import { join } from 'node:path';
import type { Bundle } from './loadBundle.js';
import { validateFacts } from '../domain/etf.js';
import { validateAssets } from './assetValidation.js';import { validatePost } from './postValidation.js';
import { fingerprint } from './fingerprint.js';import type { ValidationReport } from '../domain/validation.js';import type { PreparedDraft,EditorEvent } from '../domain/bundle.js';
import { readJson } from '../state/jsonStore.js';import { readHints,loadProvider } from '../providers/registry.js';
export async function validateBundle(job:string,b:Bundle):Promise<ValidationReport>{
 const p=validatePost(b.post,b.facts,b.request.conditions.articleLength),errors=[...validateFacts(b.facts,b.request),...await validateAssets(job,b.manifest,b.facts),...p.errors];
 if(b.request.jobId!==b.facts.jobId||b.request.jobId!==b.manifest.jobId||b.request.jobId!==b.post.jobId)errors.push({code:'job_identity_mismatch',path:'job',message:'job_identity_mismatch'});
 try{
  const r=await readJson(join(job,'receipts','source-review.json')) as Record<string,unknown>,hints=await readHints(job);
  if(r.factsFingerprint!==fingerprint(b.facts)||r.hintsFingerprint!==fingerprint(hints)||r.requestFingerprint!==fingerprint(b.request))throw Error('source_review_changed');
  if(hints.provider?.kind==='reviewed_json'&&(await loadProvider(job,b.request,hints)).sourceFingerprint!==r.sourceFingerprint)throw Error('source_review_changed');
 }catch(e){errors.push({code:'source_review_changed',path:'receipts/source-review.json',message:'Source or review changed; recollect in a fresh job if draft input has begun.'});}
 return {errors,warnings:p.warnings,fingerprint:fingerprint(b)};
}
export function compileDraft(job:string,b:Bundle,report:ValidationReport):PreparedDraft{
 if(report.errors.length)throw Error('validation_failed');
 const events:EditorEvent[]=[{type:'setTitle',text:b.post.selectedTitle}],captions:string[]=[],sources:string[]=[];
 for(const section of b.post.sections){
  events.push({type:'typeBold',text:section.heading},{type:'typeText',text:section.text});
  const asset=b.manifest.assets.find(a=>a.role===section.role)!;
  events.push({type:'insertImage',relativePath:asset.relativePath,absolutePath:join(job,asset.relativePath),assetId:asset.assetId},{type:'typeText',text:asset.caption});captions.push(asset.caption);
 }
 const all=[b.facts.identityEvidence,...Object.values(b.facts.facts)];
 for(const e of all){const text='출처: '+e.sourceName+' · '+e.definition+' · 기준일 '+e.asOf+' '+e.sourceUrl;events.push({type:'typeText',text});sources.push(e.sourceUrl);}
 return {jobId:b.request.jobId,jobPath:job,title:b.post.selectedTitle,fingerprint:report.fingerprint,events,assets:b.manifest.assets,expected:{bodyText:events.filter(e=>e.type!=='setTitle'&&e.type!=='insertImage').map(e=>'text'in e?e.text:'').join('\n'),imageAssetIds:b.manifest.assets.map(a=>a.assetId),captions,sources}};
}
