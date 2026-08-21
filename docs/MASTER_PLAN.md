# Mindmap MVP Master Plan

> 문서 버전: 1.1  
> 작성일: 2026-08-18  
> 최종 수정일: 2026-08-19  
> 현재 저장소 상태: Next.js 실행 기반과 Prisma 영속 계층 구현 완료, 제품 기능 구현 진행 전  
> 목표: 개인용 마인드맵 작성, 노드별 Markdown 기록, 안정적 저장·복원, 범위별 Markdown 내보내기가 실제로 동작하는 First Usable Version 완성

## 운영 규칙

- 이 문서의 단계 번호와 의미는 고정한다. 새 작업이 필요하면 기존 번호를 바꾸지 않고 하위 번호 또는 새 번호를 추가한다.
- 사용자가 `N번 실행해`라고 하면 `0N` 단계 전체를 뜻한다. 하위 번호를 지정하면 해당 하위 작업만 대상으로 한다.
- 단계 시작 전에 이 문서와 실제 저장소를 다시 확인하고 상태를 `🟡 IN_PROGRESS`로 바꾼다.
- 01~11은 기능 구현 단계다. 코드, unit/component test, lint, typecheck, build 등 현재 환경에서 실행 가능한 단계별 검증이 성공한 뒤 `✅ DONE`으로 바꾼다.
- 실제 PostgreSQL이 필요한 integration/E2E/성능 검증은 test를 먼저 작성하되 실행 환경이 없으면 `NOT VERIFIED`로 누적하고, 기능 단계 진행을 막지 않는다.
- 12는 최종 통합·배포 준비 단계다. 누적된 `NOT VERIFIED`를 실제 PostgreSQL 환경에서 모두 실행하고 성공해야만 `✅ DONE`으로 바꾼다.
- 검증하지 못한 항목은 성공으로 간주하지 않고 `NOT VERIFIED` 사유와 필요한 검증을 해당 단계에 남긴다.
- 선행 기능 코드가 없거나 제품 정책 결정이 필요해 진행할 수 없으면 `🔴 BLOCKED`로 표시한다. Docker/로컬 DB 부재만으로 01~11을 차단하지 않는다.
- 요청받은 단계만 수행하고 다음 번호는 자동으로 시작하지 않는다.
- 확정 PRD → 확정 화면 구성안 → 확정 개발 설계안 → 현재 코드 → 일반 기술 관례 순으로 판단한다.
- 구현 중 확인된 중요한 결정·제약·문서와 코드의 차이는 하단 `Decision Log`와 `Surprises & Discoveries`에 누적한다.

## Source of Truth

1. `docs/01.reference/mindmap_mvp_prd_confirmed.md`
2. `docs/01.reference/마인드맵_MVP_화면구성안_확정반영.md`
3. `docs/01.reference/마인드맵_웹앱_MVP_개발_설계안_확정반영.md`
4. `docs/01.reference/ChatGPT Image ... (1)~(7).png` — 시각적 방향 참고용이며, 확정 PRD 범위를 넘는 요소는 구현 근거로 사용하지 않는다.

## 목표 아키텍처

- 단일 TypeScript 저장소의 Next.js App Router 풀스택 애플리케이션으로 구성한다. 별도 API 서버를 두지 않고 Route Handler 아래에 HTTP API를 둔다.
- PostgreSQL과 Prisma를 사용한다. schema, migration, seed와 DB integration test를 코드로 먼저 완성하고 Docker Compose 실행·통합 검증은 12에서 수행한다.
- 인증은 이메일·비밀번호와 DB 기반 불투명 세션 토큰을 사용한다. 브라우저에는 `HttpOnly`, `SameSite=Lax`, 운영 환경 `Secure` 쿠키만 저장하고 DB에는 토큰 원문이 아닌 해시를 저장한다.
- 서버 입력 검증은 Zod, 비밀번호 해시는 `bcryptjs`를 사용한다. 모든 Mindmap/Node 쿼리는 로그인 사용자 소유권 조건을 포함한다.
- 서버 상태는 TanStack Query, 편집 draft와 화면 상태는 React local state/custom hook으로 시작한다. 실제 복잡성이 확인되기 전에는 전역 상태 라이브러리를 추가하지 않는다.
- 캔버스는 `@xyflow/react`, Markdown 입력은 controlled `textarea`, 렌더링은 `react-markdown` + `remark-gfm`을 사용한다. 전용 WYSIWYG 편집기는 MVP 범위에서 제외한다.
- UI는 Tailwind CSS와 최소 공통 컴포넌트로 만들며 Modal/Dropdown/Tabs처럼 접근성 처리가 어려운 요소만 Radix Primitive를 활용한다.
- 검증은 Vitest + Testing Library, API/DB integration test, Playwright E2E, ESLint, TypeScript, production build로 구성한다.

## 기능 우선 실행 전략

- 01~02는 이후 기능이 의존하는 코드 기반이며, 현재 작성된 schema/migration/repository와 정적·unit 검증을 기준으로 완료 처리한다.
- 03~11은 Backend API와 Frontend 사용자 흐름을 함께 구현한다. DB가 없어도 validation, service, DTO, UI 상태와 상호작용은 unit/component test로 검증한다.
- DB integration test와 Playwright E2E는 각 단계에서 시나리오와 test code를 작성해 회귀 범위를 고정한다. 실행 불가 결과는 아래 `Infrastructure Validation Backlog`에 누적한다.
- 12에서 PostgreSQL 실행 방식을 확정한다. Docker가 가능하면 기존 Compose를 사용하고, 불가능하면 동일한 PostgreSQL 17 호환 환경을 준비한다. 배포 방식 결정은 제품 기능 구현을 선행 차단하지 않는다.
- 이 전략은 검증을 생략하는 것이 아니라 실행 시점을 분리하는 것이다. 전체 MVP 완료 판정은 실제 DB 저장·재접속·권한 격리·export E2E까지 성공한 뒤에만 가능하다.

---

## 01. 프로젝트 기반 및 로컬 실행 환경 구성 — ✅ DONE

### Goal

개발자가 문서화된 절차로 애플리케이션을 실행하고, 브라우저에서 기본 화면과 서버 health 응답을 확인할 수 있다. PostgreSQL 실제 기동은 12에서 검증한다.

### Dependencies

- 없음

### Implementation

- Next.js App Router + TypeScript 프로젝트, npm script, 환경 변수 예시, Docker Compose PostgreSQL을 구성한다.
- Feature 기반 기본 구조를 만든다: `src/app`, `src/features/auth`, `src/features/dashboard`, `src/features/mindmap`, `src/shared`, `src/server`.
- ESLint, TypeScript strict mode, Vitest, Testing Library, Playwright 기본 설정을 추가한다.
- Tailwind 전역 스타일, 색상·간격·타이포그래피 토큰, 최소 App Shell을 만든다.
- 로컬 실행, 환경 변수, DB 기동, 검사 명령을 `README.md`에 기록한다.
- 예상 파일: `package.json`, `next.config.*`, `tsconfig.json`, `eslint.config.*`, `vitest.config.*`, `playwright.config.*`, `compose.yaml`, `.env.example`, `src/app/**`, `src/shared/styles/**`, `README.md`.

### Backend

- `GET /api/health`가 애플리케이션 상태를 JSON으로 반환하도록 한다.
- 환경 변수 누락 시 시작 또는 최초 서버 접근에서 이해 가능한 오류가 나도록 env schema를 둔다.

### Frontend

- `/`에 임시 App Shell을 표시하되 제품 기능 placeholder를 만들지는 않는다.
- 전역 error/loading/not-found 경계를 위한 기본 파일을 마련한다.

### Validation

- `npm install`
- `docker compose config`
- `npm run lint`
- `npm run typecheck`
- `npm run test`
- `npm run build`
- 개발 서버에서 `/` 렌더링과 `/api/health` 200 응답 확인

### Definition of Done

- 새 환경에서 README 절차대로 앱을 실행할 수 있고 DB 실행 구성이 코드로 존재한다.
- lint, typecheck, 빈 기반 test suite, production build가 성공한다.
- 실제 브라우저에서 기본 화면이 열리고 health API가 정상 응답한다.

---

## 02. 영속 데이터 모델·Migration·Repository 계층 구현 — ✅ DONE

### Goal

사용자, 세션, 마인드맵, 트리 노드를 안전하게 저장하고 트랜잭션으로 조회·변경할 수 있는 서버 기반이 생긴다.

### Dependencies

- 01

### Implementation

- Prisma schema와 최초 migration을 작성하고 개발용 seed 기반을 추가한다.
- 도메인별 repository/service와 공통 오류 타입을 만든다.
- 예상 경로: `prisma/schema.prisma`, `prisma/migrations/**`, `src/server/db/**`, `src/server/domain/**`, `tests/integration/**`.

### Backend

- Entity:
  - `User(id, email, passwordHash, createdAt, updatedAt)`
  - `Session(id, tokenHash, userId, expiresAt, createdAt)`
  - `Mindmap(id, userId, title, sequenceNo, createdAt, updatedAt)`
  - `Node(id, mindmapId, parentNodeId, title, contentMd, x, y, isCollapsed, revision, createdAt, updatedAt)`
- 제약과 index:
  - 정규화된 이메일 unique, `(userId, sequenceNo)` unique, `sequenceNo > 0`
  - Mindmap/Node 제목의 trim 후 빈 값 거부를 service와 가능한 DB constraint 양쪽에서 보장
  - Mindmap별 root node 한 개를 보장하는 PostgreSQL partial unique index
  - `Node(mindmapId)`, `Node(parentNodeId)`, `Mindmap(userId, updatedAt)` index
  - Node 부모가 같은 Mindmap에 속하는지 service에서 검증
- Mindmap 생성 시 `MAX(sequenceNo)+1` 계산, Mindmap과 `시작` root node 생성을 한 transaction에서 처리한다. 사용자 단위 transaction lock 또는 unique 충돌 재시도로 동시 생성 경쟁을 처리한다.
- node 변경 시 해당 Mindmap의 `updatedAt`도 갱신하는 transaction helper를 만든다.
- root node 삭제 방지와 subtree 계산/삭제를 위한 domain 함수를 준비한다.

### Frontend

- 없음. 이 단계에서는 DB/도메인 계층만 검증한다.

### Validation

- migration을 빈 DB에 적용하고 schema 생성 확인
- repository integration test: 관계, cascade, unique, 빈 제목, root 유일성, 사용자별 sequence, 동시 생성 충돌
- transaction rollback test
- `npm run lint`, `npm run typecheck`, `npm run test`, `npm run build`

### Execution Record (2026-08-18)

- 구현 완료: Prisma 7 schema/config/generated client, 최초 SQL migration, PostgreSQL driver adapter client, domain error/normalization, User/Session/Mindmap/Node repository와 transaction service, idempotent seed, 안전한 `mindmap_test` bootstrap, integration test suite.
- 검증 성공: `docker compose config --quiet`, `prisma validate`, `prisma generate`, schema diff 생성, `npm run lint`, `npm run typecheck`, `npm run test`(4 files/9 tests), `npm run build`, CLI 환경의 DB client import.
- Docker Desktop 4.87.0과 Docker CLI 29.7.2는 설치됐지만 engine 상태는 `stopped`다.

```text
DEFERRED TO 12 / NOT VERIFIED
- 실제 PostgreSQL에서 migration/status, seed 2회 멱등성, repository transaction 및 integration test 실행
- 사유: 기능 우선 전략에 따라 Docker/DB 환경 준비를 최종 통합 단계로 이동
```

- 2026-08-19 범위 재정의: schema/migration/repository/service/test code와 정적·unit 검증이 완료되어 02를 `✅ DONE`으로 변경했다. 실제 DB 검증 책임은 삭제하지 않고 12의 backlog로 이관했다.

### Definition of Done

- 동일한 DB를 재현하는 최초 migration과 수동 DB constraint가 version control 대상 코드로 존재한다.
- 두 사용자를 구분하는 repository query와 소유권 helper가 구현되고 type/unit 검증을 통과한다.
- Mindmap/root transaction, 경쟁 재시도, 금지 조건을 검증하는 integration test code가 존재한다.
- lint, typecheck, unit test, production build가 성공한다. 실제 DB 실행 결과는 12에서 최종 확인한다.

---

> 03~11 공통 검증 규칙: 단계별 API/DB integration 및 Playwright 시나리오는 구현 시 함께 작성한다. PostgreSQL 부재로 실행하지 못한 항목은 `Infrastructure Validation Backlog`에 기록하되 Backend/Frontend 기능 코드와 DB 없이 가능한 검증이 완료되면 해당 기능 단계는 완료 처리할 수 있다.

## 03. 회원가입·로그인·로그아웃 및 접근 제어 — ✅ DONE

### Goal

사용자가 이메일로 가입·로그인·로그아웃할 수 있고, 비로그인 사용자와 다른 사용자는 개인 데이터에 접근할 수 없다.

### Dependencies

- 01, 02

### Implementation

- 인증 service, session cookie 처리, 인증 API, 인증 화면, route guard를 구현한다.
- 예상 경로: `src/features/auth/**`, `src/server/auth/**`, `src/app/api/auth/**`, `src/app/login/**`, `src/app/(protected)/**`.

### Backend

- API: `POST /api/auth/signup`, `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/session`.
- 이메일 trim/lowercase, 이메일 형식, 합리적인 비밀번호 최소 길이, 요청 JSON 크기를 Zod로 검증한다.
- 비밀번호 hash, timing-safe한 로그인 흐름, 만료 가능한 opaque session, logout 시 DB session 폐기와 cookie 제거를 구현한다.
- mutation 요청의 Origin/Host 검증과 세션 만료 정리를 적용한다.
- 인증 오류는 일관된 error envelope를 사용하고 로그인 실패 메시지로 계정 존재 여부를 노출하지 않는다.

### Frontend

- 문서의 S01 기준으로 로그인/회원가입을 한 페이지 탭 상태로 구현한다.
- controlled input, field validation, 제출 중 중복 클릭 방지, 서버 오류, 비밀번호 표시 전환을 제공한다.
- 로그인 성공 시 `/`, 비로그인 protected route 접근 시 `/login`, 이미 로그인한 사용자의 `/login` 접근 시 `/`로 이동한다.
- Header의 사용자 메뉴와 로그아웃을 구현한다.

### Validation

- auth service unit/integration test: 가입, 중복 이메일, 로그인 성공/실패, 만료 세션, logout
- 인증 없이 protected API와 page 접근 시 차단/redirect 확인
- 사용자 A 세션으로 사용자 B 리소스 접근 시 404 처리하는 보안 회귀 test 기반 마련
- Auth UI component test와 Playwright 가입→로그인→로그아웃 smoke test
- lint, typecheck, test, build 및 실제 브라우저 확인

### Execution Record (2026-08-19)

- Backend: bcryptjs 12-round password hash, 8자/72 UTF-8 byte validation, 32-byte opaque token과 SHA-256 DB hash, 7일 만료 session, 가입 transaction, constant-cost 로그인 실패 비교, 만료/로그아웃 session 폐기를 구현했다.
- API: signup/login/logout/session Route Handler, 16KiB JSON 제한, Zod field error, 안정된 error envelope, Origin/Host 비교, `HttpOnly`·`SameSite=Lax`·production `Secure` cookie를 구현했다.
- Authorization: Proxy의 cookie 존재 기반 optimistic redirect와 DAL의 DB session secure check를 분리하고, 타 사용자 Mindmap과 미존재 Mindmap을 같은 `NOT_FOUND`로 처리하는 소유권 helper를 추가했다.
- Frontend: 확정 S01 구성에 맞춘 단일 로그인/회원가입 화면, controlled input, tab 전환, client/server validation, password 표시 전환, 제출 중 중복 방지, 오류 상태, 성공 redirect, 사용자 menu/logout을 구현했다.
- 검증 성공: `npm run lint`, `npm run typecheck`, `npm run test`(10 files/26 tests), `npm run build`, 실제 HTTP guest redirect(307), `/login` HTML 렌더링(200), cross-origin mutation 거부(403).

```text
DEFERRED TO 12 / NOT VERIFIED
- 실제 PostgreSQL 기반 가입·중복 이메일·로그인·만료 session·logout·사용자 소유권 integration test
- 가입→Dashboard→logout Playwright E2E
- 실제 브라우저 시각/상호작용 확인: 작성된 component test는 통과했으나 현재 in-app Browser 연결 대상이 없어 수행하지 못함
```

- 기능 우선 실행 전략의 완료 기준을 충족하여 03을 `✅ DONE`으로 변경했다. DB/E2E test code는 작성됐으며 실행 책임은 Infrastructure Validation Backlog에 유지한다.

### Definition of Done

- 새 사용자가 가입 후 dashboard로 진입하고 로그아웃할 수 있다.
- 쿠키에 비밀번호나 session 원문 이외의 민감정보가 노출되지 않으며 session cookie 속성이 검증된다.
- 비로그인 및 만료 세션은 protected 기능을 사용할 수 없다.

---

## 04. Dashboard와 Mindmap 생성·목록·이름 변경 — ✅ DONE

### Goal

로그인 사용자가 자신의 마인드맵 목록을 최근 수정순으로 보고, 버튼 한 번으로 새 맵을 만든 뒤 즉시 Editor로 이동하며 이름을 변경할 수 있다.

### Dependencies

- 03

### Implementation

- Mindmap list/create/update API, Dashboard page, empty state, card/menu, inline title editor를 구현한다.
- 예상 경로: `src/features/dashboard/**`, `src/features/mindmap/api/**`, `src/app/(protected)/page.tsx`, `src/app/api/mindmaps/**`.

### Backend

- API:
  - `GET /api/mindmaps` — 현재 사용자 목록, 최근 수정순, node count 포함
  - `POST /api/mindmaps` — `새로운 마인드맵 N`과 root node를 transaction 생성
  - `PATCH /api/mindmaps/:mindmapId` — 제목 변경
- 모든 쿼리는 인증 사용자 `userId`를 조건에 포함하며 비소유/미존재 리소스는 정보 노출을 피하기 위해 동일한 404로 처리한다.
- title trim/빈 값 검증, 안정된 DTO와 error envelope를 적용한다.

### Frontend

- S02의 MVP 항목만 구현한다: 서비스 Header, `내 마인드맵`, `+ 새 마인드맵`, 카드 목록, 수정일, node count, empty state, 더보기 메뉴.
- 생성 중 버튼을 비활성화하고 성공 응답의 `rootNodeId`를 navigation state/query에 담아 `/mindmaps/:id`로 즉시 이동한다.
- inline 이름 변경은 Enter/blur 확정, Esc 취소, 빈 값이면 기존 제목 복원과 오류 안내를 제공한다.
- 검색, 최근 열람, 즐겨찾기, 공유, 폴더, 휴지통, 사용량, 요금제, grid/list 전환은 시안에 있어도 제외한다.

### Validation

- API integration test: 사용자별 목록, 정렬, node count, sequence 재사용 규칙, 제목 validation, 타 사용자 차단
- Dashboard component test: loading/error/empty/list, 생성 중 중복 요청 방지, inline edit keyboard 동작
- Playwright: 로그인→빈 dashboard→연속 생성→Editor 이동→Dashboard 복귀→제목 변경
- lint, typecheck, test, build 및 실제 브라우저 확인

### Execution Record (2026-08-19)

- 사용자별 최근 수정순 목록, 실제 node count, transaction 생성, 소유권 기반 이름 변경과 최소 Editor 조회 service/API를 구현했다.
- `GET/POST /api/mindmaps`, `PATCH /api/mindmaps/:mindmapId`는 DB session을 재검증하고 DTO만 반환하며, 비소유/미존재 리소스를 동일한 `404 NOT_FOUND`로 처리한다.
- TanStack Query provider와 목록/생성/이름 변경 hook을 추가하고 Dashboard의 loading/error/retry/empty/list, 실제 카드 정보, 생성 이동, optimistic rename rollback을 구현했다.
- 생성 직후 `/mindmaps/:id?rootNodeId=...&initialEdit=1`에서 session과 소유권을 다시 확인하고 root를 읽기 전용으로 표시하는 최소 Editor 진입 화면을 구현했다. React Flow 편집 기능은 계획대로 05 이후 범위다.
- 빠른 이중 클릭이 React mutation 상태 반영 전에 두 POST를 만들 수 있음을 component test에서 발견해 synchronous in-flight ref로 차단했다.
- `npm run lint`, `npm run typecheck`, `npm run test`(12 files, 36 tests), `npm run build`, `npx playwright test --list`가 성공했다.

DEFERRED TO 12 / NOT VERIFIED

- 실제 PostgreSQL에서 Dashboard service integration test 실행
- 실제 브라우저에서 가입→빈 Dashboard→연속 생성→Editor→복귀→이름 변경 Playwright 실행
- 실제 DB의 최근 수정순, node count, 사용자 격리, reload 영속성 및 시각/console 확인

- 기능 우선 실행 전략의 완료 기준을 충족하여 04를 `✅ DONE`으로 변경했다. integration/E2E test code는 작성됐으며 실행 책임은 Infrastructure Validation Backlog에 유지한다.

### Definition of Done

- 사용자 A에게 사용자 B의 카드가 보이지 않는다.
- 생성 시 별도 제목 modal 없이 정확한 순번의 Mindmap/root가 생기고 Editor로 이동한다.
- 카드의 제목, 최근 수정일, node count가 DB와 일치하고 새로고침 후 유지된다.

---

## 05. Mindmap Editor 조회·React Flow 캔버스 기반 — ✅ DONE

### Goal

사용자가 생성한 맵을 열어 root와 현재 로드된 자식 노드·연결선을 보고, 선택·Pan·Zoom·Fit View로 탐색할 수 있다.

### Dependencies

- 04

### Implementation

- Editor 상세 API, React Flow adapter, custom node/edge, Editor layout와 오류 상태를 구현한다.
- 서버 DTO와 React Flow node/edge 타입 변환은 순수 adapter로 분리한다.
- 예상 경로: `src/app/(protected)/mindmaps/[mindmapId]/**`, `src/features/mindmap/components/**`, `src/features/mindmap/model/**`, `src/app/api/mindmaps/[mindmapId]/**`.

### Backend

- `GET /api/mindmaps/:mindmapId`가 소유권 검증 후 Mindmap 메타데이터와 node DTO를 반환한다.
- 초기 PoC는 최대 1,000 node를 단일 조회하되 필요한 필드만 select하고 payload/쿼리 시간을 계측할 수 있게 한다. 성능 결과에 따라 12단계에서 부분 로딩을 적용한다.
- 잘못된 ID, 비소유 ID, DB 오류를 400/404/500으로 구분한다.

### Frontend

- S03 상단의 뒤로가기, 독립된 Mindmap 제목, 저장 상태 자리, Export 진입 자리를 구성한다.
- `@xyflow/react` custom node로 root/일반 node와 부모-자식 edge를 렌더링한다.
- node 선택 강조, canvas Pan, wheel/button Zoom, Fit View, loading skeleton, empty/corrupt data 오류를 처리한다.
- 새로 생성된 map의 `rootNodeId`가 전달됐을 때 root를 선택하고 06단계 제목 편집이 연결될 수 있는 초기 focus 신호를 보존한다.

### Validation

- DTO→React Flow 변환 unit test: root, 깊은 tree, edge, 좌표
- 상세 API 소유권/404/integrity integration test
- canvas component test: node/edge 표시, 선택, toolbar callback
- Playwright로 Editor 진입, Pan/Zoom/Fit View와 Dashboard 복귀 확인
- lint, typecheck, test, build 및 브라우저 console 오류 확인

### Execution Record (2026-08-19)

- `GET /api/mindmaps/:mindmapId`와 최소 상세 DTO를 구현해 소유 Mindmap의 제목·수정일, root ID, node 관계·좌표·접힘·revision만 반환하고 사용자 ID와 Markdown 본문은 제외했다.
- 단일 repository 조회 결과를 O(n)으로 검증해 root 누락/중복, 다른 Mindmap parent, 연결되지 않은 cycle을 `DATA_INTEGRITY`로 차단했다.
- Server Page의 소유권 조회 결과를 TanStack Query `initialData`로 전달해 첫 화면의 중복 DB/API 요청을 피하고, background refresh 실패 시 기존 캔버스와 retry 상태를 유지한다.
- `@xyflow/react` custom node/edge와 순수 DTO adapter를 추가해 DB 좌표·부모 관계를 렌더링하고 node 선택, pane 선택 해제, Pan, wheel/pinch/button Zoom, Fit View를 구현했다.
- 저장되지 않는 node drag/connect/delete는 07 전까지 비활성화하고 Export·Markdown Detail 같은 후속 기능은 노출하지 않았다.
- route loading/error, client loading/error/retry, 손상 tree 전용 안전 오류 화면을 구현했다.
- `npm run lint`, `npm run typecheck`, `npm run test`(15 files, 50 tests), `npm run build`, `npx playwright test --list`(4 scenarios)가 성공했다.

DEFERRED TO 12 / NOT VERIFIED

- 실제 PostgreSQL에서 Editor 상세 조회·소유권 격리·tree 무결성 integration test 실행
- 실제 브라우저에서 root/child/edge, 선택, Pan, Zoom, Fit View, 직접 URL·Dashboard 복귀 Playwright 실행
- 실제 DB 좌표·관계의 reload 복원, browser console 및 시각 확인, 1,000 node 응답/렌더 성능 측정

- 기능 우선 실행 전략의 완료 기준을 충족하여 05를 `✅ DONE`으로 변경했다. DB/browser test code는 작성됐으며 실제 실행 책임은 Infrastructure Validation Backlog에 유지한다.

### Definition of Done

- DB 좌표와 관계가 캔버스에 정확히 반영된다.
- 새로고침/직접 URL 접근에도 인증과 소유권이 지켜진다.
- 기본 탐색이 실제 브라우저에서 동작하며 React console/runtime 오류가 없다.

---

## 06. Node 생성과 제목 편집 규칙 — ✅ DONE

### Goal

사용자가 root 또는 일반 node에 자식을 연속 추가하고, root를 포함한 모든 node 제목을 키보드 규칙에 따라 편집한 뒤 새로고침해도 결과를 볼 수 있다.

### Dependencies

- 05

### Implementation

- Node create/title update API, 기본 위치 계산, node inline editor와 `[+]` 액션을 구현한다.
- 신규 자식은 부모 주변에서 기존 형제와 겹침을 줄이는 결정적 위치 계산을 사용하되 자동 레이아웃은 하지 않는다.
- 예상 경로: `src/app/api/mindmaps/[mindmapId]/nodes/**`, `src/app/api/nodes/[nodeId]/**`, `src/features/mindmap/components/MindmapNode*`, `src/features/mindmap/lib/position*`.

### Backend

- API:
  - `POST /api/mindmaps/:mindmapId/nodes`
  - `PATCH /api/nodes/:nodeId`의 title mutation
- parent 존재, 같은 Mindmap 소속, 인증 사용자 소유권, 유한 좌표, trim 후 비어 있지 않은 title을 검증한다.
- 생성/수정과 Mindmap `updatedAt` 갱신을 transaction으로 처리한다.
- title update에 node `revision`을 적용해 오래된 응답/수정이 최신 값을 덮지 않게 한다.

### Frontend

- root 생성 직후 `시작` 전체 선택 또는 caret focus 상태로 즉시 Edit Mode를 연다.
- `[+]` 클릭 시 기본 제목의 자식 node를 서버에 만든 다음 즉시 Edit Mode/focus로 전환한다.
- Enter 확정, Esc 취소, 더블클릭 재편집, 빈 값 확정 방지와 기존 제목 복원을 구현한다.
- mutation 중 중복 Enter를 방지하고 실패 시 편집값을 유지한 채 오류와 재시도 경로를 제공한다.

### Validation

- title validator와 형제 기본 위치 계산 unit test
- API integration test: child 생성, 다른 map parent 거부, 빈 제목, 비유한 좌표, 타 사용자 차단, revision conflict
- component test: 초기 root focus, Enter/Esc/double click, IME 조합 중 Enter 보호, 빈 값 복원
- Playwright: 생성 직후 root 즉시 입력→다단계 child 생성→이름 변경→reload 복원
- lint, typecheck, test, build 및 실제 키보드/한글 입력 확인

### Execution Record (2026-08-21)

- Backend: 소유 Mindmap의 child 생성과 `revision` 조건부 title update service를 transaction으로 구현하고, parent의 동일 Mindmap 소속·제목·유한 좌표·소유권을 검증했다. 생성/수정 시 Mindmap `updatedAt`도 함께 갱신한다.
- API: `POST /api/mindmaps/:mindmapId/nodes`와 `PATCH /api/nodes/:nodeId`를 추가했다. 둘 다 DB session, same-origin, UUID/Zod 입력 검증을 적용하며 비소유/미존재 리소스는 404, revision 충돌은 409로 반환한다.
- Frontend: root 초기 auto focus/전체 선택, 모든 node의 `[+]`, `새 노드` 생성 직후 Edit Mode, controlled inline input, Enter/Esc/double click, IME Enter 보호, 빈 제목 복원, 실패 draft·재시도를 구현했다.
- 위치 규칙: parent 오른쪽 240px에서 `0, +96, -96, +192, -192...` 순서로 기존 형제가 차지하지 않은 첫 slot을 선택해 자동 layout 없이 결정적 배치를 제공한다.
- 순서 보호: server revision 조건 갱신과 client sequence/synchronous in-flight lock을 함께 적용하고, mutation 중 충돌 가능한 다른 node 편집·생성을 잠가 늦은 응답이 새 편집 상태를 덮지 않게 했다.
- 검증 성공: `npm run lint`, `npm run typecheck`, `npm run test`(17 files/62 tests), `npm run build`, `npx playwright test --list`(4 files/5 tests).

```text
DEFERRED TO 12 / NOT VERIFIED
- 실제 PostgreSQL에서 child 생성·다른 map parent·타 사용자·revision conflict integration test 실행
- 실제 브라우저에서 root 한글 즉시 입력→다단계 child 생성→제목 변경→reload 복원 Playwright 실행
- 실제 키보드/IME, focus/caret, 시각 배치와 browser console 확인
- 사유: Docker engine이 실행 중이지 않아 DB 기반 integration/E2E 환경을 기동할 수 없음
```

- 기능 우선 실행 전략의 완료 기준을 충족하여 06을 `✅ DONE`으로 변경했다. integration/E2E test code는 작성됐으며 실행 책임은 Infrastructure Validation Backlog에 유지한다.

### Definition of Done

- 핵심 root/child 생성·제목 편집 흐름이 마우스와 키보드로 동작한다.
- 빈 node/title이 DB에 남지 않고 관계와 제목이 reload 후 정확히 복원된다.
- 오래된 mutation 응답이 최신 화면 값을 덮어쓰지 않는다.

---

## 07. Node 자유 이동·위치 저장·하위 트리 접기/펼치기 — ⬜ TODO

### Goal

사용자가 node를 자유롭게 배치하고 하위 tree를 접어 복잡도를 낮출 수 있으며, 이동과 접기 상태가 재접속 후 복원된다.

### Dependencies

- 06

### Implementation

- position/collapse API와 mutation hook, visible tree selector를 구현한다.
- tree 관계 변경은 하지 않고 React Flow drag는 좌표만 변경한다.
- 예상 경로: `src/app/api/nodes/[nodeId]/position/**`, `src/app/api/nodes/[nodeId]/collapse/**`, `src/features/mindmap/hooks/**`, `src/features/mindmap/lib/tree*`.

### Backend

- API:
  - `PATCH /api/nodes/:nodeId/position`
  - `PATCH /api/nodes/:nodeId/collapse`
- 유한한 x/y, boolean collapse, revision과 소유권을 검증한다.
- node와 Mindmap 수정 시간을 한 transaction에서 갱신한다.

### Frontend

- drag 중 local position만 변경하고 Drag End 한 번만 서버에 저장한다.
- 실패하면 사용자 위치를 화면에 유지하고 retry를 제공하며, 서버 원본으로 명시적 되돌리기도 가능하게 한다.
- 자식이 있는 node에만 접기/펼치기 액션을 보이고, 접힌 node의 모든 descendant node/edge를 memoized selector로 제외한다.
- Fit View는 현재 표시된 node를 기준으로 동작한다.

### Validation

- visible subtree/edge selector unit test: 여러 깊이, 여러 branch, root collapse
- position/collapse API integration test: validation, revision, 소유권, reload
- component test: drag 중 API 미호출, drag end 1회 호출, 접힘 시 descendant 제거
- Playwright: drag→reload 좌표 복원, collapse→reload 상태 복원, 부모 관계 불변 확인
- lint, typecheck, test, build 및 실제 캔버스 조작 확인

### Definition of Done

- drag가 parent 관계를 바꾸지 않고 최종 좌표만 저장한다.
- 접힌 subtree가 렌더링에서 제외되고 펼치면 기존 좌표로 돌아온다.
- 실패 상태에서도 사용자의 방금 조작이 즉시 사라지지 않는다.

---

## 08. Node 상세 Markdown 패널·미리보기·전체화면 — ⬜ TODO

### Goal

사용자가 node를 선택해 오른쪽 패널에서 Markdown을 작성·미리보기하고, 전체화면에서 집중 편집한 뒤 같은 캔버스 상태로 돌아올 수 있다.

### Dependencies

- 06

### Implementation

- content API, Node Detail panel, edit/preview tab, fullscreen overlay와 Markdown renderer를 구현한다.
- Markdown 입력은 controlled draft로 관리하고 렌더러에서 raw HTML은 비활성화한다.
- 예상 경로: `src/features/mindmap/components/NodeDetail*`, `src/features/mindmap/model/draft*`, `src/app/api/nodes/[nodeId]/content/**`, `src/shared/ui/tabs/**`.

### Backend

- `PATCH /api/nodes/:nodeId/content`가 `contentMd`, `revision`을 검증하고 node/Mindmap 수정 시간을 transaction으로 갱신한다.
- 비소유 node는 404, revision conflict는 409, validation은 400으로 일관되게 반환한다.
- 상세 Markdown 크기에 합리적인 PoC 상한을 두고 오류 메시지에 허용 범위를 제공한다.

### Frontend

- node를 선택하면 S04를 열고, node의 `[상세]` 액션도 같은 선택·열기 동작을 제공한다.
- node 제목, controlled Markdown textarea, GFM 미리보기, 저장 상태 영역, 닫기, 전체화면을 제공한다.
- node A draft가 있는 상태에서 B를 선택할 때 A draft가 B에 섞이지 않도록 node id별 draft를 분리한다.
- S05는 Editor 내부 overlay로 구현해 선택 node, React Flow viewport, panel 상태를 unmount하지 않고 유지한다.
- 09단계 autosave 완성 전에도 content mutation hook 자체와 성공/실패 결과를 통합 테스트할 수 있게 한다.

### Validation

- Markdown renderer unit/component test: heading, list, code, link, raw HTML 비실행
- content API integration test: 저장, 빈 Markdown 허용, 크기 제한, revision conflict, 타 사용자 차단
- component test: A/B node draft 격리, edit/preview, panel/overlay 전환, focus 복원
- Playwright: 상세 열기→작성→미리보기→전체화면→종료 후 선택/zoom/viewport 유지
- lint, typecheck, test, build 및 실제 긴 문서 입력 확인

### Definition of Done

- Markdown 편집과 미리보기가 실제 콘텐츠로 동작하고 XSS 위험 HTML을 실행하지 않는다.
- 전체화면 왕복 후 선택 node와 canvas viewport가 유지된다.
- node 전환 중 서로 다른 draft가 섞이거나 유실되지 않는다.

---

## 09. 통합 자동저장·저장 상태·실패 복구 — ⬜ TODO

### Goal

사용자의 제목·위치·접기·Markdown 변경이 정해진 시점에 저장되고, 최신 수정이 우선하며, 실패해도 draft를 유지한 채 재시도할 수 있다.

### Dependencies

- 07, 08

### Implementation

- 저장 상태 machine과 공통 mutation coordinator를 작성하고 Editor Header/Detail에 실제 서버 응답 기반 상태를 연결한다.
- 저장 상태는 `idle → dirty → saving → saved`와 `saving → failed → retry`를 명시적으로 관리한다.
- node id별 unsaved Markdown을 `localStorage` draft journal에 보관하고 성공한 revision만 제거한다.
- 예상 경로: `src/features/mindmap/hooks/useAutosave*`, `src/features/mindmap/model/save*`, `src/features/mindmap/lib/draftJournal*`, `src/shared/ui/SaveStatus*`.

### Backend

- 모든 node mutation의 revision 규칙과 error envelope를 통일한다.
- 동일 node의 늦게 도착한 오래된 요청은 409로 거부하고 현재 revision을 반환한다.
- retry 가능한 일시 오류와 validation/conflict 오류를 구분한다.

### Frontend

- Markdown은 마지막 입력 후 정확히 2초 debounce로 저장한다.
- node/Mindmap 제목은 Enter 또는 명시된 blur 확정 시, 위치는 Drag End, collapse는 액션 직후 저장한다.
- 새 입력이 들어오면 진행 중 요청의 응답이 최신 draft를 덮지 않도록 client sequence + server revision을 함께 사용한다.
- 패널 닫기/내부 route 이동 시 dirty Markdown을 즉시 flush한다. 브라우저 종료는 `visibilitychange`/`pagehide`와 draft journal로 최선 복구하며 네트워크 저장 성공을 거짓으로 표시하지 않는다.
- 실패 시 `저장 실패 · 다시 시도`, 성공 응답 후 `저장 완료`를 표시하고 retry 버튼을 제공한다.
- 재접속 시 서버본보다 남은 local draft가 있으면 복구 안내와 적용/폐기 선택을 제공한다.

### Validation

- fake timer unit test: 2초 debounce, 타이머 reset, node 전환 flush, retry, 최신 입력 우선
- delayed/out-of-order API response integration test와 revision conflict test
- component test: idle/dirty/saving/saved/failed 표시, 실패 후 draft 유지, 수동 retry
- Playwright network interception: 저장 실패→계속 작성→복구→reload, 빠른 A/B node 전환, pagehide 후 draft 복구
- lint, typecheck, test, build 및 브라우저 Network 탭에서 호출 횟수 확인

### Definition of Done

- 저장 상태가 추측이 아닌 실제 응답과 일치한다.
- Markdown 연속 입력은 마지막 입력 2초 뒤 한 번 저장되며 오래된 응답이 최신 내용을 덮지 않는다.
- 네트워크 실패, node 전환, panel 닫기 후에도 사용자가 작성한 로컬 draft를 즉시 잃지 않고 재시도/복구할 수 있다.
- reload 후 성공 저장된 모든 제목·좌표·접기·Markdown이 복원된다.

---

## 10. Mindmap·Node 삭제 확인과 안전한 Subtree 삭제 — ⬜ TODO

### Goal

사용자가 삭제 영향을 확인한 뒤 일반 node subtree 또는 전체 Mindmap을 삭제할 수 있고 root node는 삭제할 수 없다.

### Dependencies

- 04, 06, 09

### Implementation

- 공통 DeleteConfirmModal의 Mindmap/Node variant, descendant count 조회, 삭제 후 cache/selection 정리를 구현한다.
- 예상 경로: `src/features/mindmap/components/DeleteConfirmModal*`, `src/app/api/mindmaps/[mindmapId]/**`, `src/app/api/nodes/[nodeId]/**`.

### Backend

- API:
  - `DELETE /api/mindmaps/:mindmapId`
  - `DELETE /api/nodes/:nodeId`
- node 삭제는 recursive CTE 또는 검증된 subtree 계산을 사용해 한 transaction에서 descendant와 대상을 삭제한다.
- root node 삭제는 409/도메인 오류로 거부하고 타 사용자 리소스는 404로 처리한다.
- 응답에 삭제된 node 수를 포함해 UI와 서버 결과를 일치시킨다.

### Frontend

- Dashboard menu에서 Mindmap 삭제, 일반 node menu에서 node 삭제를 연다.
- modal에 대상 제목과 전체 삭제/하위 개념 N개 영향을 표시하고 destructive action 중 중복 제출을 막는다.
- root node에는 삭제 menu를 노출하지 않는다.
- node 삭제 성공 시 선택/draft/cache를 정리하고 canvas를 갱신하며, Mindmap 삭제 성공 시 Dashboard를 갱신한다.

### Validation

- subtree count/delete unit 및 integration test: leaf, 깊은 tree, sibling 보존, transaction rollback
- root 삭제 거부, 타 사용자 삭제 거부, Mindmap cascade test
- modal focus trap/Esc/취소/중복 제출 component test
- Playwright: child subtree 삭제와 reload, root menu 부재, Mindmap 삭제와 Dashboard 갱신
- lint, typecheck, test, build 및 브라우저 확인

### Definition of Done

- 사용자 확인 전에는 어떤 삭제 API도 호출되지 않는다.
- 표시된 영향 수와 실제 삭제 수가 일치하고 관계없는 sibling은 보존된다.
- root와 다른 사용자의 데이터는 삭제할 수 없다.

---

## 11. 범위별 Markdown 내보내기 — ⬜ TODO

### Goal

사용자가 전체 Mindmap, 현재 node만, 현재 node와 모든 하위 개념 중 범위를 골라 UTF-8 `.md` 파일로 다운로드할 수 있다.

### Dependencies

- 09, 10

### Implementation

- export domain service, API, ExportModal, 안전한 파일 다운로드를 구현한다.
- 예상 경로: `src/server/domain/export/**`, `src/app/api/mindmaps/[mindmapId]/export/**`, `src/features/mindmap/components/ExportModal*`, `src/features/mindmap/lib/download*`.

### Backend

- `POST /api/mindmaps/:mindmapId/export` 요청: `{ scope: 'ALL' | 'NODE' | 'SUBTREE', nodeId?: string, format: 'MARKDOWN' }`.
- scope/node 조합, node의 Mindmap 소속, 사용자 소유권을 검증한다.
- transaction snapshot 안에서 tree와 content를 읽어 일관된 문서를 만든다.
- 출력은 문서 규칙대로 Mindmap 제목, 선택 범위, 중첩 bullet 개념 구조, 각 node 경로/제목/원본 Markdown을 포함한다. 빈 content node도 포함하고 좌표·viewport·collapse·save status는 제외한다.
- UTF-8 `text/markdown`과 RFC 호환 `Content-Disposition`을 반환하고 제목을 안전한 파일명으로 sanitize한다.

### Frontend

- Dashboard/Editor 상단은 `ALL`, node menu는 `SUBTREE`를 기본 선택으로 modal을 연다.
- node 없는 진입점에서는 node 전용 scope를 비활성화한다.
- 포함 정보와 Markdown 단일 format을 명확히 보여주고 생성 중/오류/재시도를 처리한다.
- Blob 다운로드 후 object URL을 해제한다.

### Validation

- exporter golden/snapshot test: ALL/NODE/SUBTREE, 깊은 tree, 한글/특수문자, 빈 content, sibling 제외, 안정된 순서
- API integration test: scope validation, 소유권, content type/disposition/UTF-8
- modal component test: 진입점별 기본값, disabled option, 오류/중복 제출
- Playwright로 세 범위 파일을 다운로드하고 파일 내용을 읽어 구조·경로·상세 일치 확인
- lint, typecheck, test, build 및 실제 `.md` 열기 확인

### Definition of Done

- 세 범위가 정확히 다른 데이터 집합을 내보내며 선택 밖 node가 섞이지 않는다.
- 다운로드 파일이 UTF-8 Markdown으로 열리고 한글, tree 구조, 경로, 상세 내용이 보존된다.
- 비소유 데이터는 export할 수 없다.

---

## 12. 1,000 Node 성능·보안 회귀·최종 E2E 인수 검증 — ⬜ TODO

### Goal

핵심 사용자 흐름 전체가 실제 브라우저와 서버에서 안정적으로 동작하고, 1,000 node 데이터에서도 정해진 사용 가능 시간 목표를 검증한 배포 가능한 PoC가 된다.

### Dependencies

- 01~11 전체

### Implementation

- PostgreSQL 17 호환 실행 환경을 먼저 준비하고 migration과 seed를 깨끗한 DB에 적용한다. Docker Compose를 우선 사용하되 현재 장비에서 불가능하면 native/remote PostgreSQL로 동일하게 검증한다.
- 결정적 1,000 node fixture/seed와 성능 계측 script를 추가한다.
- 실제 측정 결과를 바탕으로 필요한 최소 최적화만 적용한다: collapsed subtree 우선 제외, React memoization, query select/index 개선, React Flow의 보이는 요소 렌더링 옵션, payload 축소.
- 단일 조회로 2초/5초 목표를 달성하지 못할 때에만 초기 visible 범위 API와 subtree lazy loading을 추가한다.
- 인증·권한·validation·접근성·오류 경계·반응형 최소 사용성을 회귀 검증한다.
- README에 최종 실행, migration, seed, test, 알려진 제한을 갱신한다.
- 예상 경로: `prisma/seed.*`, `scripts/performance/**`, `tests/e2e/**`, 관련 query/component 최적화 파일, `README.md`.

### Backend

- 1,000 node 상세 조회, subtree 삭제, autosave, 전체 export의 query 수/응답 시간/메모리를 측정한다.
- N+1 query, 누락 index, 과도한 payload가 있으면 단계 범위 안에서 수정한다.
- 전 API를 대상으로 비로그인/타 사용자/invalid input/error envelope 회귀 test를 수행한다.
- 운영 환경 cookie/secret/env validation과 민감 로그 미노출을 확인한다.

### Frontend

- 1,000 node fixture에서 최초 가시 영역 2초 이내 목표, 네트워크 포함 사용 가능한 화면 5초 이내 상한을 측정 환경과 함께 기록한다.
- 선택, drag, Pan/Zoom, collapse, detail open, autosave 중 불필요한 전체 node rerender를 profiler로 확인한다.
- Auth, Dashboard, Editor, modal, panel의 keyboard focus와 기본 desktop layout을 점검한다.
- 제품 정책 밖 기능을 추가하지 않고 로딩/오류/empty/retry 상태의 마감 품질만 보완한다.

### Validation

- PostgreSQL health, `prisma migrate status`, 빈 DB migration 재현, seed 2회 멱등성
- `npm run lint`
- `npm run typecheck`
- `npm run test`
- DB integration test 전체
- `npm run test:e2e`
- `npm run build`
- production mode 기동 후 Final Acceptance Criteria 전체 수동/자동 검증
- 1,000 node 성능 측정 결과 기록. 목표 미달이면 `NOT VERIFIED`가 아니라 원인과 수치를 기록하고 단계 상태를 `IN_PROGRESS` 또는 실제 진행 불가 시 `BLOCKED`로 유지

### Definition of Done

- 아래 Final Acceptance Criteria가 모두 실제 환경에서 통과한다.
- lint, typecheck, unit/integration/E2E, production build가 모두 성공한다.
- 1,000 node에서 최초 가시 영역 2초 목표를 측정하고 사용 가능한 화면 5초 상한을 충족한다.
- 사용자 간 데이터 격리 보안 회귀 test가 통과한다.
- 미검증 핵심 항목이나 동작하지 않는 placeholder가 없다.

---

## Infrastructure Validation Backlog

기능 구현 중 test code는 작성했지만 실행 환경 때문에 수행하지 못한 검증을 이곳에 누적한다. 12 완료 전에는 전부 실제 환경에서 성공해야 한다.

| 출처 단계 | 상태 | 12에서 실행할 검증 |
|---|---|---|
| 01 | NOT VERIFIED | PostgreSQL 실행을 포함한 README 신규 환경 재현 |
| 02 | NOT VERIFIED | 빈 DB migration/status, seed 2회 멱등성, 전체 repository/service integration test |
| 03 | NOT VERIFIED | 실제 DB auth integration, cookie/session E2E, 가입→Dashboard→logout Playwright, 브라우저 시각 확인 |
| 04 | NOT VERIFIED | 실제 DB Dashboard integration, 가입→목록·연속 생성·최소 Editor·이름 변경 Playwright, reload 영속성·브라우저 시각/console 확인 |
| 05 | NOT VERIFIED | 실제 DB Editor detail/integrity integration, node·edge 선택·Pan·Zoom·Fit View Playwright, 좌표·관계 reload 및 브라우저 시각/console 확인 |
| 06 | NOT VERIFIED | 실제 DB child/title/revision integration, root 한글 즉시 편집→다단계 child→reload Playwright, focus·IME·기본 배치·브라우저 시각/console 확인 |

Docker Desktop/WSL 설치 여부는 배포 방식 선택과 별개다. 최종 검증에는 PostgreSQL 17 호환 DB가 필요하지만 03~11 기능 구현의 선행조건으로 사용하지 않는다.

---

## Progress

| 단계 | 상태 | 한 줄 결과 |
|---|---|---|
| 01. 프로젝트 기반 및 로컬 실행 환경 | ✅ DONE | Next.js 실행·검증 기반과 DB 실행 구성 코드 완료 |
| 02. 데이터 모델·Migration·Repository | ✅ DONE | User/Session/Mindmap/Node 영속 계층·제약·통합 test code 완료 |
| 03. 인증 및 접근 제어 | ✅ DONE | 가입·로그인·로그아웃·session·접근 제어와 S01 UI 구현 |
| 04. Dashboard와 Mindmap 기본 수명주기 | ✅ DONE | 목록·자동 생성·열기·이름 변경과 최소 Editor 진입 구현 |
| 05. Editor 캔버스 기반 | ✅ DONE | 소유권 기반 Node/Edge 조회와 선택·Pan·Zoom·Fit View 구현 |
| 06. Node 생성·제목 편집 | ✅ DONE | root 즉시 편집과 child 생성·revision 기반 제목 수정 구현 |
| 07. 이동·접기/펼치기 | ⬜ TODO | 자유 배치와 렌더 범위 제어·복원 |
| 08. Markdown 상세 UI | ⬜ TODO | 패널·미리보기·전체화면 집중 편집 |
| 09. 자동저장·오류 복구 | ⬜ TODO | 2초 debounce, 저장 상태, retry, draft 보호 |
| 10. 안전한 삭제 | ⬜ TODO | Mindmap 및 일반 node subtree 확인 삭제 |
| 11. Markdown 내보내기 | ⬜ TODO | ALL/NODE/SUBTREE UTF-8 파일 다운로드 |
| 12. 성능·보안·최종 인수 | ⬜ TODO | 1,000 node와 전체 E2E 검증·최적화 |

- 총 단계: 12
- 완료: 6
- 진행 중: 0
- 차단: 0
- 남음: 6

## Decision Log

| 날짜 | 단계 | 결정 | 이유 |
|---|---|---|---|
| 2026-08-18 | 계획 | 단일 Next.js App Router 풀스택 구조 | 빈 저장소의 PoC에서 배포 단위와 타입 경계를 단순화하고 별도 서버 운영 부담을 줄이기 위함 |
| 2026-08-18 | 계획 | PostgreSQL + Prisma + migration | 자기 참조 tree, transaction, partial index, 동시 sequence 생성, 통합 테스트를 명시적으로 관리하기 위함 |
| 2026-08-18 | 계획 | DB 기반 opaque cookie session | 이메일/비밀번호 요구를 충족하면서 logout/만료/폐기를 서버가 통제하고 사용자 데이터를 browser storage에 노출하지 않기 위함 |
| 2026-08-18 | 계획 | React Flow 우선 PoC | 확정 문서의 1순위 후보이며 custom node, edge, drag, Pan/Zoom, Fit View를 직접 canvas 구현 없이 제공함 |
| 2026-08-18 | 계획 | TanStack Query + local/custom hook 상태 | Server State와 UI/Editing State를 분리하되 실제 필요가 없는 전역 store 복잡성을 피하기 위함 |
| 2026-08-18 | 계획 | controlled textarea + react-markdown | MVP의 Markdown 직접 입력·미리보기를 가장 작은 의존성과 예측 가능한 draft 제어로 충족하기 위함 |
| 2026-08-18 | 계획 | revision + client sequence로 저장 순서 보호 | debounce와 동시 요청에서 오래된 응답이 최신 편집 내용을 덮는 것을 방지하기 위함 |
| 2026-08-18 | 계획 | 1,000 node는 상품 상한이 아닌 성능 fixture | PRD가 가지 생성 수의 상품 제한을 두지 말라고 명시하며, 1,000개는 관리·성능 검증 목표이기 때문 |
| 2026-08-18 | 계획 | 상세 전체화면은 Editor overlay | 종료 후 selected node와 React Flow viewport를 유지하는 가장 단순한 방법이며 화면 구성안의 권장과 일치함 |
| 2026-08-18 | 02 | Prisma 7 + `@prisma/adapter-pg`와 별도 client generate | Prisma 7의 직접 PostgreSQL 연결 규칙을 따르고 schema/migration/client 생성을 명시적으로 재현하기 위함 |
| 2026-08-18 | 02 | DB check constraint와 root partial unique index를 최초 SQL migration에 수동 추가 | Prisma schema가 표현하지 못하는 이메일 정규화, 공백 제목, 양수 sequence, 음이 아닌 revision, Mindmap별 단일 root 불변식을 DB에서도 보장하기 위함 |
| 2026-08-18 | 02 | Serializable transaction + 최대 5회 충돌 재시도 | `MAX(sequenceNo)+1`의 동시 생성 경쟁을 unique constraint와 함께 안전하게 처리하면서 사용자별 연속 번호 정책을 유지하기 위함 |
| 2026-08-18 | 02 | Next.js용 `server-only` public barrel과 CLI용 내부 client 분리 | `server-only` package는 일반 Node/tsx에서 의도적으로 예외를 발생시키므로 Route Handler의 client import 방지와 seed/integration 실행을 동시에 충족하기 위함 |
| 2026-08-19 | 계획 | 01~11 기능 구현과 12 인프라 통합 검증 분리 | Docker/로컬 DB 문제로 Backend·Frontend 구현 전체가 멈추지 않게 하되 실제 저장·복원 검증 책임은 최종 인수 단계에서 강제하기 위함 |
| 2026-08-19 | 01~02 | 코드·정적/unit 검증 기준 완료, DB 검증 backlog 이관 | 이미 구현된 기반을 다음 기능의 의존성으로 사용할 수 있게 하고 미검증 항목은 별도 표에서 추적하기 위함 |
| 2026-08-19 | 03 | DB opaque session token 7일 만료, SHA-256 hash 저장 | cookie 탈취 위험을 HttpOnly/SameSite로 낮추고 DB 유출 시 원문 token을 노출하지 않으면서 서버에서 즉시 폐기 가능하게 하기 위함 |
| 2026-08-19 | 03 | 비밀번호 8자 이상·72 UTF-8 byte 이하, bcryptjs cost 12 | 문서에 없는 운영 수치를 bcrypt truncation 방지와 PoC 보안/응답시간 균형을 고려한 기술 기본값으로 확정 |
| 2026-08-19 | 03 | Proxy는 cookie 존재만 확인하고 DAL이 DB session을 재검증 | Next.js 16 권장대로 Proxy의 느린 DB 조회를 피하면서 페이지/API 데이터 경계에서 실제 인증을 강제하기 위함 |
| 2026-08-19 | 03 | mutation API에서 Origin과 Host 일치 강제 | SameSite cookie에 더해 cross-site 요청을 명시적으로 거부하고 Route Handler를 독립 보안 경계로 취급하기 위함 |
| 2026-08-19 | 04 | Dashboard server state는 TanStack Query cache로 관리 | 목록·생성·이름 변경의 로딩/오류/optimistic rollback을 일관되게 처리하고 UI 로컬 상태와 서버 상태를 분리하기 위함 |
| 2026-08-19 | 04 | 생성 중 synchronous in-flight ref와 mutation disabled를 함께 적용 | 같은 event turn의 빠른 이중 클릭은 React pending render 전에 들어올 수 있어 실제 중복 POST를 확실히 차단하기 위함 |
| 2026-08-19 | 04 | `/mindmaps/:id`에 소유권 검증 최소 읽기 화면 우선 제공 | Dashboard 생성·열기 흐름을 404 없이 완결하면서 React Flow와 node 편집을 05·06 범위에 유지하기 위함 |
| 2026-08-19 | 05 | Server Page 상세 조회 결과를 Query `initialData`로 재사용 | 직접 URL에서 session·소유권을 먼저 검증하면서 hydration 직후 동일 데이터를 다시 요청하는 낭비를 피하기 위함 |
| 2026-08-19 | 05 | tree 무결성을 렌더 전 O(n) 검증 | 자기 참조 FK만으로는 parent가 같은 Mindmap에 속함을 보장하지 못하므로 잘못된 edge와 순환 구조를 client에 전달하지 않기 위함 |
| 2026-08-19 | 05 | node drag/connect/delete를 명시적으로 비활성화 | 06·07 API가 없는 상태에서 저장되지 않는 편집처럼 보이는 사용자 조작을 허용하지 않기 위함 |
| 2026-08-19 | 05 | React Flow 상태는 adapter 결과와 selected node local state만 제어 | 현재 단계의 읽기·탐색 요구를 충족하면서 미래 편집 기능을 위한 전역 store를 선제 도입하지 않기 위함 |
| 2026-08-21 | 06 | child 기본 위치를 오른쪽 240px·세로 96px 대칭 slot으로 결정 | 자유 배치 정책을 유지하면서 신규 형제의 초기 겹침을 결정적으로 줄이고 기존 node를 재배치하지 않기 위함 |
| 2026-08-21 | 06 | title mutation은 server revision과 client sequence·즉시 lock을 함께 사용 | 오래된 요청을 DB에서 거부하고 동일 render frame의 중복 제출과 늦은 client 응답의 상태 덮어쓰기를 동시에 막기 위함 |
| 2026-08-21 | 06 | node 제목 blur는 저장이 아닌 취소로 처리 | 확정 문서의 Enter 저장·Esc 취소 규칙을 단일 저장 경계로 유지하고 의도하지 않은 focus 이동 저장을 피하기 위함 |

## Surprises & Discoveries

- 저장소에는 `.git`, `package.json`, 소스, 테스트, 환경 설정이 없고 `docs/01.reference`만 있다. 기존 아키텍처나 구현을 보존할 대상은 없다.
- 참조 이미지에는 검색, 최근 열람, 즐겨찾기, 공유, 폴더, 휴지통, 사용량/요금제, 형제 node, 실행 취소/다시 실행, 스타일, 알림, 도움말이 보이지만 확정 PRD에서는 MVP 이후이거나 정의되지 않은 기능이다. 시각 스타일만 참고하고 기능은 구현하지 않는다.
- 이미지의 `공유` 버튼과 로그인 화면의 `공유와 협업` 문구는 개인 데이터 우선·협업 제외 정책과 충돌한다. MVP UI에서는 공유 기능을 노출하지 않는다.
- 이미지의 child placeholder와 좌우 대칭 tree 배치는 자동 레이아웃처럼 보이지만 확정 정책은 자유 배치다. 신규 node는 부모 주변 기본 좌표만 계산하고 이후 사용자가 이동한다.
- 문서에는 1,000 node의 부분 로딩/viewport 렌더링이 선택지로 제시됐지만 정확한 초기 로딩 범위 API는 확정되지 않았다. 먼저 단순 조회를 계측하고 목표 미달일 때만 12단계에서 복잡성을 추가한다.
- 브라우저/tab 강제 종료 순간의 네트워크 저장은 플랫폼 특성상 성공을 보장할 수 없다. 09단계는 서버 저장을 거짓 성공 처리하지 않고 local draft journal로 데이터 손실 위험을 낮춘다.
- Markdown 본문 크기 상한, session 만료 기간 같은 운영 수치는 제품 정책으로 명시되지 않았다. 구현 시 보안·운영을 위한 합리적 기술 기본값을 선택해 Decision Log에 수치와 이유를 남긴다.
- 저장소 root와 `docs/`에 서로 다른 `MASTER_PLAN.md`가 중복 존재한다. 사용자 지정에 따라 `docs/MASTER_PLAN.md`만 상태 원본으로 갱신했고 root 문서는 수정하지 않았다.
- Docker Desktop/WSL 설치와 Windows 재시작 후에도 `Win32_Processor.VirtualizationFirmwareEnabled=False`이고 engine은 `stopped`다. 이 제약은 12의 PostgreSQL 실행 방식 결정 항목으로 이관했으며 03~11 기능 구현을 차단하지 않는다.
- Prisma 7.9.1 CLI 의존 경로의 `deepmerge-ts@7.1.5`에 npm high advisory가 보고된다. npm의 자동 수정 제안은 Prisma 6.12로의 breaking downgrade이므로 적용하지 않았고, Prisma 7 호환 수정 버전을 추적해야 한다.
- 03 UI 검증 시 in-app Browser 연결 대상이 없어 실제 브라우저 조작을 수행하지 못했다. HTTP 렌더링과 Testing Library 상호작용 검증은 통과했으며 전체 Playwright 실행은 12 backlog에 유지한다.
- 04 component test에서 mutation의 `isPending`만으로는 같은 render frame의 연속 클릭을 막지 못해 생성 POST가 중복될 수 있음을 확인했다. UI 비활성화와 별도로 즉시 ref lock이 필요했다.
- Node의 자기 참조 FK는 존재하는 parent만 보장하고 parent와 child의 `mindmapId` 일치까지 보장하지 않는다. 05 조회 service의 tree 무결성 검증과 이후 생성 service의 소속 검증을 함께 유지해야 한다.
- 현재 `@xyflow/react` test 환경의 ResizeObserver callback은 공식 기본 shim의 target뿐 아니라 `contentRect`도 요구했다. 실제 버전에 맞춘 DOM 측정 shim을 적용해 edge/component test를 안정화했다.

## Deferred

- AI node 생성, AI 요약, 앱 내부 AI chat, 외부 AI 직접 연동
- 공동 편집, 공유 link, 사용자 초대, 권한 역할
- 검색, 최근 열람, 즐겨찾기, folder, trash
- 자동 레이아웃, tree 방향 변경, drag/선택 UI를 통한 부모 node 변경
- 실행 취소/다시 실행, node style 편집, sibling node 전용 생성 액션
- 이미지/파일 첨부, PNG/PDF export, import
- version history와 되돌리기
- template, 알림, 도움말, 언어 전환, 요금제/사용량
- 모바일 전용 Editor UX
- MVP 성능 목표를 단순 React Flow 최적화로 충족하는 경우 별도 Canvas/WebGL 엔진과 무조건적인 부분 로딩

## Final Acceptance Criteria

### End-to-End 핵심 시나리오

1. 깨끗한 DB에 migration을 적용하고 production build로 앱을 실행한다.
2. 비로그인 상태로 `/`와 임의의 `/mindmaps/:id`에 접근하면 `/login`으로 이동한다.
3. 사용자 A가 가입·로그인하고 빈 Dashboard를 본다.
4. `[+ 새 마인드맵]`을 누르면 `새로운 마인드맵 1`과 `시작` root가 함께 생성되고 Editor로 이동한다.
5. root input에 자동 focus/caret가 있으며 별도 클릭 없이 한글 제목을 입력하고 Enter로 확정한다.
6. root와 child의 제목이 서로 독립적으로 유지되고 빈 값/공백 값 저장은 거부된다.
7. 여러 깊이의 child node를 만들고 더블클릭/Enter/Esc로 제목을 편집한다.
8. node를 drag하고 Pan/Zoom/Fit View를 사용하며 drag가 부모 관계를 변경하지 않음을 확인한다.
9. subtree를 접고 펼치며 접힘·좌표가 reload 후 복원됨을 확인한다.
10. 서로 다른 두 node의 상세 패널에서 Markdown을 작성하고 미리보기를 확인한다.
11. 상세 전체화면에 진입했다가 나왔을 때 선택 node, canvas 위치, zoom, panel 상태가 유지된다.
12. Markdown 입력은 마지막 입력 2초 후 저장되고 저장 중/완료가 실제 응답에 맞게 표시된다.
13. 네트워크 실패를 강제로 만들면 저장 실패·재시도가 표시되고 작성 draft가 사라지지 않으며 복구 후 저장된다.
14. 페이지를 닫았다가 재접속해 제목, tree, 좌표, 접기, Markdown의 마지막 성공 저장 상태가 복원됨을 확인한다.
15. 일반 node 삭제 modal에 descendant 수가 표시되고 확인 후 subtree만 삭제되며 root 삭제 기능은 없다.
16. Dashboard에서 Mindmap 삭제 영향을 확인하고 삭제 후 목록과 sequence 재사용 규칙이 정확한지 확인한다.
17. 전체 Mindmap, 현재 node만, 현재 node+subtree를 각각 export해 UTF-8 Markdown의 구조·경로·본문과 제외 범위를 확인한다.
18. 사용자 B를 만들고 A의 Mindmap/Node/API ID에 직접 접근해도 조회·수정·삭제·export할 수 없음을 확인한다.
19. 1,000 node fixture에서 최초 가시 영역 2초 목표와 사용 가능한 화면 5초 상한, 주요 canvas 조작·상세·autosave·전체 export를 검증한다.
20. lint, typecheck, unit/component/integration/E2E test, production build가 모두 성공하고 browser console에 미처리 오류가 없다.

### 전체 Definition of Done

- 위 20개 시나리오가 모두 검증 증거와 함께 통과한다.
- 핵심 경로에 placeholder, mock-only API, 메모리 전용 저장이 없다.
- 모든 단계가 `✅ DONE`이며 `🔴 BLOCKED` 또는 핵심 `NOT VERIFIED`가 없다.
- 문서, migration, 실행 명령과 실제 저장소 상태가 일치한다.
