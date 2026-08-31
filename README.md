# Mindmap MVP

개인 지식을 마인드맵으로 구조화하고 각 node에 Markdown 상세 내용을 기록하는 웹앱 MVP입니다. 실행 계획과 단계 상태는 `docs/MASTER_PLAN.md`에서 관리합니다.

서비스의 실제 사용 방법은 [사용자 매뉴얼](docs/USER_MANUAL.md)을, Docker 없이 실행하는 방법, 로컬·외부 DB 선택, production mode, 테스트 환경과 문제 해결은 [실행·환경 운영자 매뉴얼](docs/OPERATOR_MANUAL.md)을 참고하세요.

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

## 12단계 Remote 인수 검증

최종 인수 검증은 일반 개발·운영 DB가 아닌 PostgreSQL 17 전용 DB 두 개를 사용합니다.

- `mindmap_acceptance`: production E2E와 1,000-node 성능 측정용
- `mindmap_test`: integration suite가 매 실행마다 `public` schema를 초기화하는 용도

두 URL과 reset 확인값은 shell 또는 비공개 `.env.acceptance.local`에 설정하며 저장소에 커밋하지 않습니다. 가장 간단한 방법은 example 파일을 복사한 뒤 실제 값을 넣는 것입니다.

```powershell
Copy-Item .env.acceptance.example .env.acceptance.local
# .env.acceptance.local의 URL, 비밀번호와 SESSION_SECRET을 실제 검증값으로 변경
```

shell 환경변수로 직접 주입해도 됩니다.

```powershell
$env:DATABASE_URL = "postgresql://<user>:<password>@<host>:5432/mindmap_acceptance?sslmode=require"
$env:TEST_DATABASE_URL = "postgresql://<user>:<password>@<host>:5432/mindmap_test?sslmode=require"
$env:ACCEPTANCE_DATABASE_RESET_CONFIRM = "mindmap_acceptance"
$env:TEST_DATABASE_RESET_CONFIRM = "mindmap_test"
$env:SESSION_SECRET = "<32자 이상의 별도 비밀값>"
npm run test:acceptance
```

`test:acceptance`는 다음을 순서대로 실행합니다.

1. Acceptance DB 이름·확인값·Test DB 분리를 검증하고 schema를 초기화합니다.
2. migration deploy/status와 seed 2회를 실행합니다.
3. Test DB를 별도로 초기화하고 integration suite 전체를 실행합니다.
4. 결정적 100/1,000-node fixture와 backend 성능 계측을 실행합니다.
5. production build와 `next start`를 대상으로 Playwright 인수 검증을 실행합니다.

DB 이름이 다르거나 두 URL이 같은 경우, remote 확인값이 없거나 system DB를 가리키는 경우에는 실제 연결 전에 중단합니다. Remote 계정은 두 전용 DB의 `public` schema를 drop/create하고 migration을 적용할 권한이 필요합니다.

개별 명령은 다음과 같습니다.

```powershell
npm run db:acceptance:setup
npm run test:integration
npm run perf:seed
npm run perf:backend
npm run test:e2e:production
```

성능 결과는 실행 중 `artifacts/performance/backend.json`과 `browser.json`에 생성됩니다. 이 디렉터리는 실행 환경별 결과이므로 Git에 포함하지 않고, 최종 판정 수치는 12단계 개발 로그에 옮겨 기록합니다.

## 환경 변수

`.env.example`을 `.env`로 복사하고 값을 변경합니다. `.env`는 Git에 포함하지 않습니다.

| 이름 | 용도 |
|---|---|
| `DATABASE_URL` | PostgreSQL 연결 문자열 |
| `TEST_DATABASE_URL` | 로컬 integration test 전용 `mindmap_test` 연결 문자열 |
| `ACCEPTANCE_DATABASE_RESET_CONFIRM` | Remote acceptance DB 초기화를 허용하는 정확한 DB 이름 확인값 |
| `TEST_DATABASE_RESET_CONFIRM` | Remote integration DB 초기화를 허용하는 정확한 DB 이름 확인값 |
| `SESSION_SECRET` | 세션 보안용 32자 이상 비밀값 |
| `NEXT_PUBLIC_APP_NAME` | 브라우저에 노출 가능한 서비스명 |

## 검사 명령

```powershell
npm run lint
npm run typecheck
npm run test
npm run test:integration
npm run test:e2e
npm run test:e2e:production
npm run build
```

`test:integration`은 기본적으로 안전 검사를 통과한 `localhost/mindmap_test`만 초기화합니다. Remote `mindmap_test`는 명시적 확인값이 있을 때만 지원하며 acceptance URL과 같은 DB이면 거부합니다. 어떤 경우에도 개발·운영 DB에는 사용하지 마세요.

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

scripts/
├── acceptance/  # 전용 DB reset 안전장치와 acceptance bootstrap
└── performance/ # 결정적 fixture와 backend 계측
```

## 알려진 제한

- 브라우저 종료 시 keepalive 저장 성공은 보장할 수 없어 local draft journal을 최종 복구 수단으로 사용합니다.
- 1,000-node 성능 합격은 production mode에서 expanded/collapsed fixture를 각각 1회 warm-up 후 5회 측정해 모든 실행이 최초 표시 2초, 사용 가능 5초 이하여야 합니다.
- ZIP, PDF, PNG, import, 공유, 공동 편집과 모바일 전용 Editor는 MVP 범위에 포함되지 않습니다.
