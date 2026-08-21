# Mindmap MVP

개인 지식을 마인드맵으로 구조화하고 각 node에 Markdown 상세 내용을 기록하는 웹앱 MVP입니다. 실행 계획과 단계 상태는 `docs/MASTER_PLAN.md`에서 관리합니다.

## 요구 환경

- Node.js 22 이상
- npm 10 이상
- 실제 DB 통합 검증 시 PostgreSQL 17 또는 Docker Desktop/Engine + Compose plugin

## 기능 UI 실행

```powershell
Copy-Item .env.example .env
npm install
npm run dev
```

브라우저에서 `http://localhost:3000`을 열면 비로그인 사용자는 `/login`으로 이동합니다. health endpoint는 `http://localhost:3000/api/health`입니다. 가입·로그인과 실제 저장 기능은 PostgreSQL 연결이 필요합니다.

## PostgreSQL 통합 실행

```powershell
docker compose up -d postgres
npm run db:migrate:deploy
npm run db:generate
npm run db:seed
```

DB 상태 확인:

```powershell
docker compose ps
```

종료:

```powershell
docker compose down
```

`docker compose down -v`는 로컬 DB 데이터를 삭제하므로 데이터 초기화가 명확히 필요한 경우에만 사용합니다.

## 환경 변수

`.env.example`을 `.env`로 복사하고 값을 변경합니다. `.env`는 Git에 포함하지 않습니다.

| 이름 | 용도 |
|---|---|
| `DATABASE_URL` | PostgreSQL 연결 문자열 |
| `TEST_DATABASE_URL` | 로컬 integration test 전용 `mindmap_test` 연결 문자열 |
| `SESSION_SECRET` | 세션 보안용 32자 이상 비밀값 |
| `NEXT_PUBLIC_APP_NAME` | 브라우저에 노출 가능한 서비스명 |

## 검사 명령

```powershell
npm run lint
npm run typecheck
npm run test
npm run test:integration
npm run test:e2e
npm run build
```

`test:integration`은 안전 검사를 통과한 `localhost/mindmap_test`만 초기화하고 migration을 적용합니다. 개발 DB에는 사용하지 마세요.

Prisma schema를 변경한 뒤에는 migration과 generated client를 각각 갱신합니다.

```powershell
npm run db:migrate -- --name <migration-name>
npm run db:generate
```

Playwright Chromium이 없다면 최초 한 번 설치합니다.

```powershell
npx playwright install chromium
```

## 기본 구조

```text
src/
├── app/       Next.js page와 Route Handler
├── features/  auth, dashboard, mindmap 도메인 UI/client
├── server/    인증, DB, repository, domain service
└── shared/    공통 설정, UI, utility, type

tests/
├── unit/
├── integration/
└── e2e/
```
