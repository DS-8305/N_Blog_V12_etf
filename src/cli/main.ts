import { randomUUID } from 'node:crypto';import { join,resolve } from 'node:path';import { pathToFileURL } from 'node:url';
import { parseArguments,required } from './arguments.js';import { parseJobRequest } from '../domain/job.js';
import { createJob } from '../state/jobStore.js';import { atomicWriteJson } from '../state/jsonStore.js';import { readHints } from '../providers/registry.js';
import { collectJob } from '../collectors/collectJob.js';import { checkCollection } from '../collectors/checkCollection.js';import { renderJob } from '../render/renderJob.js';import { createPost } from '../editorial/postValidation.js';
import { loadBundle } from '../editorial/loadBundle.js';import { validateBundle } from '../editorial/compileDraft.js';import { runDraft } from '../automation/draftRunner.js';
export async function runCli(argv:string[],out:(text:string)=>void=console.log):Promise<number>{
 const emit=(v:unknown)=>out(JSON.stringify(v,null,2));
 try{
  const {command,flags}=parseArguments(argv);
  if(command==='help'){out('ETF → verified sources → five images → Naver draft only\n'+['job:init --symbol CODE --market MARKET [--as-of YYYY-MM-DD] [--workspace-root PATH]','source:inspect --job PATH','collect:run --job PATH','collect:check --job PATH','render:cards --job PATH','render:run --job PATH --cdp http://127.0.0.1:9222 --profile PATH','post:compile --job PATH','draft:check --job PATH','draft:run --job PATH --cdp URL --profile PATH','draft:resume --job PATH --cdp URL --profile PATH'].join('\n')+'\nExit: 0 success, 2 invalid, 3 needs_user, 4 draft_unconfirmed');return 0;}
  if(command==='job:init'){
   const request=parseJobRequest({schemaVersion:1,jobId:'etf-'+randomUUID(),symbol:required(flags,'symbol'),market:required(flags,'market'),asOfDate:flags['as-of']??new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date()),...(flags.issuer?{issuer:flags.issuer}:{}),...(flags.isin?{isin:flags.isin}:{}),conditions:{articleLength:{min:Number(flags['min-length']??800),max:Number(flags['max-length']??1000)}}});
   emit({status:'selected',job:await createJob(flags['workspace-root']??resolve('workspaces'),request)});return 0;
  }
  const job=resolve(required(flags,'job'));
  if(command==='source:inspect'){const hints=await readHints(job);emit({status:hints.provider?'configured':'needs_user',hints,required:['verified ETF identity','independent dated official AUM/fees/holdings','licensed or exchange 52-week market quotes','permitted product capture region','AI image provider or reviewed 1200 PNG'],guide:'README.md and docs/provider-contract.md'});return hints.provider?0:3;}
  if(command==='collect:run'){const facts=await collectJob(job);emit({status:'collected',jobId:facts.jobId});return 0;}
  if(command==='collect:check'){const {report}=await checkCollection(job);await atomicWriteJson(join(job,'validation-report.json'),report);emit(report);return report.errors.length?2:0;}
  if(command==='render:run'||command==='render:cards'){
   const options=flags.cdp&&flags.profile?{cdpEndpoint:flags.cdp,profilePath:resolve(flags.profile)}:undefined;
   await renderJob(job,options,command==='render:cards');emit({status:command==='render:cards'?'cards_rendered':'rendered'});return 0;
  }
  if(command==='post:compile'){const {facts,report}=await checkCollection(job);if(report.errors.length)throw Error('validation_failed');await atomicWriteJson(join(job,'post.json'),createPost(facts));emit({status:'post_compiled'});return 0;}
  if(command==='draft:check'){const report=await validateBundle(job,await loadBundle(job));await atomicWriteJson(join(job,'validation-report.json'),report);emit(report);return report.errors.length?2:0;}
  const result=await runDraft(job,{cdpEndpoint:required(flags,'cdp'),profilePath:resolve(required(flags,'profile'))});emit(result);
  return result.status==='draft_saved'?0:result.status==='draft_unconfirmed'?4:result.status==='needs_user'?3:2;
 }catch(e){
  const code=e instanceof Error?e.message:String(e),status=code.startsWith('needs_user:')||code.startsWith('session_locked:')?'needs_user':'failed';
  emit({status,code});return status==='needs_user'?3:2;
 }
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href)process.exitCode=await runCli(process.argv.slice(2));
