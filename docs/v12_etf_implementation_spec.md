# V12_ETF — ETF 네이버 홈판 콘텐츠 자동화 구현 설계서

> **상태:** Codex 구현 지시용 기술 설계서 (실제 코드 구현 완료를 뜻하지 않음)  
> **대상 저장소:** `DS-8305/v12_etf` (새 PRIVATE GitHub 저장소; 존재하지 않으면 Codex가 생성 절차 진행)  
> **원본 참조:** `DS-8305/N_Blog_V10_Budong` `main` commit `2b7f772bdf5817604a3019115a308d8265f962f4` (2026-10-07)  
> **교차 참조:** `DS-8305/v11_stock`의 완성·검증된 공통 엔진만 선택적으로 가져온다. **v11_stock이 없어도 이 문서만으로 구현 가능**해야 한다.  
> **환경:** Windows 11 + Chrome + Node.js >=22.12 + pnpm 11.12.0 + TypeScript + Playwright/CDP + sharp + Vitest  
> **목표:** ETF 종목코드/시장 입력 → 신뢰 가능한 최신 데이터 수집 → ETF 초보자용 글 + 역할별 이미지 5장 → 네이버 SmartEditor **임시저장**. 자동 공개 발행하지 않는다.

## 0. Codex 첫 실행 지시문 (복사 가능)

```text
프로젝트: DS-8305/v12_etf (새 private repository)
원본 참조: DS-8305/N_Blog_V10_Budong commit 2b7f772bdf5817604a3019115a308d8265f962f4
v11_stock_implementation_spec.md와 별도인 첨부 v12_etf_implementation_spec.md를 ETF 구현 계약으로 사용하라.
V10과 v11_stock 원본 저장소는 수정하지 마라. 필요한 범용 엔진은 의존성/테스트를 확인한 후 독립된 v12_etf 저장소 안으로 이식하라.
ETF를 기업으로 취급하지 말고 기업 시가총액 대신 순자산총액(AUM), 사업 부문 대신 편입 종목/섹터를 보여줘라.
ETF 공식 상품페이지 URL과 티커/ISIN/거래소/상품 유형이 일치하는지 확인하라.
AUM·보수·NAV·시장가격·52주 데이터·편입 비중은 각 기준일, 통화, 출처가 확인된 경우에만 포스팅하라.
M0과 M1부터 구현하고 pnpm test/typecheck/build 통과 결과를 제시한 뒤 단계별 진행하라.
공급자가 없거나 수집할 수 없는 숫자는 만들어내지 말고 needs_user로 정지하라.
네이버 임시저장 시 V10의 기존 글 보호, 저장 불확실 상태 중복 클릭 방지, 업로드 해시 검증을 유지하라.
```

## 1. 범위와 ETF 전용 핵심 차이

**최종 기본 이미지 5장**: ① ETF 공식 상품 소개 화면 ② 순자산총액(AUM)·총보수 카드 ③ 52주 가격 범위 카드 ④ 상위 편입 종목/섹터 비중 카드 ⑤ ETF가 노출되는 산업·시장 테마를 표현한 AI 실사형 콘셉트 이미지.

**투자 판단 도구가 아닌 정보성 포스팅**: 구체적 매수·매도, 수익률 보장, 목표가/시황 예측 금지. 고배당/월배당 ETF라도 분배금 금액과 지급은 보장되지 않는다고 명시. 레버리지·인버스·선물·합성·환헤지·커버드콜 등 특수 구조일 때 위험과 추적 특성을 초보자용 언어로 설명한다.

**주식과 혼동하지 말아야 할 것**:

| 주식(v11_stock) | ETF(v12_etf) | 구현상 규칙 |
|---|---|---|
| 회사 공식 홈페이지 | **운용사 해당 ETF 상품 페이지** | 자산운용사 일반 메인 화면으로 대체하지 않음 |
| 시가총액 | **ETF 순자산총액(AUM)** | AUM을 기업 시총으로 표시하지 않음 |
| 주력 사업·매출 비중 | **편입 종목·섹터·투자전략** | 비중 총합·기준일·상품 유형 검증 |
| 기업 사업 전망 | **기초지수/시장 노출의 체크포인트** | 개별 기업만의 실적 전망으로 오인 금지 |
| 기업 주가 | **ETF 거래가격** | NAV/기준가와 거래가격을 분리 |

## 2. 초보자용 5개 소제목·이미지 role

| 순번 | 소제목 | role | 이미지 방식 | 초보자에게 전달할 내용 |
|---|---|---|---|---|
| 1 | 이 ETF는 무엇을 담고 있나요? | `etf_overview` | 공식 운용사 **해당 ETF 상세 상품페이지** 실제 캡처 | ETF 이름, 운용사, 추종지수/투자전략 |
| 2 | ETF 규모와 운용 비용은? | `aum_fee_card` | 검증 수치로 만든 데이터 카드 | AUM, 보수/비용 정의, 통화·기준일, 선택적으로 거래소/설정일 |
| 3 | 최근 1년 가격은 어떻게 움직였나요? | `etf_price_52w_card` | 52주 최고/최저 가격 범위 그래픽 | 거래가격 기준 저가/고가/관측 가격, 시각·통화, NAV와 구별 |
| 4 | 어떤 종목과 산업에 투자하나요? | `holdings_sectors_card` | 상위 편입 종목 표 또는 섹터 비중 차트 | 최신 공개 편입일자/비중/잔여 기타, 실제 지수/ETF 보유 기준 |
| 5 | 앞으로 무엇을 살펴보면 될까요? | `etf_outlook_visual` | 대상 테마의 AI 콘셉트 실사 이미지 | 지수 변동요인·환율·비용·집중도·추적오차/위험 등 핵심 체크포인트 |

**고정 순서:** 소제목 → 짧은 설명 → 대응 이미지 1장. 데이터/인포그래픽 2~4 기본 `1200×1200 PNG`; 1은 공식 캡처 원본 비율 보존; 5는 `1200×1200 PNG` 실사형 콘셉트. 포털 전체 검색 결과 화면 캡처는 기본 역할에 포함하지 않는다.

## 3. 제품 유형별 분기 (반드시 고려)

### 3.1 일반 주식형 ETF
추종지수, 상위 5~10개 편입 종목과 합계, 섹터별 비중을 우선. ETF 자체의 편입 목록과 추종지수 구성종목을 섞지 않는다. 공식 운용사 비중의 기준일을 표시.

### 3.2 채권·원자재·통화 ETF
단순 `기업 상위 10개` 차트는 부적절할 수 있다. 채권 ETF는 만기/듀레이션/신용등급/국가 비중 등의 **자료가 검증될 때** 표시; 원자재 ETF는 선물/현물·롤오버 노출을 설명; 통화 ETF는 환노출과 기초자산 구조를 표시. **역할 4번은 `top holdings / exposures` 일반화**하고 확실한 자료만 차트화.

### 3.3 레버리지·인버스·커버드콜·합성·환헤지
상품 명세에서 유형을 인식하면 초보자에게 중요한 `일일 목표배수/복리 경로효과`, 옵션 프리미엄의 한계, 합성 거래상대방 위험, 환헤지 비용·효과 등 해당 사항을 표시. 52주 위치만으로 장기 수익성을 추론하지 않는다. 공식 고지로 확인되지 않은 위험 문구를 특정 상품 사실처럼 단정하지 않는다.

## 4. V10 및 V11 모듈 재사용 계약

| 출처 | 대상 파일/개념 | 처리 방식 |
|---|---|---|
| V10 | `src/browser/session.ts`, `runLock.ts`, `ownedPage.ts` | CDP 사용자 세션, 잠금, 소유 탭 사용 패턴 이식 |
| V10 | `src/capture/captureRegion.ts`, `captureAsset.ts`, `readiness.ts` | 공식 상품페이지 영역 캡처·비율/가림/로딩 검증 유지 |
| V10 | `src/collectors/collectJob.ts`, `cache.ts`, `retry.ts` | 작업 재개/부분 체크포인트 구조 재사용, ETF 날짜/ID 기준으로 수정 |
| V10 | `src/automation/imageUploader.ts`, `draftRunner.ts`, `draftVerifier.ts` | 이미지 업로드·저장 증거/재열람 안전 로직 유지 |
| V10 | `src/domain/bundle.ts`, `editorial/assetValidation.ts` | 아파트 전용 필드 삭제, ETF용 스키마/검증기로 **새로 구현** |
| V11 | 검증 완료된 범용 render helpers, quote/range 스키마, CLI 등 | `v11_stock` 안정 버전 commit을 명시하고 필요한 파일만 이식. V11 private repo에 런타임 종속 금지 |
| 전용 개발 | ETF 정체성, 운용사 검색, AUM/보수, 보유목록, NAV/시장가 | **V12 신규 구현 필수** |

`src/collectors/naverExterior.ts`, `naverLand.ts`, `kakaoMap.ts` 같은 부동산 도메인 모듈을 비슷한 이름으로 억지 재활용하지 말고 패턴만 참고한다. V10 원본 git 기록·브라우저 프로필·실제 workspaces 파일은 복제하지 않는다.

## 5. 새 repository 트리

```text
v12_etf/
  README.md AGENTS.md
  docs/v12_etf_implementation_spec.md
  docs/etf-data-definitions.md
  src/cli/{main,arguments}.ts
  src/browser/{session,runLock,ownedPage}.ts
  src/domain/{etf,etfType,asset,post,job,validation}.ts
  src/providers/{types,registry,issuerPage,exchangeQuote,aum,holdings}.ts
  src/collectors/{collectJob,resolveFund,issuerOverview,aumFees,price52w,holdingsExposures}.ts
  src/capture/{captureRegion,captureAsset,readiness}.ts
  src/render/{aumFeeCard,priceRangeCard,holdingsCard,conceptImage,typography}.ts
  src/editorial/{compileDraft,assetValidation,postValidation,etfRiskDisclosure}.ts
  src/automation/{imageUploader,imageCaption,draftRunner,draftVerifier,sessionProbe}.ts
  src/state/{jobStore,jsonStore}.ts
  tests/{fixtures,unit,integration,live-manual}/
  workspaces/                     # .gitignore
```

## 6. ETF 식별과 제공자 명세

### 6.1 식별 입력

`symbol`, `market`, `asOfDate`, `issuer`(선택), `isin`(가능하면 확인)을 받는다. 한국 상장 ETF는 6자리 코드를 선행 0 포함 문자열로 보관하며 **운용사+상품명+증권 코드+상장시장**을 상호 검증한다. 미국 ETF는 ticker + 거래소 + 운용사/펀드 시리즈 + 공식 상품 상세페이지를 검증한다. 이름이 유사한 hedged/unhedged, active/index, 분배/재투자 클래스, 만기/전략 변형 ETF를 다른 상품으로 오인하면 `needs_user:fund_identity_ambiguous`.

### 6.2 데이터 우선순위

- **기초지수/투자전략/비용/보유목록:** 운용사 공식 상품 페이지, 공식 월간 factsheet·투자설명서·공시.
- **한국 상장/거래가격/기본 자료:** 공식 KRX 및 이용 허용된 시장 데이터 공급자. 공시/투자설명서 등 기초 자료는 관련 공식 공개문서.
- **미국 ETF:** 운용사 공식 자료 및 필요시 SEC 공시/허용된 시장 데이터 제공자.
- 캡처는 *공식 ETF 상품 단일 페이지*를 우선하며, 데이터 제공자가 외부 복제·화면캡처를 금지하면 출력하지 않는다.
- 특정 API가 항상 무료·접근 가능하다고 가정하지 않는다. 라이선스·키·요청 한도를 설정 파일과 운영 README에 명확히 기록. 무단 로그인/차단 우회 불가.

```ts
interface EftIdentity { // 구현 때 올바른 이름 EtfIdentity로 정의 가능
  assetType: 'etf'; symbol: string; market: string; isin?: string;
  issuerName: string; fundName: string; officialProductUrl: string;
  currency: string; type: 'equity'|'bond'|'commodity'|'currency'|'multi_asset'|'leveraged'|'inverse'|'covered_call'|'synthetic'|'other';
}
interface Evidence<T> {
  value: T;
  sourceUrl: string;
  asOf: string;            // 데이터 기준일
  retrievedAt: string;
  currency?: string;
  verification: 'verified' | 'unverified';
  dataKind: 'official_issuer' | 'official_exchange' | 'licensed_provider' | 'derived';
  definition: string;      // 무엇을 의미하는 수치인지
}
interface EtfProvider {
  resolve(symbol:string,market:string):Promise<EtfIdentity>;
  overview(id:EtfIdentity):Promise<Evidence<EtfOverview>>;
  aum(id:EtfIdentity):Promise<Evidence<Money>>;
  expenses(id:EtfIdentity):Promise<Evidence<ExpenseDisclosure[]>>;
  exchangeQuote(id:EtfIdentity):Promise<Evidence<Quote>>;
  priceRange52w(id:EtfIdentity):Promise<Evidence<Range52w>>;
  holdingsOrExposures(id:EtfIdentity):Promise<Evidence<Exposure[]>>;
}
```

### 6.3 AUM, NAV, 시장가격의 구분

- **AUM / 순자산총액**: 운용사 또는 공시의 ETF 자산 규모이며 회사의 **시가총액이 아니다**. 가치·통화·기준일·순/총자산 정의를 표시.
- **NAV / 기준가**: ETF 순자산가치 단위당 평가액. ETF 시장에서의 실제 체결/표시 가격과 다를 수 있다. NAV 데이터와 52주 ETF 거래가격을 하나의 가격 그래픽에 혼합 금지.
- **시장가격**: 거래소 상장 주식처럼 시장에서 매매되는 ETF 1주당 가격; 시세 지연/장중·종가 구분. 52주 저가·고가는 **시장가격 기준**으로 통일. 제공자 기준이 다르면 중단.
- **비용**: 한국 ETF `총보수`, `총보수·비용`, `합성총보수`, 미국 ETF `expense ratio` 등 용어를 정확히 구분. 시장별 표시 개념이 다르면 `총보수`로 단일 통합하지 않는다. 연율 여부 및 기준일 표시.
- **순자산 순위**: 공식 비교 모집단·산정일자·순위 값이 모두 확보될 때만. 비교 가능 데이터 없으면 아예 제외한다. 운영자가 임의 정렬해 `국내 ETF 1위`라 표시하지 않는다.

### 6.4 보유종목/섹터 규칙

- 보유목록은 *운용사가 발표한 ETF 실제 편입* 또는 *공식 벤치마크 비중* 중 어느 쪽인지 표시. 두 종류를 섞지 않는다.
- 상위 보유종목의 이름, 티커/ISIN, `weightPercent`, 기준일, 포함 대상(현금·파생상품·선물 등) 보존.
- 상위 5~10개의 합은 100%가 아닌 것이 일반적이다. 반드시 `기타/나머지 비중`을 별도로 표시하거나 `상위 N개만 표시`라고 명시.
- ETF 보유자료는 가격과 달리 일/월간으로 갱신될 수 있으므로 **각 소스의 기준일을 독립 표기**한다. 오래된 자료를 최신으로 표시 금지.
- 비중 합계 100% 근사 검증은 *전체 holdings 자료*가 있을 때만 시행. 일부 공개 정보로 전체 비중 검증 통과를 주장하지 말 것.
- 상품이 합성/파생/채권 등의 사유로 holdings가 공개되지 않거나 적합하지 않으면 `exposures` 카드로 전환하되 **전환 이유와 출처**를 표시한다.

### 6.5 투자자 오해 방지 규칙

장기투자 수익률을 52주 거래가격만으로 계산하지 않는다(분배금·분할·환율·추적 차이). `52주 저점 대비 상승`은 분배금 재투자를 포함한 총수익률이 아니다. 해외 ETF의 `USD` 거래가격을 별도의 검증 환율 없이 `KRW`로 바꾸지 않는다. 운용사에서 AUM을 USD로 표시했다면 기준일과 원통화를 유지한다. 운용 목표 지수명·환헤지 유무·레버리지 배수는 공식 안내문 확인.

## 7. 데이터 JSON 계약 (예시는 전부 미확인 데이터)

```json
{
  "schemaVersion":1,
  "jobId":"etf-example-uuid",
  "identity":{"assetType":"etf","symbol":"EXAMPLE","market":"NASDAQ","isin":null,"issuerName":"[검증 후 입력]","fundName":"[검증 후 입력]","currency":"USD","officialProductUrl":null},
  "facts":[
    {"factId":"aum","kind":"aum","value":null,"currency":"USD","asOf":null,"sourceUrl":null,"verification":"unverified"},
    {"factId":"annual_fee","kind":"expense_ratio","value":null,"definition":null,"asOf":null,"sourceUrl":null,"verification":"unverified"},
    {"factId":"holdings","kind":"holdings","items":[],"asOf":null,"sourceUrl":null,"verification":"unverified"}
  ]
}
```

> 위 값은 필드 설계 예시이지 실제 시세/ETF 상품이 아니다. 실제 실행에서는 `null`/`unverified` 필수 필드가 있으면 카드·원고 제작을 금지한다. 선택 항목은 생략할 수 있지만 명칭을 바꿔 거짓으로 채우지 않는다.

`assets.json` 기록: `{assetId,role,assetKind,relativePath,sourceUrl,sha256,width,height,asOf,capturedAt,generatedAt?,factIds,caption,licenseNote,reviewStatus}`. 필수 `requiredImageRoles('etf_five')` 배열 순서는 `etf_overview → aum_fee_card → etf_price_52w_card → holdings_sectors_card → etf_outlook_visual`.

`post.json`: 정확히 다섯 섹션/다섯 이미지, 글의 가격·AUM·보수·보유비중 수치마다 factId 연결. 출처 이름/기준일을 독자가 볼 수 있게 표시하고 URL은 내부 증빙에도 원문 그대로 보관.

## 8. 이미지별 렌더링 구현

**이미지 1 (`etf_overview`)**: 공식 상품 상세페이지 `product/fund/ETF` 영역 식별 → ETF 이름, 추종지수, 운용사 노출이 동시에 확인되는 영역을 스크린샷. 인증 후 화면이 나오더라도 약관에 어긋난 자동 캡처는 하지 않는다. 사이트가 자동화에 접근을 차단하면 지점별 URL/사용자 승인 후 합법적인 공식 PDF 자료로 대체하거나 정지. 원본 이미지 비율 유지.

**이미지 2 (`aum_fee_card`)**: AUM/기준일/통화, 총보수(해당 정의), 상품명/티커, 운용사, 출처. 시장이 허용하는 경우 보수와 AUM을 함께 표시. 순위는 원칙적으로 **표시하지 않음**; 예외는 검증된 공식 모집단 순위. 숫자는 SVG/sharp로 deterministic 렌더; AI 이미지 모델을 금융 숫자 생성에 사용하지 않음.

**이미지 3 (`etf_price_52w_card`)**: 해당 거래소 ETF 시장가격(종가 또는 공식 정의) 52주 저가/고가, 현재 시점 실제 가격(같은 기준), 범위 바. 분모 0·가격보정 불일치·해외 통화 혼용 차단. 데이터 제공자가 지정한 52주 기간과 마감 거래일 명시. 해당 수치로 총수익률을 암시하는 문구 금지.

**이미지 4 (`holdings_sectors_card`)**: 공식 편입 자료로 상위 5개 또는 10개 수평 막대; 나머지는 `기타`와 기준일. 필요 시 `sector` 또는 채권/원자재 `exposures` 모드 선택. 추종지수 비중을 ETF 실보유 비중으로 오인할 여지가 있으면 mode와 라벨을 변경하거나 중단. 가독성 위해 이름과 비중/원문을 매칭하는 자동테스트 필수.

**이미지 5 (`etf_outlook_visual`)**: 시장 테마 기반 실사형 콘셉트, 예: 기술 섹터 서버룸 / 채권 ETF 채권 서류·시장 이미지 / 글로벌 주식 지리적 연결 이미지. **실제 ETF 수익을 보여주는 사진이 아니며**, AI 생성 콘셉트 이미지를 명시. 비정상적으로 낙관적인 차트, 종목 로고 조합·운용사 보증 표현 금지. `ConceptImageProvider` 인터페이스로 이미지 모델 연결; 연결하지 못하면 임의의 생성 성공 주장 금지. 사용자 승인 대체(라이선스 확인된 테마 사진/텍스트 템플릿) 또는 `needs_user:concept_image_required`로 처리.

이미지 2~4는 같은 폰트/레이아웃 계열을 적용하고, 모든 텍스트가 1200x1200 안에 들어가는지 `sharp`·렌더 후 텍스트 레이아웃 검사를 수행한다. 실제 사이트 캡처 1번에 임의의 그래픽 요소를 삽입해 원본 증빙처럼 보이게 하지 않는다.

## 9. ETF 원고 기획 규칙

- 제목 후보 7개 중 사실 검증 가능한 최종 1개 선택; ETF 티커/정식명칭, 추종지수, AUM/보수·52주 가격 등 검증 내용만 활용.
- 초보자용 다섯 소제목과 다섯 이미지(정확히 1:1). 모바일 단락은 짧고 존댓말; 공백 포함 800~1,000자 기본, 사용자 지시 우선.
- ETF 핵심 용어는 바로 설명: `AUM = ETF가 운용하는 자산 규모`, `NAV = 기준가`, `편입 비중 = 포트폴리오 구성`; 실제 정의와 어긋나지 않게 말한다.
- 리스크 1개 이상 포함: 시장/환율/집중/금리/레버리지/추적/분배 등 상품 관련 위험만 선택.
- 과거 수익률이 미래 수익을 보장한다는 식의 문구 금지. 목표가·추천 타이밍 금지. `AI 생성 콘셉트 이미지`를 과거 거래/펀드 실제 운용 증거로 사용 금지.
- 네이버 업로드·저장 구조는 V10 검증 로직 유지; 기존 작성 글 복구 안내 자동 건너뛰기 금지, 저장 불확실 시 중복 클릭 금지.

## 10. CLI 단계·작업 폴더 예시

```powershell
pnpm install
pnpm test
pnpm typecheck
pnpm build
node dist/cli.js help
node dist/cli.js job:init --symbol <ETF티커> --market <NASDAQ|NYSE|KRX:KOSPI|KRX:KOSDAQ> --workspace-root "C:\\BlogProjects\\v12_etf\\workspaces"
node dist/cli.js source:inspect --job "<job 절대경로>"
node dist/cli.js collect:run --job "<job 절대경로>" --cdp http://127.0.0.1:9222 --profile "<Chrome 전용 profile 절대경로>"
node dist/cli.js collect:check --job "<job 절대경로>"
node dist/cli.js render:run --job "<job 절대경로>"
node dist/cli.js draft:check --job "<job 절대경로>"
node dist/cli.js draft:run --job "<job 절대경로>" --cdp http://127.0.0.1:9222 --profile "<Chrome 전용 profile 절대경로>"
node dist/cli.js draft:resume --job "<job 절대경로>" --cdp http://127.0.0.1:9222 --profile "<Chrome 전용 profile 절대경로>"
```

위 CLI 명령은 *구현 요구사항*이며 현재 실행 가능한 명령이라고 단정하지 않는다. 사용자는 국내/해외 티커와 기준일을 명시할 수 있어야 한다. 시간대는 KRX 거래소 시각/미국 거래소 시각 기준으로 자료를 저장하며 표시 기준일을 KST와 혼동하지 않는다.

```text
workspaces/etf-.../
  request.json source-hints.json facts.json assets.json post.json
  validation-report.json collection-checkpoint-*.json
  assets/{etf_overview,aum_fee_card,etf_price_52w_card,holdings_sectors_card,etf_outlook_visual}.png
  receipts/{source-review,images,draft-save}.json
```

종료코드: 0 정상, 2 검증 실패, 3 사용자 확인 필요, 4 임시저장 불확실. 소스 분류/기준일/파일 해시 변경 시 캐시 무효화. 실패해도 이미 확인된 부분 결과는 job 단위로 안전 저장하되 다른 ETF에 절대로 재사용하지 않는다.

## 11. 단계별 Codex 구현 로드맵

| 단계 | 구현 작업 | 완료 기준 |
|---|---|---|
| M0 | V10 읽기, 새 private v12_repo, AGENTS·테스트·빌드 설정 | 기존 V10/v11 수정 0건; 단독 빌드 가능 |
| M1 | ETF identity, type, 5 image roles, JSON 계약/검증 | 보수/AUM/NAV 혼동 방지 테스트 |
| M2 | 운용사 공식 상품 페이지·데이터 provider 인터페이스·날짜/출처 검증 | ETF 심볼/ISIN/운용사 충돌 감지 |
| M3 | 캡처 엔진 및 `etf_overview` | 공식 상품 화면/ETF 이름 식별·비율 확인 |
| M4 | `aum_fee_card`, `etf_price_52w_card` | 통화·가격유형·비용 정의 골든 테스트 |
| M5 | `holdings_sectors_card` / 유형별 exposures 분기 | 구성종목 날짜·비중·기타 처리 검증 |
| M6 | AI 테마 이미지 provider + 리스크 검수 | 이미지 출처/라벨·실패시 대체/중단 |
| M7 | 초보자용 5섹션 원고·V10 임시저장 로직 이식 | 5장 정확히 배치, 저장 목록 재검증 |
| M8 | 국내 ETF / 미국 ETF / 특수 ETF 실제 통합테스트 | 허용된 공식 소스로 수집·캡처·저장 구분 보고 |

**초기 구현은 M0~M5를 우선**한다. 먼저 예시/픽스처 기반 오프라인 테스트와 실제 수집 테스트의 차이를 문서화하고, 이후 M6~M8로 이동한다. AI 이미지 공급자/공식 데이터 부족을 조용히 숨기지 않는다.

## 12. 필수 실패·엣지 테스트

1. 동일 이름의 환헤지/비환헤지 상품, 레버리지/비레버리지 상품 혼동 → `needs_user`.
2. 운용사 제품 홈이 아닌 **운용사 회사 소개 메인**을 캡처 → 잘못된 1번 이미지로 거부.
3. ETF AUM을 주식 시가총액으로 표시 → schema/렌더 테스트 실패.
4. NAV 값을 52주 시장가격으로 넣음 / 한쪽은 USD 다른 쪽은 KRW → 이미지 생성 중단.
5. 총보수·총비용·expense ratio 정의가 다른데 하나로 합침 → 검증 실패.
6. 상위 5종목 비중 합계 43%인데 이를 전체 100% 원형 그래프로 표시 → 실패.
7. 보유종목 기준일은 두 달 전, 주가는 오늘인데 모두 오늘자로 표시 → 실패.
8. ETF 실제 편입목록과 기초지수 구성목록 섞음 → 실패.
9. 채권 ETF에 `상위 5개 회사 주식` 카드 강제 → type 전환/중단.
10. 월배당 ETF에 미래 분배금 수익 확정 표현 → 검증 실패.
11. AI 테마 사진을 진짜 펀드 자산/실제 운영 사진으로 표시 → 검수 실패.
12. 5장의 이미지 role/순서/해시/출처가 틀림 → `draft:run` 차단.
13. 저장 중 502·CDP 재연결·기존 글 복구 안내 → 중복 임시저장 방지, `draft_unconfirmed` 또는 `needs_user`.
14. API 요청 오류·차단/로그인 보안 확인/약관 위반 우려 → 합법 경로/수동 입력 요청, 우회 금지.

## 13. GitHub PRIVATE 저장소 생성 절차

```powershell
# 다른 작업을 덮어쓰지 말고 먼저 확인
 gh auth status
 gh repo view DS-8305/v12_etf
# 정말 미존재이고 인증이 허용된 경우에만 아래 실행
mkdir v12_etf
cd v12_etf
git init -b main
# Codex가 설계서/docs/AGENTS/README/프로젝트 설정 추가
 git add .
 git commit -m "chore: bootstrap v12 etf automation"
 gh repo create DS-8305/v12_etf --private --source=. --remote=origin --push
```

`gh repo view` 오류가 접근 거부·네트워크 문제일 때는 저장소 미존재로 간주하지 말 것. 사용자 승인 없이 공개 repo로 만들지 않는다. 소스코드만 커밋, 실제 시세 파일·로그인 쿠키·브라우저 profile·다운로드 이미지(사용권 미확인)는 `.gitignore`에 추가. 원본 V10 및 v11 저장소 원격 URL과 절대 경로를 덮어쓰지 않는다.

## 14. 인수 검증 체크리스트

- [ ] V10/v11 원본 저장소 변경 없음
- [ ] `v12_etf` 비공개·단독 설치/테스트/빌드
- [ ] `assetType=etf`·ETF identity·유형별 분기·시장/통화 확인
- [ ] `AUM ≠ 시총`, `NAV ≠ 시장가격`, `비용 종류` 자동 검증
- [ ] 공식 상품 상세 캡처 1장 + 데이터 이미지 3장 + 콘셉트 이미지 1장
- [ ] 출처 이름/URL·기준일·시각·보유자료 날짜·정의/단위 수집
- [ ] 고정 5섹션·5이미지·factIds 대응, 한국어 텍스트 깨짐 없음
- [ ] 일반 주식 ETF와 채권/특수 ETF에서 맞춤 카드 또는 안전 중단
- [ ] 수집/렌더/네이버 글쓰기 테스트 각각 PASS/FAIL/미실행 구분
- [ ] 임시저장 재열람 확인, 자동 공개발행 금지

## 15. 원본 코드 참조

- https://github.com/DS-8305/N_Blog_V10_Budong/tree/2b7f772bdf5817604a3019115a308d8265f962f4
- 캡처 및 검증: `src/capture/captureRegion.ts`, `readiness.ts`, `captureAsset.ts`, `src/editorial/assetValidation.ts`
- 세션/저장 안전: `src/browser/session.ts`, `src/automation/imageUploader.ts`, `draftRunner.ts`, `draftVerifier.ts`
- 수집 워크플로우: `src/collectors/collectJob.ts`, `src/collectors/sourceHints.ts`

**완료 조건:** 확인 가능한 공식 ETF 1개를 대상으로 정확한 5장 이미지·초보자용 원고·수집 출처·네이버 임시저장 검증까지 재현 가능한 상태. 출처 미확인 숫자를 채워서 외형상 완성된 것으로 보이게 하지 않는다.
