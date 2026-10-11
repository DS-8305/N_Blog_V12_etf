import type { FactDocument } from '../domain/etf.js';
export function riskDisclosure(d:FactDocument):string{
 const i=d.identity,features=new Set([i.type,...i.features]);const risks:string[]=[];
 if(features.has('leveraged')||features.has('inverse'))risks.push('일일 '+i.leverageMultiple+'배 목표는 장기 누적 배수와 다르며, 복리 경로에 따라 결과가 달라질 수 있습니다.');
 if(features.has('covered_call'))risks.push('커버드콜은 옵션 프리미엄을 받지만 상승 참여가 제한되고 손실 가능성이 있습니다.');
 if(features.has('synthetic'))risks.push('합성 방식은 거래상대방 위험을 함께 확인해야 합니다.');
 if(features.has('currency_hedged'))risks.push('환헤지 효과와 비용을 확인해야 하며 환율 위험을 완전히 없애지는 못합니다.');
 if(features.has('futures')||i.type==='commodity')risks.push('선물형 구조라면 만기 교체 과정의 롤오버 비용과 현물 차이를 살펴보세요.');
 if(i.type==='bond')risks.push('금리 변화와 채권의 신용 위험에 따라 가격이 변할 수 있습니다.');
 if(!risks.length)risks.push('기초시장 변동, 환율과 편입 집중도, 추적 차이를 함께 확인해 보세요.');
 if(d.facts.overview.value.distribution==='variable')risks.push('분배금 금액과 지급은 보장되지 않습니다.');
 risks.push('과거 가격은 미래 수익을 보장하지 않으며 원금 손실이 가능합니다.');
 return risks.join(' ');
}
