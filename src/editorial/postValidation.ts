import type { FactDocument } from '../domain/etf.js';import type { PostDocument } from '../domain/bundle.js';import { postSchema,requiredRoles } from '../domain/bundle.js';import type { ValidationReport } from '../domain/validation.js';import { fingerprint } from './fingerprint.js';import { numberText as n } from '../render/typography.js';import { holdingChartRows } from '../render/cards.js';import { riskDisclosure } from './etfRiskDisclosure.js';
export const headings=['이 ETF는 무엇을 담고 있나요?','ETF 규모와 운용 비용은?','최근 1년 가격은 어떻게 움직였나요?','어떤 종목과 산업에 투자하나요?','앞으로 무엇을 살펴보면 될까요?'];
export function createPost(d:FactDocument):PostDocument{
 const i=d.identity,f=d.facts,x=f.exposures.value,q=f.quote.value,r=f.range52w.value;
 const titleCandidates=[i.fundName+' ('+i.symbol+'), 무엇을 담은 ETF일까요?',i.symbol+' ETF, 규모와 운용 비용 확인하기',i.symbol+' ETF의 52주 거래가격 살펴보기',i.symbol+' ETF, 편입 비중으로 알아보는 투자전략',i.symbol+' ETF 초보자를 위한 다섯 가지 확인 사항',i.symbol+' ETF의 기초지수와 위험 이해하기',i.symbol+' ETF, 가격과 기준가는 어떻게 다를까요?'];
 const texts=[
  i.fundName+' ('+i.symbol+')는 '+i.issuerName+'의 ETF입니다. '+f.overview.value.indexOrStrategy+'를 기준으로 운용합니다. '+f.overview.value.description+' ETF는 여러 자산을 묶어 거래소에서 한 주 단위로 사고파는 펀드입니다. 상품 이름이 비슷해도 전략과 클래스가 다를 수 있어 정식 상품을 확인하는 것이 좋습니다.',
  'AUM은 ETF가 운용하는 자산 규모인 순자산총액입니다. '+f.aum.asOf+' 기준 '+n(f.aum.value.amount)+' '+f.aum.value.currency+'입니다. 비용은 '+f.expenses.asOf+' 기준 '+f.expenses.value.map(e=>e.label+' 연 '+n(e.percent)+'%').join(', ')+'입니다. 비용 용어는 시장마다 다르며, 자산 규모가 크다고 수익이 보장되지는 않습니다.',
  r.from+'부터 '+r.to+'까지 시장가격 범위는 '+n(r.low)+'~'+n(r.high)+' '+r.currency+'입니다. '+f.quote.asOf+' 관측 가격은 '+n(q.amount)+' '+q.currency+' ('+(q.session==='close'?'종가':'장중')+')입니다. NAV는 자산을 평가한 기준가로 거래가격과 다를 수 있습니다. 이 가격 범위는 분배금 재투자를 포함한 총수익률이 아닙니다.',
  f.exposures.asOf+' 공개 자료의 '+(x.basis==='etf_actual'?'ETF 실제 편입':'벤치마크 구성')+' 비중입니다. '+holdingChartRows(x).map(e=>e.name+' '+n(e.weightPercent)+'%').join(', ')+'. 편입 비중은 포트폴리오 구성을 뜻합니다. 상위 공개 항목과 미표시 비중을 구분해 보세요. '+(x.conversionReason??'구성 자료의 기준일은 가격 기준일과 별도로 확인합니다.'),
  riskDisclosure(d)+' 비용과 전략을 공식 자료로 주기적으로 확인해 보세요. 아래 사진은 AI 생성 콘셉트 이미지입니다.'
 ];
 const keys=[['identity','overview'],['aum','expenses'],['quote','range52w'],['exposures'],['overview']] as const;
 const all=[d.identityEvidence,...Object.values(f)];const fact=(key:string)=>key==='identity'?d.identityEvidence:(f as any)[key];
 const sections=texts.map((text,index)=>({heading:headings[index],role:requiredRoles[index],text,factIds:keys[index].map(k=>fact(k).factId),claims:[] as {text:string;factId:string}[]}));
 // Each numeric token is explicitly attached to its original evidence; validatePost checks the entire canonical sentence.
 sections[1].claims=[{text:n(f.aum.value.amount),factId:f.aum.factId},...f.expenses.value.map(e=>({text:n(e.percent)+'%',factId:f.expenses.factId}))];
 sections[2].claims=[{text:n(r.low),factId:f.range52w.factId},{text:n(r.high),factId:f.range52w.factId},{text:n(q.amount),factId:f.quote.factId}];
 sections[3].claims=holdingChartRows(x).map(e=>({text:n(e.weightPercent)+'%',factId:f.exposures.factId}));
 return {schemaVersion:1,jobId:d.jobId,titleCandidates,selectedTitle:titleCandidates[0],titleFactIds:[d.identityEvidence.factId],sections,tags:['ETF',i.symbol,'ETF정보','ETF초보'],basisFingerprint:fingerprint(d)};
}
export function validatePost(p:PostDocument,d:FactDocument,length={min:800,max:1000}):ValidationReport{
 const report:ValidationReport={errors:[],warnings:[],fingerprint:fingerprint({p,d})};const add=(code:string,path='post')=>report.errors.push({code,path,message:code});
 if(!postSchema.safeParse(p).success){add('invalid_post_schema');return report;}
 if(p.jobId!==d.jobId||p.basisFingerprint!==fingerprint(d))add('post_facts_mismatch');
 if(p.sections.some((s,i)=>s.role!==requiredRoles[i]||s.heading!==headings[i]))add('section_role_order');
 const ids=new Set([d.identityEvidence,...Object.values(d.facts)].map(e=>e.factId));if([...p.titleFactIds,...p.sections.flatMap(s=>[...s.factIds,...s.claims.map(c=>c.factId)])].some(id=>!ids.has(id)))add('unknown_fact_reference');
 const canonical=createPost(d),body=p.sections.map(s=>s.text).join('\n'),combined=p.selectedTitle+' '+body;
 const prohibited=[/수익(?:률)?(?:이|을|은)?\s*(?:확정|보장(?!(?:하지|되지)))/,/분배금(?:이|은)?\s*(?:확정|보장(?!(?:하지|되지)))/,/무조건.*(?:상승|수익)/,/매수(?:하세요|추천|타이밍)/,/목표가/,/원금\s*보장(?!(?:하지|되지))/,/실제\s*(?:펀드|ETF).*운용\s*사진입니다/];
 if(prohibited.some(re=>re.test(combined)))add('prohibited_claim');
 if(!p.titleCandidates.includes(p.selectedTitle)||!canonical.titleCandidates.includes(p.selectedTitle)||p.titleCandidates.some(t=>!canonical.titleCandidates.includes(t)))add('unverified_title');
 for(const [index,s] of p.sections.entries()){
  if(fingerprint(s.factIds)!==fingerprint(canonical.sections[index]!.factIds))add('section_fact_binding');
  if(s.text!==canonical.sections[index]!.text)add('unbound_numeric_claim','sections.'+index);
  if(fingerprint(s.claims)!==fingerprint(canonical.sections[index]!.claims))add('claim_binding_mismatch');
 }
 if(body.length<length.min||body.length>length.max)report.warnings.push({code:'article_length',path:'post',message:'Body '+body.length+' characters; requested '+length.min+'–'+length.max+'. All mandatory disclosures preserved.'});
 return report;
}
