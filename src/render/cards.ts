import { join } from 'node:path';import { mkdir } from 'node:fs/promises';
import type { FactDocument,ExposureSet } from '../domain/etf.js';
import { validateFacts } from '../domain/etf.js';
import type { CapturedAsset,AssetRole } from '../domain/bundle.js';
import { fingerprint } from '../editorial/fingerprint.js';
import { renderCard,numberText as n,type CardLine } from './typography.js';
export function holdingChartRows(x:ExposureSet):{name:string;weightPercent:number}[]{
 const top=[...x.items].sort((a,b)=>b.weightPercent-a.weightPercent).slice(0,5).map(e=>({name:e.name,weightPercent:e.weightPercent}));
 const remainder=Math.round((100-top.reduce((sum,e)=>sum+e.weightPercent,0))*10000)/10000;
 return [...top,...(remainder>0.01?[{name:'기타 / 미표시',weightPercent:remainder}]:[])];
}
export async function renderDataCards(job:string,d:FactDocument,asOfDate:string):Promise<CapturedAsset[]>{
 const errors=validateFacts(d,{symbol:d.identity.symbol,market:d.identity.market,asOfDate});if(errors.length)throw Error('needs_user:'+errors.map(e=>e.code).join(','));
 await mkdir(join(job,'assets'),{recursive:true});const i=d.identity,f=d.facts,now=new Date().toISOString(),assets:CapturedAsset[]=[];
 const make=async(role:AssetRole,lines:CardLine[],keys:(keyof typeof f)[],caption:string)=>{
  const source=f[keys[0]]!,meta=await renderCard(join(job,'assets',role+'.png'),lines);
  assets.push({assetId:role,role,assetKind:'data_card',relativePath:'assets/'+role+'.png',sourceUrl:source.sourceUrl,asOf:source.asOf,capturedAt:now,generatedAt:now,...meta,factIds:keys.map(key=>f[key]!.factId),caption,licenseNote:'Verified source values; deterministic local data card',reviewStatus:'verified',basisFingerprint:fingerprint(d)});
 };
 const header=(title:string):CardLine[]=>[{text:title,size:46,color:'#286f93',gap:26},{text:i.fundName+' ('+i.symbol+')',size:30,gap:18}];
 await make('aum_fee_card',[...header('ETF 규모와 운용 비용'),{text:'AUM · 순자산총액',size:36,gap:12},{text:n(f.aum.value.amount)+' '+f.aum.value.currency,size:56,gap:18},{text:'자산 규모 기준일: '+f.aum.asOf,size:24},...f.expenses.value.map(e=>({text:e.label+' (연율) '+n(e.percent)+'%',size:34,gap:20})),{text:'비용 기준일: '+f.expenses.asOf,size:24},{text:'운용사: '+i.issuerName,size:24},{text:'AUM은 회사 시가총액이 아닙니다.',size:24},{text:'출처: '+f.aum.sourceName+' / '+f.expenses.sourceName,size:20}],['aum','expenses'],'AUM '+f.aum.asOf+' · 비용 '+f.expenses.asOf+' · '+f.aum.value.currency);
 const r=f.range52w.value,q=f.quote.value,position=(q.amount-r.low)/(r.high-r.low)*100;
 await make('etf_price_52w_card',[...header('최근 52주 거래가격 범위'),{text:'52주 저가 '+n(r.low)+' '+r.currency,size:36},{text:'52주 고가 '+n(r.high)+' '+r.currency,size:36},{text:'관측 가격 '+n(q.amount)+' '+q.currency,size:46,barPercent:position},{text:'기간: '+r.from+' ~ '+r.to,size:24},{text:'관측: '+q.observedAt+' ('+q.exchangeTimezone+')',size:24},{text:(q.session==='close'?'종가':'장중 시세')+' · '+(q.adjustment==='unadjusted'?'비보정':'분할보정')+' · 시장가격 기준',size:26},{text:'NAV(기준가) 및 분배금 재투자 총수익률과 다릅니다.',size:24},{text:'출처: '+f.quote.sourceName+' / '+f.range52w.sourceName,size:20}],['quote','range52w'],'52주 시장가격 · '+r.currency+' · '+r.to);
 const x=f.exposures.value,rows=holdingChartRows(x);
 await make('holdings_sectors_card',[...header(x.mode==='holdings'?'상위 편입 종목':x.mode==='sectors'?'섹터 비중':'기초자산 노출'),{text:(x.basis==='etf_actual'?'ETF 실제 편입':'공식 벤치마크 구성')+' · '+f.exposures.asOf,size:24},...rows.map(row=>({text:row.name+'   '+n(row.weightPercent)+'%',size:27,gap:9,barPercent:row.weightPercent})),{text:x.coverage==='partial'?'상위 공개 항목만 표시; 기타는 미표시 비중입니다.':'전체 공개 비중에서 상위 항목을 표시했습니다.',size:20},...(x.conversionReason?[{text:'노출 표시 이유: '+x.conversionReason,size:20}]:[]),{text:'출처: '+f.exposures.sourceName,size:20}],['exposures'],(x.basis==='etf_actual'?'ETF 실제 편입':'벤치마크 구성')+' · '+f.exposures.asOf);
 return assets;
}
