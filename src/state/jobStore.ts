import { mkdir,realpath } from 'node:fs/promises';
import { join,resolve } from 'node:path';
import { parseJobRequest,parseJobState,type JobRequest,type JobState } from '../domain/job.js';
import { atomicWriteJson,readJson } from './jsonStore.js';
export async function createJob(root:string,request:JobRequest):Promise<string>{
 const r=parseJobRequest(request);const base=resolve(root);await mkdir(base,{recursive:true});const path=join(await realpath(base),r.jobId);
 await mkdir(path);await mkdir(join(path,'assets'));await mkdir(join(path,'receipts'));
 await atomicWriteJson(join(path,'request.json'),r);
 await atomicWriteJson(join(path,'source-hints.json'),{schemaVersion:1,provider:null,capture:null,concept:null});
 await writeJobState(path,{schemaVersion:1,jobId:r.jobId,phase:'selected',lastAcknowledgedEvent:-1,saveAttempt:{status:'not_attempted'},error:null});return path;
}
export async function readJobState(path:string):Promise<JobState>{return parseJobState(await readJson(join(path,'state.json')));}
export async function writeJobState(path:string,state:JobState):Promise<void>{parseJobState(state);const request=parseJobRequest(await readJson(join(path,'request.json')));if(state.jobId!==request.jobId)throw Error('job_identity_mismatch');await atomicWriteJson(join(path,'state.json'),state);}
