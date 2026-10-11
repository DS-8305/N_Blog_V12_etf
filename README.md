# N_Blog_V12_etf

ETF 코드/시장 입력 → 출처 검증 → 공식 상품 캡처 + 데이터 카드 3장 + AI 콘셉트 1장 → 한국어 초보자 원고 → 네이버 SmartEditor 임시저장.

V10 main commit `2b7f772bdf5817604a3019115a308d8265f962f4`의 브라우저·캡처·임시저장 엔진을 ETF용으로 이식했습니다. V10/v11 런타임 의존성과 부동산 도메인 데이터는 없습니다. 사용자가 지정한 이 저장소 main이 대상이며 첨부 설계서의 별도 저장소 생성 지시보다 우선합니다.

## 설치와 검증

Windows 11, Node.js >=22.12, pnpm 11.12.0, 설치된 Chrome이 필요합니다.

```powershell
pnpm install --frozen-lockfile
pnpm test
pnpm typecheck
pnpm build
node dist/cli.js help
```

테스트는 가상 금융 자료와 격리된 headless Chrome을 사용합니다. 실제 운용사·네이버 계정에 입력하지 않습니다. 한글 카드 기본 폰트는 Windows 맑은 고딕입니다. 다른 OS는 ETF_CARD_FONT에 설치된 한글 폰트를 지정하세요.

## 실행

```powershell
node dist/cli.js job:init --symbol 069500 --market KRX:KOSPI --as-of 2026-10-09 --workspace-root C:\BlogProjects\etf\workspaces
# 출력된 절대 job 경로를 아래 --job에 넣으세요.
node dist/cli.js source:inspect --job C:\BlogProjects\etf\workspaces\etf-실제작업ID
```

지원 시장: NASDAQ, NYSE, NYSEARCA, CBOE, KRX:KOSPI, KRX:KOSDAQ. 국내 코드는 선행 0을 포함하는 6자리 문자열입니다. 기본 as-of는 실행일 KST 날짜이고, 실제 시세 시각은 거래소 시간대로 별도 보존합니다. 필요하면 --issuer/--isin으로 상품을 추가 고정합니다.

먼저 [공급자 계약](docs/provider-contract.md)에 따라 job/source-hints.json과 수집 endpoint 또는 검토된 incoming.json을 설정하세요. 기본 제공 실시간 ETF API/검색 어댑터는 없습니다. 공급자 미설정·미확인 수치·상품 혼동은 needs_user로 멈춥니다. 운영자는 원자료와 라이선스를 확인해야 합니다.

```powershell
node dist/cli.js collect:run --job C:\BlogProjects\etf\workspaces\etf-실제작업ID
node dist/cli.js collect:check --job C:\BlogProjects\etf\workspaces\etf-실제작업ID
# 데이터 카드 세 장만 먼저 확인할 때
node dist/cli.js render:cards --job C:\BlogProjects\etf\workspaces\etf-실제작업ID
```

공식 상품 캡처와 네이버 임시저장은 사용자가 로그인한 전용 Chrome CDP 세션을 연결합니다. 일반 사용 프로필을 복사하지 마세요. 아래 전용 프로필에서 네이버 로그인을 직접 완료하세요.

```powershell
Start-Process -FilePath 'C:\Program Files\Google\Chrome\Application\chrome.exe' -WindowStyle Hidden -ArgumentList '--remote-debugging-port=9222','--user-data-dir=C:\BlogProjects\etf\browser-profile'
node dist/cli.js render:run --job C:\BlogProjects\etf\workspaces\etf-실제작업ID --cdp http://127.0.0.1:9222 --profile C:\BlogProjects\etf\browser-profile
node dist/cli.js draft:check --job C:\BlogProjects\etf\workspaces\etf-실제작업ID
node dist/cli.js draft:run --job C:\BlogProjects\etf\workspaces\etf-실제작업ID --cdp http://127.0.0.1:9222 --profile C:\BlogProjects\etf\browser-profile
node dist/cli.js draft:resume --job C:\BlogProjects\etf\workspaces\etf-실제작업ID --cdp http://127.0.0.1:9222 --profile C:\BlogProjects\etf\browser-profile
```

원고만 재컴파일하려면 post:compile --job PATH를 사용합니다. 숫자·문구는 사실 계약에서 결정되는 템플릿이며 임의 편집은 저장 검증에서 거부합니다. 기본 본문 목표는 800~1,000자입니다. 긴 상품명/위험 고지 때문에 초과하면 경고를 남기고 필수 설명을 보존합니다. 사용자 길이 선호는 job:init의 --min-length/--max-length로 지정합니다.

## 저장 보호와 결과

항상 소제목 → 설명 → 해당 이미지 순서로 다섯 섹션을 배치합니다. 공식 화면 비율을 유지하며 카드/콘셉트는 1200×1200 PNG입니다. AUM/보수, 시장가격/NAV, ETF 편입/벤치마크 구성을 구분합니다. 모든 수치의 독립 출처·기준일은 원고 하단에도 표시합니다.

임시저장만 지원합니다. 공개 발행 버튼을 누르는 경로는 없습니다. 기존 작성 내용·복구 안내가 있으면 사용자 확인을 요청합니다. 저장 시도를 디스크에 먼저 기록하며, 502/CDP 오류 등 저장 불확실 상태에서는 재실행해도 다시 입력/저장하지 않습니다. 저장목록의 고유 제목을 열어 원고·5장·캡션·출처가 일치해야 draft_saved를 기록합니다. 복구 안내를 직접 처리한 뒤 같은 Chrome 세션에서 draft:resume을 실행하세요.

| 코드 | 상태 |
|---|---|
| 0 | 해당 단계 완료 |
| 2 | 데이터/자산/원고/명령 검증 실패 |
| 3 | 공급자·이미지·상품 정체성·로그인 등 사용자 조치 필요 |
| 4 | 임시저장 불확실, 확인만 가능 |

job에는 request/source-hints/facts/assets/post/validation-report, collection-checkpoint, assets.partial, source-review 및 입력/저장 증거가 남습니다. workspaces/.runtime/browser-profile/.env는 Git에서 제외합니다. endpoint/profile/job 잠금 파일은 비정상 종료 후 자동 삭제하지 않습니다. 프로세스가 종료됐고 저장 상태를 확인한 후 해당 작업의 잠금만 직접 정리하세요.

[데이터 정의](docs/etf-data-definitions.md) · [설계](docs/design.md) · [명세](docs/v12_etf_implementation_spec.md) · [검증 범위](docs/validation.md)
