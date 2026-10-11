import { z } from 'zod';
import { join } from 'node:path';
import { readFile } from 'node:fs/promises';
import { readJson } from '../state/jsonStore.js';
import { safeJobFile } from '../state/paths.js';
import { url,nonempty } from '../domain/validation.js';
import { parseFacts,validateFacts,type FactDocument,type EtfIdentity } from '../domain/etf.js';
import type { JobRequest } from '../domain/job.js';
import { fingerprint,sha256 } from '../editorial/fingerprint.js';
import type { EtfProvider } from './types.js';
const reviewed={approved:z.literal(true),licenseNote:nonempty};
const provider=z.discriminatedUnion('kind',[
 z.object({kind:z.literal('reviewed_json'),path:nonempty,...reviewed}).strict(),
 z.object({kind:z.literal('https_json'),url:url,authEnv:nonempty.optional(),...reviewed}).strict()
]);
export const hintsSchema=z.object({
 schemaVersion:z.literal(1),provider:provider.nullable(),
 capture:z.object({regionSelector:nonempty,allowCapture:z.literal(true),licenseNote:nonempty}).strict().nullable(),
 concept:z.discriminatedUnion('kind',[
  z.object({kind:z.literal('reviewed_file'),path:nonempty,sha256:z.string().regex(/^[a-f0-9]{64}$/),sourceUrl:url,model:nonempty,licenseNote:nonempty,reviewed:z.literal(true),aiGenerated:z.literal(true)}).strict(),
  z.object({kind:z.literal('http'),url:url,authEnv:nonempty.optional(),model:nonempty,licenseNote:nonempty,approved:z.literal(true)}).strict()
 ]).nullable()
}).strict();
export type SourceHints=z.infer<typeof hintsSchema>;
export async function readHints(job:string):Promise<SourceHints>{return hintsSchema.parse(await readJson(join(job,'source-hints.json')));}
export async function fetchPermittedJson(endpoint:string,authEnv?:string,body?:unknown):Promise<unknown>{
 url.parse(endpoint);const token=authEnv?process.env[authEnv]:undefined;
 if(authEnv&&!token)throw Error('needs_user:provider_key_required');
 const response=await fetch(endpoint,{redirect:'error',signal:AbortSignal.timeout(30000),method:body===undefined?'GET':'POST',headers:{'accept':'application/json',...(body!==undefined?{'content-type':'application/json'}:{}),...(token?{'authorization':'Bearer '+token}:{})},...(body!==undefined?{body:JSON.stringify(body)}:{})});
 if(!response.ok)throw Error('needs_user:provider_http_'+response.status);
 if(!response.headers.get('content-type')?.includes('json'))throw Error('needs_user:provider_json_required');
 const text=await response.text();if(text.length>5_000_000)throw Error('provider_response_too_large');return JSON.parse(text);
}
class DocumentProvider implements EtfProvider {
 constructor(public document:FactDocument,public sourceFingerprint:string){}
 async resolve(symbol:string,market:string){const i=this.document.identity;if(i.symbol!==symbol||i.market!==market)throw Error('needs_user:fund_identity_ambiguous');return i;}
 private assert(id:EtfIdentity){if(fingerprint(id)!==fingerprint(this.document.identity))throw Error('needs_user:fund_identity_ambiguous');}
 async overview(id:EtfIdentity){this.assert(id);return this.document.facts.overview;}
 async aum(id:EtfIdentity){this.assert(id);return this.document.facts.aum;}
 async expenses(id:EtfIdentity){this.assert(id);return this.document.facts.expenses;}
 async exchangeQuote(id:EtfIdentity){this.assert(id);return this.document.facts.quote;}
 async priceRange52w(id:EtfIdentity){this.assert(id);return this.document.facts.range52w;}
 async holdingsOrExposures(id:EtfIdentity){this.assert(id);return this.document.facts.exposures;}
}
export async function loadProvider(job:string,request:JobRequest,hints:SourceHints):Promise<EtfProvider>{
 const c=hints.provider;if(!c)throw Error('needs_user:provider_required');
 const raw=c.kind==='reviewed_json'?JSON.parse((await readFile(await safeJobFile(job,c.path),'utf8')).replace(/^\uFEFF/,'')):await fetchPermittedJson(c.url,c.authEnv);
 const errors=validateFacts(raw,request);
 if(errors.length)throw Error('needs_user:'+errors.map(e=>e.code).join(','));
 const document=parseFacts(raw);if(document.jobId!==request.jobId)throw Error('needs_user:dataset_job_mismatch');
 return new DocumentProvider(document,fingerprint({request,hints,rawHash:sha256(Buffer.from(JSON.stringify(raw)))}));
}
