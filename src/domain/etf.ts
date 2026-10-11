import { z } from 'zod';
import { date,instant,url,nonempty,finite,id,type ValidationIssue } from './validation.js';
import { canonical } from '../editorial/fingerprint.js';
export const markets=['NASDAQ','NYSE','NYSEARCA','CBOE','KRX:KOSPI','KRX:KOSDAQ'] as const;
export const types=['equity','bond','commodity','currency','multi_asset','leveraged','inverse','covered_call','synthetic','other'] as const;
export const identitySchema=z.object({
 assetType:z.literal('etf'),symbol:nonempty,market:z.enum(markets),isin:nonempty.optional(),
 issuerName:nonempty,fundName:nonempty,officialProductUrl:url,currency:z.string().regex(/^[A-Z]{3}$/),
 type:z.enum(types),features:z.array(z.enum(['leveraged','inverse','covered_call','synthetic','currency_hedged','futures'])).default([]),
 leverageMultiple:finite.optional()
}).strict();
export type EtfIdentity=z.infer<typeof identitySchema>;
const evidenceBase={factId:id,sourceUrl:url,sourceName:nonempty,asOf:date,asOfTimezone:nonempty.optional(),retrievedAt:instant,currency:z.string().regex(/^[A-Z]{3}$/).optional(),verification:z.enum(['verified','unverified']),dataKind:z.enum(['official_issuer','official_exchange','licensed_provider','derived']),definition:nonempty};
export interface Evidence<T> {factId:string;value:T;sourceUrl:string;sourceName:string;asOf:string;asOfTimezone?:string;retrievedAt:string;currency?:string;verification:'verified'|'unverified';dataKind:'official_issuer'|'official_exchange'|'licensed_provider'|'derived';definition:string}
const ev=<T extends z.ZodTypeAny>(value:T)=>z.object({...evidenceBase,value}).strict();
const money=z.object({amount:finite.positive(),currency:z.string().regex(/^[A-Z]{3}$/),basis:z.literal('net_assets')}).strict();
const overview=z.object({indexOrStrategy:nonempty,description:nonempty,theme:nonempty,distribution:z.enum(['variable','accumulating','none'])}).strict();
const expense=z.object({kind:z.enum(['total_fee','total_expense','synthetic_total_fee','expense_ratio']),label:nonempty,percent:finite.min(0).max(100),annualized:z.literal(true)}).strict();
const quote=z.object({amount:finite.positive(),currency:z.string().regex(/^[A-Z]{3}$/),priceType:z.literal('market'),session:z.enum(['close','intraday','last']),adjustment:z.enum(['unadjusted','split_adjusted']),exchangeTimezone:nonempty,observedAt:instant}).strict();
const range=z.object({low:finite.positive(),high:finite.positive(),currency:z.string().regex(/^[A-Z]{3}$/),priceType:z.literal('market'),session:z.enum(['close','intraday']),adjustment:z.enum(['unadjusted','split_adjusted']),from:date,to:date}).strict();
const exposure=z.object({name:nonempty,symbol:nonempty.optional(),isin:nonempty.optional(),weightPercent:finite.min(0).max(100),category:nonempty,basis:z.enum(['etf_actual','benchmark']).optional()}).strict();
const exposures=z.object({mode:z.enum(['holdings','sectors','exposures']),basis:z.enum(['etf_actual','benchmark']),coverage:z.enum(['full','partial']),items:z.array(exposure).min(1).max(500),conversionReason:nonempty.optional()}).strict();
export const factsSchema=z.object({schemaVersion:z.literal(1),jobId:id,identity:identitySchema,identityEvidence:ev(identitySchema),facts:z.object({
 overview:ev(overview),aum:ev(money),expenses:ev(z.array(expense).min(1).max(4)),quote:ev(quote),range52w:ev(range),exposures:ev(exposures),
 nav:ev(z.object({amount:finite.positive(),currency:nonempty,priceType:z.literal('nav')})).optional()
}).strict()}).strict();
export type FactDocument=z.infer<typeof factsSchema>;
export type FactKey=keyof FactDocument['facts'];
export type EtfOverview=z.infer<typeof overview>;
export type Money=z.infer<typeof money>;
export type ExpenseDisclosure=z.infer<typeof expense>;
export type Quote=z.infer<typeof quote>;
export type Range52w=z.infer<typeof range>;
export type ExposureSet=z.infer<typeof exposures>;
export function parseFacts(input:unknown):FactDocument{return factsSchema.parse(input);}
type IdentityRequest={symbol:string;market:string;asOfDate:string;issuer?:string;isin?:string};
export function validateFacts(input:unknown,request:IdentityRequest):ValidationIssue[]{
 try{return validateFactsUnchecked(input,request);}
 catch{
  const parsed=factsSchema.safeParse(input);
  return parsed.success?[{code:'invalid_facts',path:'facts',message:'invalid_facts'}]:parsed.error.issues.map(e=>({code:'invalid_schema',path:e.path.join('.'),message:e.message}));
 }
}
function validateFactsUnchecked(input:unknown,request:IdentityRequest):ValidationIssue[]{
 const errors:ValidationIssue[]=[];const add=(code:string,path='facts')=>errors.push({code,path,message:code});
 // Semantic errors are reported before structural schema errors so operators can correct definitions.
 const raw=input as FactDocument;
 if(!raw?.identity||!raw.facts){add('invalid_facts');return errors;}
 const i=raw.identity,f=raw.facts;
 if(i.symbol!==request.symbol||i.market!==request.market||request.issuer&&request.issuer!==i.issuerName||request.isin&&request.isin!==i.isin||canonical(i)!==canonical(raw.identityEvidence?.value))add('fund_identity_ambiguous','identity');
 if(raw.identityEvidence?.sourceUrl!==i.officialProductUrl||raw.identityEvidence?.dataKind!=='official_issuer'||new URL(i.officialProductUrl).pathname==='/')add('official_product_required','identity');
 const all=[raw.identityEvidence,...Object.values(f)];
 if(all.some(e=>!e)){add('evidence_missing');return errors;}
 if(new Set(all.map(e=>e.factId)).size!==all.length)add('duplicate_fact_id');
 for(const e of all){
  if(e.verification!=='verified')add('evidence_unverified',e.factId);
  const sourceTimezone=e.asOfTimezone??(i.market.startsWith('KRX:')?'Asia/Seoul':'America/New_York');
  try{
   const retrievedDate=new Intl.DateTimeFormat('en-CA',{timeZone:sourceTimezone,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(e.retrievedAt));
   if(e.asOf>request.asOfDate||e.asOf>retrievedDate)add('future_asof',e.factId);
  }catch{add('invalid_source_timezone',e.factId);}
  if(e.currency&&'currency' in e.value&&e.currency!==(e.value as {currency:string}).currency)add('evidence_currency_mismatch',e.factId);
 }
 if(f.aum?.value.basis!=='net_assets')add('net_assets_required','aum');
 if(f.quote?.value.priceType!=='market'||f.range52w?.value.priceType!=='market')add('market_price_required');
 if(f.quote?.value.currency!==f.range52w?.value.currency||f.quote?.value.currency!==i.currency)add('price_currency_mismatch');
 const sessionsMatch=f.quote?.value.session===f.range52w?.value.session||(f.quote?.value.session==='last'&&f.range52w?.value.session==='intraday');
 if(f.quote?.value.adjustment!==f.range52w?.value.adjustment||!sessionsMatch)add('price_basis_mismatch');
 if(f.range52w&&f.quote){
  const r=f.range52w.value,q=f.quote.value,days=(+new Date(r.to)-+new Date(r.from))/86400000;
  if(!(r.high>r.low)||q.amount<r.low||q.amount>r.high||days<350||days>370||r.to>f.range52w.asOf||r.to!==f.quote.asOf)add('invalid_price_range');
  try{new Intl.DateTimeFormat('en',{timeZone:q.exchangeTimezone});if(new Intl.DateTimeFormat('en-CA',{timeZone:q.exchangeTimezone,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(q.observedAt))!==f.quote.asOf)add('quote_date_mismatch');}catch{add('invalid_exchange_timezone');}
 }
 const labels:Record<string,string>={total_fee:'총보수',total_expense:'총보수·비용',synthetic_total_fee:'합성총보수',expense_ratio:'Expense ratio'};
 if(f.expenses?.value.some(e=>labels[e.kind]!==e.label||e.annualized!==true)||new Set(f.expenses?.value.map(e=>e.kind)).size!==f.expenses?.value.length)add('expense_definition_mismatch');
 if(i.market.startsWith('KRX:')&&!/^\d{6}$/.test(i.symbol))add('invalid_krx_symbol');
 if(!i.market.startsWith('KRX:')&&!/^[A-Z][A-Z0-9.-]{0,14}$/.test(i.symbol))add('invalid_us_symbol');
 if(f.exposures){
  const x=f.exposures.value,sum=x.items.reduce((n,e)=>n+e.weightPercent,0);
  if(x.items.some(e=>e.basis&&e.basis!==x.basis))add('exposure_basis_mismatch');
  if(sum>100.01||x.coverage==='full'&&Math.abs(sum-100)>0.1)add('full_weights_invalid');
  if(new Set(x.items.map(e=>e.symbol??e.isin??e.name)).size!==x.items.length)add('duplicate_exposure');
  if(['bond','commodity','currency','synthetic','other'].includes(i.type)&&x.mode==='holdings'&&x.items.some(e=>e.category==='equity'))add('exposures_mode_required');
  if(x.mode==='exposures'&&!x.conversionReason)add('exposure_reason_required');
 }
 for(const key of ['overview','aum','expenses','exposures'] as const)if(f[key]&&!['official_issuer','official_exchange'].includes(f[key].dataKind))add('official_fund_source_required',key);
 for(const key of ['quote','range52w'] as const)if(f[key]&&!['official_exchange','licensed_provider'].includes(f[key].dataKind))add('exchange_source_required',key);
 if((i.type==='leveraged'||i.type==='inverse'||i.features.some(v=>v==='leveraged'||v==='inverse'))&&(i.leverageMultiple===undefined||i.leverageMultiple===0))add('leverage_multiple_required');
 const inverse=i.type==='inverse'||i.features.includes('inverse');
 if(i.leverageMultiple!==undefined&&((inverse&&i.leverageMultiple>=0)||(!inverse&&i.leverageMultiple<0)))add('leverage_direction_mismatch');
 const result=factsSchema.safeParse(input);
 if(!result.success)for(const e of result.error.issues)add('invalid_schema',e.path.join('.'));
 return errors;
}
