# ETF Automation Implementation Plan

**Goal:** ETF 데이터 검증, 5장 이미지·초보자 원고, 안전한 네이버 임시저장 CLI 구현.
**Architecture:** 독립 ETF 계약 + 명시적 공급자 + V10 범용 엔진 이식.
**Tech Stack:** Node >=22.12, pnpm 11.12.0, TypeScript, Playwright/CDP, sharp, Vitest.
**Spec:** docs/v12_etf_implementation_spec.md 및 docs/design.md.

## Global Constraints

- V10 원본 수정 금지. 실제 데이터·프로필·이미지 Git 제외.
- ETF 5 image roles 고정. 공백 포함 기본 원고 800~1,000자.
- 숫자 생성 금지. 자동 공개 발행 금지. 저장 불확실 중복 클릭 금지.
- 코드·원고 검증과 실제 사이트 검증을 구분한다.

## Review Focus

- 선행 0 코드, ETF 클래스/ISIN/운용사 충돌 거부.
- 혼합 통화, NAV 시세, 지수·ETF 편입 혼합 거부.
- 재시작 후 바뀐 소스·해시·저장 시도 중복 거부.
- 한글 긴 상품명/보유목록이 카드 밖으로 나가지 않도록 검사.
- 비공개 계정 세션·기존 원고/복구 안내 보호.

## Task 1: Contracts and validation

- [ ] Write and run failing tests for identity, source dates, AUM/fee/price/exposures contracts.
- [ ] Implement src/domain and job state; pnpm test/typecheck.

## Task 2: Collection and capture

- [ ] Write failing tests for missing providers, cross-fund binding, checkpoints and screenshot identity.
- [ ] Implement providers/collectors/capture and import V10 browser engine.

## Task 3: Rendering and editorial

- [ ] Write failing tests for actual PNGs, labels/weights, 5 sections, risks, tampered assets.
- [ ] Implement render and editorial; verify real 1200x1200 images and text bounds.

## Task 4: Draft and CLI

- [ ] Write failing tests for interrupted saves, no duplicate dispatch, receipts and CLI exit codes.
- [ ] Adapt V10 automation without sheet/apartment assumptions; implement every required command.
- [ ] Run full tests, typecheck, build, CLI smoke and fresh reviewer.
- [ ] Document live limitations and push tested source to requested main.
