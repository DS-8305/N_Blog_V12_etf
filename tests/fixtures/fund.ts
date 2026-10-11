// Entirely fictional data for offline tests. Never use for a real post.
export function fundFixture(): any {
 const identity={assetType:'etf',symbol:'EXAM',market:'NASDAQ',isin:'US0000000001',issuerName:'Example Asset Management',fundName:'Example Global Equity ETF',officialProductUrl:'https://issuer.example/products/exam',currency:'USD',type:'equity',features:[]};
 const evidence=(factId:string,value:unknown,definition:string,asOf='2026-10-09')=>({factId,value,sourceUrl:identity.officialProductUrl,sourceName:'Example official issuer (fictional)',asOf,retrievedAt:'2026-10-10T01:00:00Z',verification:'verified',dataKind:'official_issuer',definition});
 return {schemaVersion:1,jobId:'etf-example',identity,identityEvidence:evidence('identity',structuredClone(identity),'ETF product identity'),facts:{
  overview:evidence('overview',{indexOrStrategy:'Example Global Index',description:'세계 주식시장에 분산 투자하는 예시 ETF입니다.',theme:'글로벌 주식시장',distribution:'variable'},'공식 투자전략'),
  aum:{...evidence('aum',{amount:1250000000,currency:'USD',basis:'net_assets'},'순자산총액'),currency:'USD'},
  expenses:evidence('expenses',[{kind:'expense_ratio',label:'Expense ratio',percent:0.15,annualized:true}], '연간 운용 비용'),
  quote:{...evidence('quote',{amount:105,currency:'USD',priceType:'market',session:'close',adjustment:'unadjusted',exchangeTimezone:'America/New_York',observedAt:'2026-10-09T16:00:00-04:00'},'ETF 1주당 거래소 종가'),currency:'USD',dataKind:'licensed_provider',sourceUrl:'https://quotes.example/EXAM',sourceName:'Licensed example (fictional)'},
  range52w:{...evidence('range52w',{low:80,high:120,currency:'USD',priceType:'market',session:'close',adjustment:'unadjusted',from:'2025-10-10',to:'2026-10-09'},'52주 거래소 종가 범위'),currency:'USD',dataKind:'licensed_provider',sourceUrl:'https://quotes.example/EXAM',sourceName:'Licensed example (fictional)'},
  exposures:evidence('exposures',{mode:'holdings',basis:'etf_actual',coverage:'partial',items:[{name:'Alpha',symbol:'AAA',weightPercent:20,category:'equity'},{name:'Beta',symbol:'BBB',weightPercent:15,category:'equity'},{name:'Gamma',symbol:'CCC',weightPercent:8,category:'equity'}]},'운용사 실제 ETF 편입 비중','2026-08-31')
 }};
}
