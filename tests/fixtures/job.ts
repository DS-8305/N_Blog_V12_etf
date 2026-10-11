import { mkdtemp,mkdir,writeFile } from 'node:fs/promises';import { join } from 'node:path';import { tmpdir } from 'node:os';import sharp from 'sharp';
import { createJob } from '../../src/state/jobStore.js';import { parseJobRequest } from '../../src/domain/job.js';import { atomicWriteJson } from '../../src/state/jsonStore.js';import { collectJob } from '../../src/collectors/collectJob.js';import { renderDataCards } from '../../src/render/cards.js';import { createPost } from '../../src/editorial/postValidation.js';import { sha256,fingerprint } from '../../src/editorial/fingerprint.js';import { fundFixture } from './fund.js';
export async function preparedJob(){
 const root=await mkdtemp(join(tmpdir(),'v12-draft-')),facts=fundFixture();
 const job=await createJob(root,parseJobRequest({schemaVersion:1,jobId:facts.jobId,symbol:'EXAM',market:'NASDAQ',asOfDate:'2026-10-10'}));
 await atomicWriteJson(join(job,'source-hints.json'),{schemaVersion:1,provider:{kind:'reviewed_json',path:'incoming.json',approved:true,licenseNote:'Fictional test'},capture:null,concept:null});await atomicWriteJson(join(job,'incoming.json'),facts);await collectJob(job);
 const cards=await renderDataCards(job,facts,'2026-10-10'),bytes=await sharp({create:{width:1200,height:1200,channels:4,background:'#abcdef'}}).png().toBuffer(),now='2026-10-10T01:00:00Z';
 const asset=(role:any,assetKind:any,sourceUrl:string,caption:string,factIds:string[])=>({assetId:role,role,assetKind,sourceUrl,caption,factIds,relativePath:'assets/'+role+'.png',sha256:sha256(bytes),width:1200,height:1200,asOf:facts.facts.overview.asOf,capturedAt:now,licenseNote:'Offline fixture only',reviewStatus:'verified',basisFingerprint:fingerprint(facts)});
 for(const role of ['etf_overview','etf_outlook_visual'])await writeFile(join(job,'assets',role+'.png'),bytes);
 const assets=[asset('etf_overview','official_capture',facts.identity.officialProductUrl,'공식 ETF 상품 안내 · 2026-10-09',['identity','overview']),...cards,asset('etf_outlook_visual','ai_concept','https://image.example/generated','AI 생성 콘셉트 이미지 · 실제 ETF 자산이나 운용 사진이 아닙니다.',['overview'])];
 await atomicWriteJson(join(job,'assets.json'),{schemaVersion:1,jobId:facts.jobId,assets});await atomicWriteJson(join(job,'post.json'),createPost(facts));return {root,job,facts,assets};
}
