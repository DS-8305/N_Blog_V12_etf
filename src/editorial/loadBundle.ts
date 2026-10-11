import { join } from 'node:path';
import { readJson } from '../state/jsonStore.js';
import { parseJobRequest,type JobRequest } from '../domain/job.js';
import { parseFacts,type FactDocument } from '../domain/etf.js';
import { manifestSchema,postSchema,type AssetManifest,type PostDocument } from '../domain/bundle.js';
export interface Bundle {request:JobRequest;facts:FactDocument;manifest:AssetManifest;post:PostDocument}
export async function loadBundle(job:string):Promise<Bundle>{
 return {request:parseJobRequest(await readJson(join(job,'request.json'))),facts:parseFacts(await readJson(join(job,'facts.json'))),manifest:manifestSchema.parse(await readJson(join(job,'assets.json'))),post:postSchema.parse(await readJson(join(job,'post.json')))};
}
