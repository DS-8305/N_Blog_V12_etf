import { readFile } from 'node:fs/promises';import sharp from 'sharp';
import { manifestSchema,requiredRoles,type AssetManifest } from '../domain/bundle.js';import type { FactDocument } from '../domain/etf.js';import type { ValidationIssue } from '../domain/validation.js';import { safeJobFile } from '../state/paths.js';import { sha256,fingerprint } from './fingerprint.js';
export async function validateAssets(job:string,m:AssetManifest,d:FactDocument):Promise<ValidationIssue[]>{
 const errors:ValidationIssue[]=[];const add=(code:string,path='assets')=>errors.push({code,path,message:code});
 if(!manifestSchema.safeParse(m).success){add('invalid_asset_schema');return errors;}
 if(m.jobId!==d.jobId||m.assets.length!==5||m.assets.some((a,i)=>a.role!==requiredRoles[i])||new Set(m.assets.map(a=>a.assetId)).size!==5)add('asset_role_order');
 const ids=new Set([d.identityEvidence,...Object.values(d.facts)].map(f=>f.factId));
 for(const a of m.assets){
  if(a.basisFingerprint!==fingerprint(d)||a.factIds.some(id=>!ids.has(id)))add('asset_facts_mismatch',a.role);
  const expectedKind=a.role==='etf_overview'?'official_capture':a.role==='etf_outlook_visual'?'ai_concept':'data_card';if(a.assetKind!==expectedKind)add('asset_kind_mismatch',a.role);
  if(a.role==='etf_overview'&&a.sourceUrl!==d.identity.officialProductUrl)add('official_product_required');
  if(a.role==='etf_outlook_visual'&&!a.caption.includes('AI 생성 콘셉트 이미지'))add('ai_disclosure_required');
  const expectedKeys=a.role==='etf_overview'?['identity','overview']:a.role==='aum_fee_card'?['aum','expenses']:a.role==='etf_price_52w_card'?['quote','range52w']:a.role==='holdings_sectors_card'?['exposures']:['overview'];
  const facts=expectedKeys.map(k=>k==='identity'?d.identityEvidence:(d.facts as any)[k]);if(fingerprint(a.factIds)!==fingerprint(facts.map(f=>f.factId)))add('asset_fact_binding',a.role);
  const asOf=a.role==='etf_overview'?d.facts.overview.asOf:facts[0].asOf;if(a.asOf!==asOf)add('asset_asof_mismatch',a.role);
  if(expectedKind==='data_card'&&a.sourceUrl!==facts[0].sourceUrl)add('asset_source_mismatch',a.role);
  try{
   const bytes=await readFile(await safeJobFile(job,a.relativePath));if(sha256(bytes)!==a.sha256){add('asset_hash_mismatch',a.role);continue;}
   const meta=await sharp(bytes).metadata();if(meta.format!=='png'||meta.width!==a.width||meta.height!==a.height)add('asset_dimensions_mismatch',a.role);
   if(a.role!=='etf_overview'&&(a.width!==1200||a.height!==1200))add('asset_square_required',a.role);
  }catch(e){add((e as Error).message==='outside_job'?'outside_job':'asset_file_invalid',a.role);}
 }
 return errors;
}
