# 공급자 설정 및 증빙 계약

초기 설치에는 실시간 운용사/거래소 API 계정이 포함되지 않습니다. 운용사 사이트별 선택자와 데이터 라이선스가 다르므로, 임의의 무료 시세 API를 기본값으로 사용하지 않습니다. 두 경로를 지원합니다.

1. reviewed_json: 운영자가 공식 자료를 확인하여 동일 job의 incoming.json에 입력합니다. source-hints.json에 approved:true와 licenseNote를 기록합니다. 값 자체도 verified여야 합니다.
2. https_json: 허가된 공급자/자체 어댑터 HTTPS endpoint가 동일 JSON 계약을 반환합니다. endpoint는 schemaVersion/jobId/identity/identityEvidence/facts를 반환해야 합니다. 일반 운용사 HTML URL을 이 endpoint로 넣을 수 없습니다. endpoint 어댑터가 원본 자료를 이 계약으로 변환합니다. sourceUrl에는 원자료 URL을 보존합니다.

요청 제한/가격/재배포 허용 여부는 운영자가 공급자와 확인합니다. 코드에는 자동 우회·로그인 수집·유료 API 키가 없습니다. HTTP 경로는 30초 제한, redirect 금지, 인증키는 authEnv로 지정한 환경변수의 Bearer 값만 사용합니다. 401/403/429 등은 사용자 조치로 반환하며 자동 재요청하지 않습니다.

## source-hints.json

```json
{
  "schemaVersion": 1,
  "provider": {"kind":"reviewed_json","path":"incoming.json","approved":true,"licenseNote":"공식 자료 사용 근거를 실제 확인 후 입력"},
  "capture": {"regionSelector":"#actual-etf-detail","allowCapture":true,"licenseNote":"상품페이지 자동 캡처 허용 근거"},
  "concept": {"kind":"reviewed_file","path":"incoming/theme.png","sha256":"1200 정사각 PNG 파일의 실제 sha256","sourceUrl":"https://실제-생성-이미지-증빙-URL","model":"실제 생성 모델","licenseNote":"사용권 근거","reviewed":true,"aiGenerated":true}
}
```

위 URL/해시/선택자는 설명용 placeholder이며 실행 가능 설정이 아닙니다. 파일 경로는 job 하위 상대 경로이며 외부 절대경로·상위 경로·외부 symlink는 차단합니다. 브라우저 region에는 정식 ETF 이름, 운용사, 심볼, 추종지수/전략이 모두 보이는 영역을 선택합니다. 가림/클리핑/미완료 이미지/상품 URL 리다이렉트를 거부합니다.

HTTP 데이터 provider는 kind:https_json, url, approved:true, licenseNote, 선택 authEnv를 지정합니다. HTTP 콘셉트 provider는 kind:http, url, model, licenseNote, approved:true, 선택 authEnv를 지정합니다. 콘셉트 요청은 prompt/model/width:1200/height:1200, 응답은 imageBase64/sourceUrl/aiGenerated:true입니다. PNG 크기·형식을 검사하고 출처 URL과 모델을 기록합니다. 생성하지 않은 이미지의 생성 성공을 주장하지 않습니다.

## 데이터 JSON

스키마의 실행 가능한 기준은 src/domain/etf.ts의 factsSchema입니다. tests/fixtures/fund.ts에는 구조를 보여주는 **가상 테스트 자료**만 있습니다. 실제 포스팅에 사용하지 마세요.

문서 최상위 필드는 schemaVersion:1, jobId(실제 request와 동일), identity, identityEvidence, facts입니다. identity는 assetType:etf, symbol(문자열), market, isin(가능하면), issuerName, fundName, officialProductUrl(해당 상품 URL), currency, type, features, 선택 leverageMultiple입니다. identityEvidence.value는 identity와 완전히 동일하며 공식 상품 URL과 official_issuer를 요구합니다.

각 Evidence는 factId, value, sourceUrl, sourceName, asOf(YYYY-MM-DD), retrievedAt(시간대 포함 ISO 시각), verification:verified, dataKind, definition, 금액 자료 currency를 포함합니다. asOfTimezone을 선택 지정할 수 있으며 생략하면 KRX는 Asia/Seoul, 미국 시장은 America/New_York입니다. 조회 시각의 실제 instant를 이 기준일 시간대로 변환해 미래 자료 여부를 확인합니다. facts 필수 키는 다음과 같습니다.

| 키 | value |
|---|---|
| overview | indexOrStrategy, description, theme, distribution(variable/accumulating/none) |
| aum | amount, currency, basis:net_assets |
| expenses | [{kind, label, percent, annualized:true}] |
| quote | amount, currency, priceType:market, session:close/intraday, adjustment:unadjusted/split_adjusted, exchangeTimezone, observedAt |
| range52w | low, high, currency, priceType:market, session, adjustment, from, to |
| exposures | mode:holdings/sectors/exposures, basis:etf_actual/benchmark, coverage:full/partial, items:[{name, symbol?, isin?, weightPercent, category, basis?}], conversionReason? |

category가 equity인 회사 주식만을 채권·원자재·통화 ETF에 강제하지 않습니다. exposures 모드에는 conversionReason을 함께 기록합니다. 현금·선물·채권 등 실제 구성의 category를 보존합니다.
leverageMultiple은 방향을 포함하는 공식 일일 목표배수입니다. 일반 레버리지는 양수(예: 2), 인버스는 음수(예: -1/-2)로 입력합니다. 방향 불일치는 거부합니다.

수집 때 요청/설정/원본 JSON의 fingerprint를 기록합니다. 파일 수치·출처·설정 변경은 체크포인트 재사용과 저장 검증을 무효화합니다. 입력이 시작된 job에는 수집/렌더를 다시 실행하지 말고 새 job을 만드세요. 운영자 검토 상태는 신뢰 경계이며 코드는 데이터의 경제적 진실이나 사용권을 독립적으로 인증하는 서비스가 아닙니다.
