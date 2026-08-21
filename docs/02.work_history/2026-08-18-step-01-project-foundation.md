# 01단계 프로젝트 기반 및 로컬 실행 환경 구성

> 작업일: 2026-08-18  
> 대상 단계: `MASTER_PLAN.md` 01  
> 최종 상태: `🟡 IN_PROGRESS`  
> 상태 유지 사유: Docker CLI/daemon 부재로 PostgreSQL Compose 실행 검증 미완료

## 1. 작업 배경

프로젝트는 확정 PRD, 화면 구성안, 개발 설계안과 UI 참고 이미지만 있고 실행 가능한 애플리케이션 코드는 없는 상태에서 시작했다.

후속 단계에서 인증, DB, Dashboard, React Flow Editor를 순차적으로 구현하려면 먼저 다음 조건이 필요했다.

- 동일한 명령으로 재현할 수 있는 TypeScript 실행 환경
- Frontend와 Backend API를 함께 둘 수 있는 최소 애플리케이션 구조
- PostgreSQL 로컬 실행 정의
- 기능을 추가할 때마다 회귀를 확인할 lint, typecheck, unit test, E2E, production build
- 환경 변수 누락을 조기에 발견할 validation 기반
- 개발자별 실행 방식이 달라지지 않도록 하는 README

이번 단계에서는 제품 기능을 선제 구현하지 않고 위 기반만 구성했다.

## 2. 변경 요약

### 애플리케이션 기반

- Next.js App Router와 React, TypeScript strict mode를 구성했다.
- `src/app`, `src/features`, `src/server`, `src/shared`의 책임을 분리했다.
- `/`에 기반 상태를 확인할 수 있는 최소 App Shell을 구현했다.
- loading, error, not-found 경계를 추가했다.

### 서버 기반

- DB와 무관하게 프로세스 생존 상태를 확인하는 `GET /api/health`를 추가했다.
- Zod 기반 server environment validation 함수를 추가했다.
- PostgreSQL 17 로컬 컨테이너를 위한 `compose.yaml`을 작성했다.

### 품질 기반

- ESLint와 Next.js TypeScript 규칙을 구성했다.
- Vitest, Testing Library, jsdom 기반 unit/component test 환경을 구성했다.
- Playwright Chromium E2E 환경을 구성했다.
- npm lockfile로 실제 검증된 dependency tree를 고정했다.

### 문서

- 설치, 환경 변수, Docker PostgreSQL, 개발 서버, 검증 명령을 `README.md`에 기록했다.
- 01단계 실행 결과와 미검증 항목을 `MASTER_PLAN.md`에 반영했다.

## 3. 구조 분석

```text
D:/mindmap
├── src/
│   ├── app/
│   │   ├── api/health/route.ts
│   │   ├── error.tsx
│   │   ├── globals.css
│   │   ├── layout.tsx
│   │   ├── loading.tsx
│   │   ├── not-found.tsx
│   │   └── page.tsx
│   ├── features/
│   ├── server/
│   └── shared/
│       └── config/env.ts
├── tests/
│   ├── e2e/foundation.spec.ts
│   ├── unit/env.test.ts
│   ├── unit/health-route.test.ts
│   └── unit/home-page.test.tsx
├── compose.yaml
├── package.json
├── package-lock.json
└── README.md
```

### `src/app`

Next.js route, layout, 화면 경계, Route Handler만 둔다. 향후 page가 비즈니스 로직을 직접 소유하지 않도록 `features`와 `server`를 호출하는 조립 계층으로 사용한다.

### `src/features`

후속 단계에서 `auth`, `dashboard`, `mindmap` 단위로 API client, component, hook, UI model을 둔다. 현재는 기능을 추측해 미리 만들지 않고 디렉터리 책임만 문서화했다.

### `src/server`

02단계부터 DB client, repository, domain service와 인증을 둔다. UI module이 서버 domain을 역으로 오염시키지 않도록 분리했다.

### `src/shared`

특정 도메인에 종속되지 않는 env, 공통 UI, utility, type을 둔다. 이번 단계에서는 env validation만 추가했다.

### `tests`

빠른 unit/component test와 실제 브라우저 E2E를 분리했다. DB integration test는 Prisma/PostgreSQL이 도입되는 02단계에 별도 영역으로 추가할 예정이다.

## 4. 주요 기술적 결정

### 단일 Next.js 풀스택 구조

PoC에서 별도 Frontend/Backend 배포 단위를 만들면 인증 cookie, CORS, 타입 공유, 로컬 실행이 불필요하게 복잡해진다. App Router와 Route Handler를 사용해 하나의 TypeScript 애플리케이션으로 시작했다.

이 결정은 Backend 계층을 page 내부에 섞는다는 의미가 아니다. HTTP 진입점은 `src/app/api`, 실제 DB/domain 로직은 `src/server`에 두는 경계를 유지한다.

### Health API를 DB 비의존 liveness로 구성

현재는 DB 계층이 아직 없으므로 health API가 PostgreSQL을 확인하도록 만들면 01단계와 02단계 의존성이 뒤섞인다. 따라서 01단계에서는 app process의 liveness만 확인한다.

향후 readiness가 필요하면 DB 연결을 검사하는 별도 endpoint 또는 응답 필드를 추가하는 편이 적절하다.

### 환경 변수 validation은 함수 호출 시 수행

```ts
const serverEnvSchema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  SESSION_SECRET: z.string().min(32, "SESSION_SECRET must be at least 32 characters"),
});

export function parseServerEnv(
  environment: Record<string, string | undefined> = process.env,
) {
  return serverEnvSchema.parse(environment);
}
```

module import 시 즉시 validation하면 DB를 쓰지 않는 build 또는 liveness test까지 환경 변수 때문에 실패할 수 있다. 필요한 server 기능이 시작될 때 명시적으로 호출하도록 함수를 분리했다.

### PostgreSQL을 Compose로 정의

```yaml
services:
  postgres:
    image: postgres:17-alpine
    ports:
      - "5432:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U mindmap -d mindmap"]
```

PostgreSQL 설치 방식에 따라 개발 환경이 달라지는 문제를 줄이고 02단계 migration/integration test가 같은 DB에서 실행되게 하려는 선택이다. 데이터 volume은 기본적으로 보존하며, README에는 `down -v`가 데이터를 삭제한다는 경고를 추가했다.

### 실제 브라우저 검증을 별도 E2E로 유지

```ts
test("renders the foundation page and exposes health", async ({ page, request }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", {
    name: "생각의 구조와 상세 기록을 한곳에서 연결합니다.",
  })).toBeVisible();

  const response = await request.get("/api/health");
  expect(response.ok()).toBe(true);
});
```

component test만으로는 Next.js 개발 서버, 실제 route, CSS compilation, browser rendering을 함께 확인할 수 없다. 최소 한 개의 Chromium smoke test를 기반 단계부터 두어 이후 주요 사용자 흐름 E2E의 출발점으로 삼았다.

## 5. 핵심 구현

### Health Route Handler

```ts
export function GET() {
  return NextResponse.json(
    {
      status: "ok",
      service: "mindmap-mvp",
      timestamp: new Date().toISOString(),
    },
    { status: 200 },
  );
}
```

응답은 자동화가 판별할 수 있는 고정된 `status`, `service`와 관측용 `timestamp`만 포함한다.

### 검증 script

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "lint": "eslint .",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:e2e": "playwright test"
  }
}
```

각 명령은 한 가지 실패 원인만 드러내도록 분리했다. 단계 완료 시 이 명령들을 조합해 검증한다.

## 6. 구현 중 발견한 문제와 해결

### `npm.ps1` 실행 정책 오류

Windows PowerShell 실행 정책 때문에 `npm.ps1`을 실행할 수 없었다. Node/npm 자체 문제는 아니므로 동일 npm CLI의 `npm.cmd`를 사용했다. 프로젝트 script나 package 내용은 이 환경 차이에 의존하지 않는다.

### Playwright package 선언 불일치

초기 설정은 `@playwright/test`에서 타입과 test runner를 import했지만 dependency에는 `playwright`만 선언되어 typecheck가 실패했다. 실제 import 경계와 일치하도록 `@playwright/test`를 dependency로 변경했다.

### Vitest의 TypeScript path alias 미인식

TypeScript의 `@/*` 경로는 Vitest/Vite가 자동 해석하지 않아 unit test import가 실패했다. `vitest.config.ts`의 `resolve.alias`에 `@ → ./src`를 명시했다.

### ESLint anonymous default export 경고

PostCSS 설정의 anonymous default object export가 lint warning을 발생시켰다. 이름 있는 `postcssConfig` 상수로 분리해 lint 결과를 warning 없이 유지했다.

### 인앱 Browser 미사용

현재 세션에는 연결 가능한 인앱 Browser가 없었다. 브라우저 확인을 생략하거나 성공으로 가정하지 않고, 프로젝트의 Playwright Chromium을 설치해 실제 browser rendering과 API를 검증했다.

### Docker 부재

현재 PC에는 Docker CLI와 daemon이 없다. `compose.yaml`은 Python YAML parser로 문법을 확인했지만 Docker Compose schema·container 기동 검증은 대체할 수 없다. 이 때문에 01단계를 `DONE`으로 처리하지 않았다.

## 7. 검증 결과

### PASS

| 검증 | 결과 |
|---|---|
| Node.js / npm | `24.13.1` / `11.8.0` |
| `npm install` | 465 packages 설치, 알려진 취약점 0개 |
| `npm run lint` | 오류·경고 없이 성공 |
| `npm run typecheck` | 성공 |
| `npm run test` | 3 files, 4 tests 성공 |
| `npm run build` | Next.js 16.3.1 production build 성공 |
| 개발 서버 health | HTTP 200, `status: ok` |
| `npm run test:e2e` | Chromium 1 test 성공 |
| Compose YAML 문법 | 파싱 성공 |

### NOT VERIFIED

- 사유: Docker CLI/daemon 미설치
- 미검증 항목:
  - `docker compose config`
  - `docker compose up -d postgres`
  - `docker compose ps`
  - PostgreSQL healthcheck 성공
- 상태 영향: 01단계 `🟡 IN_PROGRESS` 유지

## 8. Trade-off

### App Shell을 최소 구현한 이유

완전한 Auth 화면이나 Dashboard placeholder를 만들면 후속 단계에서 버려질 코드가 생긴다. 이번에는 CSS compilation, layout, browser rendering을 확인할 수 있는 수준만 구현했다. 시각적 완성도보다 실행 기반 검증을 우선한 선택이다.

### Docker를 설치하지 않은 이유

Docker Desktop 설치는 애플리케이션 dependency 설치와 달리 시스템 권한, 가상화 설정, 서비스 설치, 재시작 가능성이 있는 변경이다. 사용자 환경에 큰 영향을 줄 수 있어 이번 작업 범위에서 임의 설치하지 않았다.

### 최신 minor dependency를 lockfile로 고정한 이유

`package.json`은 호환 가능한 major 범위를 두고, 실제 검증된 설치 결과는 `package-lock.json`에 고정했다. 보안 patch를 받을 여지는 남기면서 CI/개발 환경에서는 동일 tree를 재현할 수 있다.

### DB 연결을 아직 구현하지 않은 이유

01단계에서 Prisma client나 migration까지 추가하면 02단계의 데이터 모델 설계와 검증 범위를 침범한다. Compose는 실행 기반만 제공하고 Entity/Schema/transaction은 계획대로 02단계에 남겼다.

## 9. 후속 개선 방향

### 01단계 완료를 위해 필요한 작업

Docker 사용 가능한 환경에서 다음을 실행한다.

```powershell
docker compose config
docker compose up -d postgres
docker compose ps
```

PostgreSQL health가 `healthy`인지 확인한 뒤 `MASTER_PLAN.md` 01 검증 기록을 갱신하고, 모든 Definition of Done이 충족되면 `✅ DONE`으로 변경한다.

### 02단계에서 이어질 작업

- Prisma schema와 migration
- User, Session, Mindmap, Node entity
- root node 유일성 및 사용자별 sequence 제약
- Mindmap + root transaction 생성
- repository integration test

### 품질 개선 후보

- CI 환경이 정해지면 lint/typecheck/test/build/E2E pipeline 추가
- DB 도입 후 liveness와 readiness 분리
- test coverage threshold는 실제 기능 코드가 생긴 이후 설정
- 운영 배포 환경이 결정되면 container image 또는 hosting 설정 추가

## 10. 결론

01단계에서 후속 기능을 구현할 수 있는 Next.js/TypeScript 기반, 서버 endpoint, 스타일, 테스트, 브라우저 E2E, PostgreSQL Compose 정의와 실행 문서를 마련했다. 정적 검사, unit test, production build, Chromium E2E는 모두 실제로 통과했다.

다만 Docker가 없는 현재 환경에서는 PostgreSQL 컨테이너 실행까지 증명할 수 없다. 계획의 상태 규칙에 따라 이를 성공으로 추정하지 않았고, 01단계는 `🟡 IN_PROGRESS`로 유지했다.
