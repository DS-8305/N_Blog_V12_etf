import { readFile,writeFile } from 'node:fs/promises';import { join } from 'node:path';import sharp from 'sharp';import { z } from 'zod';
import type { FactDocument } from '../domain/etf.js';import type { CapturedAsset } from '../domain/bundle.js';import type { SourceHints } from '../providers/registry.js';
import { fetchPermittedJson } from '../providers/registry.js';import { safeJobFile } from '../state/paths.js';import { fingerprint,sha256 } from '../editorial/fingerprint.js';import { url } from '../domain/validation.js';
export function conceptPrompt(f:FactDocument):string{return 'Photorealistic editorial concept of '+f.facts.overview.value.theme+'. Square image. No text, logos, financial numbers, bullish graphs, endorsements or claims of real fund operations. This is an AI-generated concept.';}
export async function generateConcept(job:string,f:FactDocument,config:SourceHints['concept']):Promise<CapturedAsset>{
 if(!config)throw Error('needs_user:concept_image_required');let bytes:Buffer,sourceUrl:string;
 if(config.kind==='reviewed_file'){bytes=await readFile(await safeJobFile(job,config.path));if(sha256(bytes)!==config.sha256)throw Error('needs_user:concept_hash_mismatch');sourceUrl=config.sourceUrl;}
 else{const raw=await fetchPermittedJson(config.url,config.authEnv,{prompt:conceptPrompt(f),model:config.model,width:1200,height:1200});const r=z.object({imageBase64:z.string().min(1),sourceUrl:url,aiGenerated:z.literal(true)}).strict().parse(raw);bytes=Buffer.from(r.imageBase64,'base64');sourceUrl=r.sourceUrl;}
 const m=await sharp(bytes).metadata();if(m.width!==1200||m.height!==1200||m.format!=='png')throw Error('needs_user:concept_1200_png_required');
 await writeFile(join(job,'assets','etf_outlook_visual.png'),bytes);const now=new Date().toISOString();
 return {assetId:'etf_outlook_visual',role:'etf_outlook_visual',assetKind:'ai_concept',relativePath:'assets/etf_outlook_visual.png',sourceUrl,asOf:f.facts.overview.asOf,capturedAt:now,generatedAt:now,sha256:sha256(bytes),width:1200,height:1200,factIds:[f.facts.overview.factId],caption:'AI 생성 콘셉트 이미지 · 실제 ETF 자산이나 운용 사진이 아닙니다.',licenseNote:config.licenseNote+' · model: '+config.model,reviewStatus:'verified',basisFingerprint:fingerprint(f)};
}
