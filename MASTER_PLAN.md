# Mindmap MVP Master Plan

> 문서 버전: 1.1  
> 작성일: 2026-08-18  
> 목표: 마인드맵 구조 작성 → 노드별 Markdown 기록 → 안정적인 저장·재접속 → Markdown 내보내기가 실제로 동작하는 First Usable Version 완성

## 운영 규칙

- 단계 번호와 의미는 고정한다. 새 작업은 기존 번호를 바꾸지 않고 하위 번호나 새 번호로 추가한다.
- `N번 실행해`는 `0N` 전체를 뜻한다. 요청받은 단계만 수행하고 다음 단계는 자동 실행하지 않는다.
- 시작 시 `🟡 IN_PROGRESS`, 구현과 필수 검증 성공 후에만 `✅ DONE`, 제품 결정이나 필수 환경 때문에 진행할 수 없으면 `🔴 BLOCKED`로 표시한다.
- 미검증 항목은 성공으로 간주하지 않고 `NOT VERIFIED` 사유와 필요한 검증을 기록한다.
- 우선순위는 확정 PRD → 확정 화면 구성안 → 확정 개발 설계안 → 현재 코드 → 기술 관례이다.
- 구현 중 발견한 결정과 차이는 `Decision Log`, `Surprises & Discoveries`에 누적한다.

## Source of Truth

1. `docs/01.reference/mindmap_mvp_prd_confirmed.md`
2. `docs/01.reference/마인드맵_MVP_화면구성안_확정반영.md`
3. `docs/01.reference/마인드맵_웹앱_MVP_개발_설계안_확정반영.md`
4. `docs/01.reference/*.png` 7개 — 시각 참고용이며 PRD 밖 기능은 제외

## 목표 아키텍처

- Next.js App Router + TypeScript 단일 풀스택 애플리케이션
- PostgreSQL + Prisma migration, 로컬 PostgreSQL은 Docker Compose로 재현
- DB 기반 opaque session과 HttpOnly/SameSite cookie, `bcryptjs`, Zod
- TanStack Query로 server state, React local state/custom hook으로 UI/editing state
- `@xyflow/react` 캔버스, controlled textarea + `react-markdown`/`remark-gfm`
- Tailwind CSS와 최소 공통 UI, 접근성이 필요한 복합 UI는 Radix Primitive
- Vitest/Testing Library, DB integration test, Playwright E2E, ESLint, TypeScript, production build

---

## 01. 프로젝트 기반 및 로컬 실행 환경 구성 — 🟡 IN_PROGRESS

### Goal

개발자가 문서화된 절차로 애플리케이션과 PostgreSQL을 실행하고 기본 화면과 health 응답을 확인할 수 있다.

### Dependencies

- 없음

### Implementation

- Next.js App Router, TypeScript strict, npm scripts, 환경 변수 예시, Docker Compose PostgreSQL을 구성한다.
- `src/app`, `src/features`, `src/shared`, `src/server`, `tests` 기반 구조를 만든다.
- ESLint, Vitest, Testing Library, Playwright, Tailwind CSS를 설정한다.
- 전역 스타일, 디자인 token, 최소 App Shell 및 loading/error/not-found 경계를 만든다.
- 실행·DB·검증 절차를 `README.md`에 작성한다.

### Backend

- `GET /api/health` JSON endpoint와 환경 변수 validation 기반을 만든다.

### Frontend

- `/`에 제품 기능 placeholder가 아닌 프로젝트 준비 상태 App Shell을 표시한다.

### Validation

- `npm install`
- `docker compose config`
- `npm run lint`
- `npm run typecheck`
- `npm run test`
- `npm run build`
- 개발 서버 `/` 렌더링과 `/api/health` 200 응답을 실제 브라우저에서 확인

### Definition of Done

- README 절차로 DB와 앱을 실행할 수 있다.
- lint, typecheck, test, production build가 성공한다.
- 실제 브라우저에서 기본 화면과 health API가 정상 동작한다.

### Execution Record (2026-08-18)

PASS

- Node.js `24.13.1`, npm `11.8.0` 확인
- `npm install`: 465 packages, 알려진 취약점 0개
- `npm run lint`: 오류·경고 없이 통과
- `npm run typecheck`: 통과
- `npm run test`: 3 files, 4 tests 통과
- `npm run build`: Next.js `16.3.1` production build 통과
- 개발 서버 `/api/health`: HTTP 200 및 `{ status: "ok" }` 확인
- `npm run test:e2e`: Playwright Chromium 1 test 통과(`/` 실제 렌더링과 health API)
- `compose.yaml`: Python YAML parser로 문법 파싱 성공

NOT VERIFIED

- 사유: 현재 실행 환경에 Docker CLI/daemon이 설치되어 있지 않음
- 필요한 검증: Docker 설치 환경에서 `docker compose config`, `docker compose up -d postgres`, `docker compose ps` 및 PostgreSQL health 확인
- 영향: DB 실행 절차까지 검증해야 하는 Definition of Done을 충족하지 못해 01 상태를 `🟡 IN_PROGRESS`로 유지
- 참고: 인앱 Browser 인스턴스는 제공되지 않았으나 실제 Chromium 검증은 저장소의 Playwright E2E로 통과

---

## 02. 영속 데이터 모델·Migration·Repository 계층 — ⬜ TODO

### Goal

User, Session, Mindmap, Node를 관계·제약·transaction과 함께 안전하게 저장할 수 있다.

### Dependencies

- 01

### Implementation

- Prisma schema/migration, DB client, repository/service, 공통 domain error를 만든다.

### Backend

- User, Session, Mindmap(sequenceNo), Node(parentNodeId, contentMd, x/y, isCollapsed, revision)를 정의한다.
- 사용자별 sequence unique, Mindmap별 root 하나, trim 후 빈 제목 금지, 관계 index를 적용한다.
- `MAX(sequenceNo)+1`과 Mindmap/root 생성을 동시성 안전한 단일 transaction으로 처리한다.

### Frontend

- 없음.

### Validation

- 빈 DB migration, 관계/제약/repository integration test, rollback과 동시 생성 test, lint/typecheck/test/build.

### Definition of Done

- migration으로 DB가 재현되고 sequence/root/제약/transaction test가 통과한다.

---

## 03. 회원가입·로그인·로그아웃 및 접근 제어 — ⬜ TODO

### Goal

사용자가 가입·로그인·로그아웃하고 비로그인·타 사용자는 개인 데이터에 접근하지 못한다.

### Dependencies

- 01, 02

### Implementation

- 인증 service/API, session cookie, S01 화면, protected route guard를 구현한다.

### Backend

- `POST /api/auth/signup|login|logout`, `GET /api/auth/session`; 이메일 정규화, 비밀번호 hash, 세션 만료·폐기, Origin 검증, 일관된 오류를 구현한다.

### Frontend

- 로그인/회원가입 탭, controlled validation, 오류·제출 상태, redirect와 사용자 menu/logout을 구현한다.

### Validation

- auth unit/integration, route/API 접근 제어, cookie 속성, 사용자 격리, Playwright 가입→로그인→로그아웃, lint/typecheck/test/build.

### Definition of Done

- 인증 흐름이 실제 브라우저에서 동작하고 비로그인·만료·타 사용자 접근이 차단된다.

---

## 04. Dashboard와 Mindmap 생성·목록·이름 변경 — ⬜ TODO

### Goal

사용자가 최근 수정순 목록을 보고 새 Mindmap을 즉시 만들어 Editor로 이동하며 이름을 변경할 수 있다.

### Dependencies

- 03

### Implementation

- Dashboard, empty/list/card/menu/inline title과 Mindmap API를 구현한다.

### Backend

- `GET/POST /api/mindmaps`, `PATCH /api/mindmaps/:id`; node count, 소유권, 빈 제목, sequence/root transaction을 검증한다.

### Frontend

- 제목·수정일·node 수, `+ 새 마인드맵`, 생성 후 root 식별자를 포함한 Editor 이동, Enter/blur/Esc inline edit를 구현한다.
- 검색·폴더·즐겨찾기·공유 등 시안의 MVP 밖 기능은 제외한다.

### Validation

- API 격리/정렬/count/sequence/validation test, Dashboard 상태와 keyboard component test, 생성→이동→복원 E2E, lint/typecheck/test/build.

### Definition of Done

- 사용자별 목록과 즉시 생성·이름 변경이 새로고침 후에도 정확하다.

---

## 05. Mindmap Editor 조회·React Flow 캔버스 기반 — ⬜ TODO

### Goal

사용자가 root/child/edge를 보고 선택·Pan·Zoom·Fit View로 탐색할 수 있다.

### Dependencies

- 04

### Implementation

- 상세 API, React Flow adapter/custom node/edge, Editor layout과 loading/error 경계를 구현한다.

### Backend

- `GET /api/mindmaps/:id`가 소유권 확인 후 필요한 Mindmap/node DTO만 반환한다.

### Frontend

- 상단 bar, node/edge, 선택 강조, Pan/Zoom/Fit View를 구현하고 신규 root 편집 focus 신호를 보존한다.

### Validation

- DTO adapter, API 소유권/integrity, canvas component, 실제 브라우저 탐색 E2E, lint/typecheck/test/build.

### Definition of Done

- DB 관계·좌표가 캔버스에 정확히 표시되고 직접 URL 접근도 보호된다.

---

## 06. Node 생성과 제목 편집 규칙 — ⬜ TODO

### Goal

root와 child 제목을 즉시 편집하고 자식을 연속 추가한 결과가 재접속 후 유지된다.

### Dependencies

- 05

### Implementation

- Node create/title API, 형제 겹침을 줄이는 기본 위치, inline editor와 `[+]`를 구현한다.

### Backend

- `POST /api/mindmaps/:id/nodes`, `PATCH /api/nodes/:id`; 부모 동일 Mindmap, 소유권, 제목/좌표, revision을 검증한다.

### Frontend

- root 생성 직후 focus, child 생성 직후 Edit Mode, Enter 확정/Esc 취소/double click 재편집, 빈 값 복원을 구현한다.

### Validation

- 위치/validation unit test, API 관계·권한·revision test, IME 포함 keyboard component test, root→다단계 child→reload E2E.

### Definition of Done

- 빈 제목이 저장되지 않고 tree와 제목이 reload 후 복원되며 오래된 응답이 최신 값을 덮지 않는다.

---

## 07. Node 자유 이동·위치 저장·접기/펼치기 — ⬜ TODO

### Goal

사용자가 node를 자유 배치하고 subtree를 접으며 두 상태를 재접속 후 복원할 수 있다.

### Dependencies

- 06

### Implementation

- position/collapse API, mutation hook, visible subtree/edge selector를 구현한다.

### Backend

- `PATCH /api/nodes/:id/position|collapse`; 좌표/boolean/revision/소유권과 Mindmap updatedAt transaction을 처리한다.

### Frontend

- drag 중 local update, Drag End 1회 저장, 실패 유지/retry, descendant 렌더 제외와 현재 표시 node Fit View를 구현한다.

### Validation

- tree selector, API revision/권한, drag 호출 횟수, drag/collapse→reload E2E, lint/typecheck/test/build.

### Definition of Done

- drag가 부모를 바꾸지 않고 좌표만 저장하며 collapse와 좌표가 복원된다.

---

## 08. Node 상세 Markdown 패널·미리보기·전체화면 — ⬜ TODO

### Goal

선택 node의 Markdown을 패널에서 작성·미리보기하고 전체화면 왕복 후 canvas 상태를 유지한다.

### Dependencies

- 06

### Implementation

- content API, controlled node별 draft, S04 panel, edit/preview, S05 overlay, 안전한 Markdown renderer를 구현한다.

### Backend

- `PATCH /api/nodes/:id/content`; content 크기/revision/소유권을 검증하고 Mindmap updatedAt을 갱신한다.

### Frontend

- node 선택 및 `[상세]`로 panel을 열고 raw HTML 비활성 preview, node별 draft 격리, fullscreen overlay와 focus 복원을 구현한다.

### Validation

- Markdown/XSS, content API, A/B draft 격리, panel/fullscreen 상태 보존 E2E, lint/typecheck/test/build.

### Definition of Done

- Markdown이 안전하게 렌더링되고 node별 draft와 selected node/viewport/zoom이 유지된다.

---

## 09. 통합 자동저장·저장 상태·실패 복구 — ⬜ TODO

### Goal

변경이 정책별 시점에 저장되고 최신 수정이 우선하며 실패해도 draft를 유지·재시도할 수 있다.

### Dependencies

- 07, 08

### Implementation

- `idle/dirty/saving/saved/failed` state machine, mutation coordinator, node별 local draft journal을 구현한다.

### Backend

- revision/error envelope을 통일하고 오래된 mutation은 409로 거부한다.

### Frontend

- Markdown 2초 debounce, 제목 확정/Drag End/collapse 즉시 저장, client sequence, close/navigation flush, 실패 retry와 draft 복구를 구현한다.

### Validation

- fake timer/out-of-order/retry test, 저장 상태 component test, network 실패→복구→reload E2E, lint/typecheck/test/build.

### Definition of Done

- 실제 응답 기반 상태가 보이고 실패·순서 역전·전환에도 최신 draft가 유실되지 않는다.

---

## 10. Mindmap·Node 삭제 확인과 안전한 Subtree 삭제 — ⬜ TODO

### Goal

삭제 영향을 확인한 뒤 일반 node subtree 또는 Mindmap을 삭제하며 root는 보호된다.

### Dependencies

- 04, 06, 09

### Implementation

- 공통 DeleteConfirmModal variant, descendant count, 삭제 후 cache/selection/draft 정리를 구현한다.

### Backend

- `DELETE /api/mindmaps/:id`, `DELETE /api/nodes/:id`; recursive subtree transaction, root/타 사용자 거부, 삭제 count를 구현한다.

### Frontend

- 대상·영향 수, 취소/삭제, focus trap, 중복 방지; root에는 삭제 menu를 노출하지 않는다.

### Validation

- leaf/deep/sibling/rollback/root/권한 integration, modal accessibility, node/Mindmap 삭제 E2E, lint/typecheck/test/build.

### Definition of Done

- 표시 영향과 실제 삭제 수가 일치하고 root·sibling·타 사용자 데이터가 보호된다.

---

## 11. 범위별 Markdown 내보내기 — ⬜ TODO

### Goal

전체, 현재 node, 현재 node+subtree를 UTF-8 `.md`로 다운로드할 수 있다.

### Dependencies

- 09, 10

### Implementation

- export service/API, ExportModal, 안전한 Blob download를 구현한다.

### Backend

- `POST /api/mindmaps/:id/export`의 `ALL|NODE|SUBTREE`; snapshot 조회, tree/경로/title/content, 안전한 filename/content headers를 구현한다.

### Frontend

- Dashboard/Editor 기본 `ALL`, node 진입 기본 `SUBTREE`, 포함 정보, 오류/retry를 구현한다.

### Validation

- 세 scope golden test, 한글/빈 content/깊은 tree, API 권한/header, 실제 파일 E2E, lint/typecheck/test/build.

### Definition of Done

- 세 범위가 정확하며 UTF-8 Markdown 구조·경로·본문이 보존되고 UI 전용 정보는 제외된다.

---

## 12. 1,000 Node 성능·보안 회귀·최종 E2E 인수 — ⬜ TODO

### Goal

전체 흐름과 사용자 격리, 1,000 node 성능 목표를 실제 환경에서 검증한 배포 가능한 PoC가 된다.

### Dependencies

- 01~11

### Implementation

- 1,000 node fixture/계측, 실제 측정에 따른 최소 query/index/render 최적화, 전체 E2E와 README 마감을 수행한다.

### Backend

- 상세 조회/subtree 삭제/autosave/export 시간·query·메모리와 전 API 인증/권한/validation을 회귀 검증한다.

### Frontend

- 최초 가시 영역 2초 목표, 사용 가능 화면 5초 상한, 불필요 rerender, keyboard/focus/error/loading을 검증한다.

### Validation

- lint/typecheck/unit/component/integration/E2E/build, production 실행, Final Acceptance Criteria, 성능 수치 기록.

### Definition of Done

- 모든 검사가 성공하고 5초 상한을 충족하며 미검증 핵심 항목이나 placeholder가 없다.

---

## Progress

| 단계 | 상태 | 요약 |
|---|---|---|
| 01 | 🟡 IN_PROGRESS | 프로젝트 기반과 로컬 실행 환경 |
| 02 | ⬜ TODO | 데이터 모델·Migration·Repository |
| 03 | ⬜ TODO | 인증 및 접근 제어 |
| 04 | ⬜ TODO | Dashboard·Mindmap 생성/목록/이름 |
| 05 | ⬜ TODO | Editor 조회·캔버스 |
| 06 | ⬜ TODO | Node 생성·제목 편집 |
| 07 | ⬜ TODO | 이동·접기/펼치기 |
| 08 | ⬜ TODO | Markdown 상세 UI |
| 09 | ⬜ TODO | 자동저장·실패 복구 |
| 10 | ⬜ TODO | 안전한 삭제 |
| 11 | ⬜ TODO | Markdown 내보내기 |
| 12 | ⬜ TODO | 성능·보안·최종 인수 |

## Decision Log

| 날짜 | 단계 | 결정 | 이유 |
|---|---|---|---|
| 2026-08-18 | 계획 | Next.js 단일 풀스택 | 빈 저장소 PoC의 배포·타입·운영 단순화 |
| 2026-08-18 | 계획 | PostgreSQL + Prisma | tree, transaction, index, 동시 생성 관리 |
| 2026-08-18 | 계획 | DB opaque session | 서버가 만료·폐기하고 민감정보를 cookie에 노출하지 않기 위함 |
| 2026-08-18 | 계획 | React Flow | 확정 문서 1순위이며 필요한 캔버스 상호작용 제공 |
| 2026-08-18 | 계획 | TanStack Query + local state | server/UI/editing 상태 분리와 과도한 전역 상태 회피 |
| 2026-08-18 | 계획 | textarea + react-markdown | controlled-first, 작은 MVP 의존성, 안전한 preview |
| 2026-08-18 | 계획 | revision + client sequence | 오래된 autosave 응답의 최신 draft 덮어쓰기 방지 |
| 2026-08-18 | 계획 | 1,000 node는 성능 fixture | PRD상 상품 생성 제한이 아니라 관리 목표임 |
| 2026-08-18 | 01 | 실제 설치 버전을 package-lock으로 고정 | Next.js 16.3.1, React 19.2.8, TypeScript 5.9.3 등 검증된 dependency tree를 재현하기 위함 |
| 2026-08-18 | 01 | health endpoint는 DB 비의존 liveness로 구성 | 02단계 DB 계층 도입 전에도 app process 상태를 독립적으로 진단하기 위함 |

## Surprises & Discoveries

- 최초 조사 시 소스·package·Git 없이 참조 문서와 이미지뿐이었다.
- 2026-08-18 01 실행 시작 시 이전 턴에서 작성된 `MASTER_PLAN.md`가 작업공간에 존재하지 않아 대화에서 확정한 12단계 계획을 v1.1로 복구했다.
- 현재 환경에는 Docker가 없어 Compose/PostgreSQL 실행 검증을 완료하지 못했다. YAML 문법은 별도로 확인했지만 Docker 검증으로 간주하지 않는다.
- 인앱 Browser 연결 대상이 없어서 해당 표면으로 확인하지 못했으며, 설치한 Playwright Chromium의 실제 브라우저 E2E로 화면과 health API를 검증했다.
- PowerShell 실행 정책상 `npm.ps1`을 실행할 수 없어 동일 npm CLI의 `npm.cmd`를 사용했다.
- UI 이미지의 검색·공유·폴더·즐겨찾기·실행취소·스타일 등은 확정 PRD 밖이므로 구현하지 않는다.
- 1,000 node 부분 로딩 범위는 미확정이므로 먼저 단순 조회를 계측하고 목표 미달 시에만 추가한다.
- browser/tab 강제 종료 직전 네트워크 성공은 보장할 수 없어 서버 성공을 거짓 표시하지 않고 local draft로 위험을 낮춘다.

## Deferred

- AI, 협업·공유, 검색, 폴더, Favorite, 최근 열람, Trash
- 자동 레이아웃, 부모 변경, 실행취소/재실행, node style
- 이미지/파일 첨부, PNG/PDF, Import, Version History
- Template, 알림, 도움말, 요금제/사용량, 모바일 전용 Editor UX

## Final Acceptance Criteria

1. 비로그인 protected 접근은 로그인으로 이동한다.
2. 사용자 A가 가입/로그인해 빈 Dashboard를 본다.
3. 새 Mindmap은 정확한 `N`과 `시작` root를 transaction으로 만들고 Editor로 이동한다.
4. root가 즉시 focus되어 Enter/Esc/double click 규칙으로 편집된다.
5. 다단계 child 생성·수정·이동·collapse가 reload 후 복원된다.
6. Markdown panel/preview/fullscreen이 동작하고 canvas 상태가 유지된다.
7. Markdown은 2초 debounce 저장되고 실패 시 draft와 retry가 유지된다.
8. 재접속 시 마지막 성공 저장 상태가 복원된다.
9. node subtree/Mindmap 삭제는 영향 확인 후 동작하며 root는 삭제할 수 없다.
10. ALL/NODE/SUBTREE UTF-8 Markdown export가 구조·경로·본문을 보존한다.
11. 사용자 B는 A의 모든 리소스를 조회·수정·삭제·export할 수 없다.
12. 1,000 node 최초 가시 영역 2초 목표와 사용 가능 화면 5초 상한을 검증한다.
13. lint, typecheck, unit/component/integration/E2E, production build가 모두 성공한다.
