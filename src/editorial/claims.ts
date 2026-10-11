// Positive advice/guarantees are prohibited, while nearby grammatical negations remain valid disclosures.
function isNegatedAfter(text:string,end:number):boolean{
 return /^\s*(?:(?:이|은|는|을|를)|상품(?:이|은|은요)?|표현(?:은|이)?)?\s*(?:하지|되지|없|아니|아닙)/.test(text.slice(end));
}
export function hasProhibitedClaim(text:string):boolean{
 for(const re of [
  /(?:원금|수익률?|분배금)[^.!?\n]{0,28}?(?:보장|확정)/g,
  /(?:매수|매도)\s*(?:추천|권유|하세요|타이밍|적기)/g
 ]){
  for(const match of text.matchAll(re))if(!isNegatedAfter(text,match.index!+match[0].length))return true;
 }
 return /무조건[^.!?\n]*(?:상승|수익)|목표가|실제\s*(?:펀드|ETF)[^.!?\n]*운용\s*사진입니다/.test(text);
}
