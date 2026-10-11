import { it,expect,afterEach } from 'vitest';
import { mkdtemp,rm,readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';import { join } from 'node:path';
import { createJob } from '../../src/state/jobStore.js';
import { parseJobRequest } from '../../src/domain/job.js';
import { atomicWriteJson,readJson } from '../../src/state/jsonStore.js';
import { collectJob } from '../../src/collectors/collectJob.js';
import { safeJobFile } from '../../src/state/paths.js';
import { assertRegionReady } from '../../src/capture/readiness.js';
import { fundFixture } from '../fixtures/fund.js';
const roots:string[]=[];afterEach(async()=>{for(const r of roots.splice(0))await rm(r,{recursive:true,force:true});});
async function job(){const root=await mkdtemp(join(tmpdir(),'v12-'));roots.push(root);return createJob(root,parseJobRequest({schemaVersion:1,jobId:'etf-example',symbol:'EXAM',market:'NASDAQ',asOfDate:'2026-10-10'}));}
const hints={schemaVersion:1,provider:{kind:'reviewed_json',path:'incoming.json',approved:true,licenseNote:'Fictional offline test'},capture:null,concept:null};
it('stops when no data provider is configured',async()=>{const path=await job();await expect(collectJob(path)).rejects.toThrow('needs_user:provider_required');});
it('collects exact sources and invalidates changed input',async()=>{
 const path=await job();await atomicWriteJson(join(path,'source-hints.json'),hints);await atomicWriteJson(join(path,'incoming.json'),fundFixture());
 await collectJob(path);const first=await readJson(join(path,'facts.json')) as any;expect(first.facts.exposures.asOf).toBe('2026-08-31');
 const changed=fundFixture();changed.facts.aum.value.amount=2500000000;await atomicWriteJson(join(path,'incoming.json'),changed);await collectJob(path);
 expect((await readJson(join(path,'facts.json')) as any).facts.aum.value.amount).toBe(2500000000);
 expect((await readJson(join(path,'collection-checkpoint.json')) as any).completed).toEqual(['overview','aum','expenses','quote','range52w','exposures']);
});
it('never reuses a dataset from another ETF',async()=>{const path=await job();const wrong=fundFixture();wrong.identity.symbol='OTHER';await atomicWriteJson(join(path,'incoming.json'),wrong);await atomicWriteJson(join(path,'source-hints.json'),hints);await expect(collectJob(path)).rejects.toThrow('fund_identity_ambiguous');});
it('rejects paths outside a job and absolute imports',async()=>{const path=await job();await expect(safeJobFile(path,'../secret')).rejects.toThrow('outside_job');await expect(safeJobFile(path,'C:\\secret.png')).rejects.toThrow('outside_job');});
it('rejects company pages and occluded screenshots',()=>{
 const state={visible:true,unloadedImages:0,occluded:false,clipped:false,text:'Example Asset Management',width:900,height:500};
 expect(()=>assertRegionReady(state,['Example Global Equity ETF'])).toThrow('required_label_missing');
 expect(()=>assertRegionReady({...state,occluded:true},[])).toThrow('region_occluded');
});
