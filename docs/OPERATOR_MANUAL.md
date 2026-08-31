# Mindmap MVP 실행·환경 운영자 매뉴얼

이 문서는 개발자가 아니더라도 현재 구현된 Mindmap MVP를 로컬에서 실행하고, 환경별 차이와 데이터베이스 관리 범위를 이해할 수 있도록 정리한 안내서입니다.

> 결론부터 말하면 **Docker는 필수가 아닙니다.** 다만 로그인, 마인드맵 생성, 자동저장, 삭제, Markdown 내보내기 등 실제 기능은 PostgreSQL을 사용하므로, 전체 기능을 보려면 로컬 또는 외부에 PostgreSQL 데이터베이스 하나가 필요합니다. 테이블을 직접 만들 필요는 없으며, 프로젝트의 Prisma migration 명령이 자동으로 구성합니다.

## 빠른 시작: Neon을 사용하는 경우

Neon의 연결 주소와 `SESSION_SECRET`을 `.env`에 입력한 뒤, 프로젝트를 처음 준비할 때 아래 명령을 순서대로 한 번 실행합니다. PowerShell의 스크립트 실행 정책 때문에 `npm`이 차단되는 환경을 고려하여 `npm.cmd`를 사용합니다.

```powershell
npm.cmd install
npm.cmd run db:generate
npm.cmd run db:migrate:deploy
npm.cmd run dev
```

마지막 명령이 실행된 상태에서 브라우저로 <http://localhost:3000>에 접속합니다. 서버를 종료할 때는 해당 터미널에서 `Ctrl+C`를 누릅니다.

설치와 데이터베이스 준비를 마친 이후에는 평소 다음 명령만 실행하면 됩니다.

```powershell
npm.cmd run dev
```

다음 상황에서는 관련 준비 명령을 다시 실행합니다.

- `package.json` 또는 의존성이 변경된 경우: `npm.cmd install`
- Prisma 스키마나 migration이 변경된 경우: `npm.cmd run db:generate` 후 `npm.cmd run db:migrate:deploy`
- `.env`를 변경한 경우: 실행 중인 서버를 `Ctrl+C`로 종료한 후 `npm.cmd run dev`

Neon은 외부 PostgreSQL이므로 앱을 실행할 때 Docker나 로컬 PostgreSQL을 별도로 시작할 필요가 없습니다.

## 1. 가장 먼저 선택할 실행 방식

| 목적 | 앱 실행 방식 | PostgreSQL | 추천 대상 |
|---|---|---|---|
| 로그인 화면과 서버 기동만 확인 | `npm run dev` | 없어도 기동 가능 | 아주 빠른 외형 확인 |
| 실제 기능을 가볍게 체험 | `npm run dev` | Docker, PC 직접 설치, 외부 DB 중 하나 | 일반 사용자·개발자 |
| 배포와 가까운 형태로 확인 | `npm run build` + `npm run start` | 필요 | 운영 전 빌드 확인 |
| 자동 테스트만 실행 | `npm run test` | 단위·컴포넌트 테스트에는 불필요 | 코드 회귀 확인 |
| 12단계 최종 인수·성능 검증 | `npm run test:acceptance` | 전용 DB 2개 필수 | 최종 검증 담당자 |

가볍게 기능을 둘러보려는 경우에는 아래 세 가지 중 편한 DB 방식 하나만 선택하면 됩니다.

```mermaid
flowchart TD
    A[현재 구현을 실행하고 싶다] --> B{저장 기능까지 볼 것인가?}
    B -->|아니요| C[npm run dev<br/>로그인 화면·health 확인]
    B -->|예| D{Docker 사용 가능?}
    D -->|예| E[Docker PostgreSQL<br/>가장 재현하기 쉬움]
    D -->|아니요| F{PC에 PostgreSQL 설치 가능?}
    F -->|예| G[Native PostgreSQL]
    F -->|아니요| H[외부 PostgreSQL URL 사용]
    E --> I[Prisma migration 실행]
    G --> I
    H --> I
    I --> J[npm run dev → 회원가입 → 기능 체험]
```

## 2. 공통 준비 사항

- Windows 10/11 또는 macOS/Linux
- Node.js 22 이상
- npm 10 이상
- 전체 기능 확인 시 PostgreSQL 17 권장
- 프로젝트 경로: `D:\mindmap`

PowerShell에서 버전을 확인합니다.

```powershell
node --version
npm --version
```

처음 한 번 프로젝트 의존성과 환경 파일을 준비합니다.

```powershell
Set-Location D:\mindmap
Copy-Item .env.example .env
npm install
```

`.env`의 `SESSION_SECRET`은 예제 문자열을 그대로 사용하지 말고 32자 이상의 임의 문자열로 변경하는 편이 안전합니다. `.env`는 Git에 커밋하지 않습니다.

```dotenv
DATABASE_URL=postgresql://mindmap:mindmap@localhost:5432/mindmap?schema=public
TEST_DATABASE_URL=postgresql://mindmap:mindmap@localhost:5432/mindmap_test?schema=public
SESSION_SECRET=개발환경에서도-충분히-긴-32자-이상의-임의-문자열
NEXT_PUBLIC_APP_NAME=Mindmap
APP_BASE_URL=http://localhost:3000
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
```

## 3. 정말 가볍게 화면만 확인하기 — DB 없음

DB가 없어도 Next.js 개발 서버와 로그인 화면, health API까지는 확인할 수 있습니다.

```powershell
npm run dev
```

- 앱: <http://localhost:3000>
- 서버 health: <http://localhost:3000/api/health>
- 종료: 실행 중인 터미널에서 `Ctrl+C`

이 방식에서는 `/api/health`가 `status: ok`를 반환하더라도 DB 연결까지 검증한 것은 아닙니다. 회원가입·로그인·마인드맵 저장 요청은 DB가 없으면 실패합니다. 현재 프로젝트에는 mock/demo DB 모드가 없기 때문에 **실제 Editor 기능을 보려면 다음 장의 DB 준비가 필요합니다.**

## 4. 전체 기능 실행 — 방법 A: Docker 사용

Docker Desktop 또는 Docker Engine을 이미 쓸 수 있다면 가장 재현하기 쉬운 방식입니다. Docker는 앱까지 감싸는 것이 아니라 PostgreSQL 17만 실행합니다. Next.js 앱은 평소처럼 PC에서 `npm run dev`로 실행합니다.

```mermaid
flowchart LR
    Browser[브라우저] -->|localhost:3000| Next[Next.js 개발 서버]
    Next -->|localhost:5432| DB[(Docker PostgreSQL 17)]
```

### 4.1 DB 시작

```powershell
docker compose up -d postgres
docker compose ps
```

`postgres`가 `healthy`가 될 때까지 잠시 기다립니다.

### 4.2 DB 테이블 구성

```powershell
npm run db:migrate:deploy
npm run db:generate
```

직접 SQL로 테이블을 만들 필요가 없습니다. `db:migrate:deploy`가 `prisma/migrations`에 저장된 schema 변경 이력을 DB에 적용합니다.

### 4.3 앱 실행과 로그인

```powershell
npm run dev
```

1. <http://localhost:3000>에 접속합니다.
2. `회원가입` 탭을 선택합니다.
3. 사용할 이메일과 비밀번호로 계정을 만듭니다.
4. 로그인 후 마인드맵을 생성하여 기능을 확인합니다.

`npm run db:seed`로 만들어지는 `alice@example.test`, `bob@example.test`는 개발 데이터 구조 확인용이며 비밀번호 로그인이 비활성화되어 있습니다. 직접 체험할 계정은 화면에서 새로 가입하세요.

### 4.4 종료와 재시작

```powershell
# 앱은 실행 터미널에서 Ctrl+C
docker compose down
```

`docker compose down` 후에도 named volume의 DB 데이터는 남습니다. 다음 실행 때는 아래 두 명령만 수행하면 됩니다.

```powershell
docker compose up -d postgres
npm run dev
```

데이터를 완전히 지우는 `docker compose down -v`는 복구가 어려운 삭제 명령입니다. 테스트 데이터를 정말 초기화하려는 경우에만 사용합니다.

## 5. 전체 기능 실행 — 방법 B: Docker 없이 PC에 PostgreSQL 설치

Docker가 실행되지 않거나 WSL/가상화 설정이 부담스러우면 PostgreSQL을 Windows에 직접 설치해도 됩니다.

### 5.1 데이터베이스 준비

PostgreSQL 설치 프로그램으로 서버와 `psql`을 설치한 후 관리자 계정으로 다음 SQL을 한 번만 실행합니다. 이미 동일한 사용자나 DB가 있다면 해당 환경에 맞게 이름을 변경합니다.

```sql
CREATE ROLE mindmap WITH LOGIN PASSWORD 'mindmap';
CREATE DATABASE mindmap OWNER mindmap;
```

PowerShell에서 `psql`을 사용할 수 있다면 다음처럼 접속할 수 있습니다.

```powershell
psql -U postgres -h localhost
```

프로젝트의 기본 `.env`는 위 사용자와 DB를 가리킵니다.

```dotenv
DATABASE_URL=postgresql://mindmap:mindmap@localhost:5432/mindmap?schema=public
```

다른 포트·사용자·비밀번호를 선택했다면 `DATABASE_URL`만 실제 값으로 수정합니다.

### 5.2 schema 적용과 앱 실행

```powershell
npm run db:migrate:deploy
npm run db:generate
npm run dev
```

이후 절차는 Docker 방식과 동일하게 브라우저에서 회원가입하여 사용하면 됩니다. PostgreSQL 서비스의 시작·종료는 Windows `서비스` 앱이나 PostgreSQL 설치 도구로 관리합니다.

## 6. 전체 기능 실행 — 방법 C: 외부 PostgreSQL 사용

PC에 Docker나 PostgreSQL을 설치하고 싶지 않다면, 접근 가능한 외부 PostgreSQL에서 DB 하나를 만든 뒤 발급된 접속 URL을 사용할 수 있습니다. 일반 기능 체험에는 DB 하나만 있으면 됩니다.

```dotenv
DATABASE_URL=postgresql://사용자:비밀번호@호스트:5432/DB이름?sslmode=require
SESSION_SECRET=32자-이상의-별도-임의-문자열
```

그 다음 로컬 PowerShell에서 실행합니다.

```powershell
npm run db:migrate:deploy
npm run db:generate
npm run dev
```

주의사항:

- 일반 개발용 DB를 사용하고, 실제 서비스 데이터가 있는 운영 DB를 연결하지 마세요.
- DB 제공자가 요구하면 `sslmode=require` 같은 SSL 옵션을 URL에 포함합니다.
- 비밀번호에 `@`, `:`, `/`, `#` 같은 문자가 있으면 URL encoding이 필요합니다.
- 접속 URL과 비밀번호는 `.env`에만 두고 문서·Git·메신저에 그대로 남기지 않습니다.
- `npm run test:integration`이나 `npm run test:acceptance`는 DB를 초기화할 수 있으므로 이 일반 개발 DB를 대상으로 실행하지 않습니다.

## 7. 개발 모드와 운영에 가까운 모드

### 개발 모드 — 평소 기능 확인에 추천

```powershell
npm run dev
```

- 코드 변경을 자동 반영합니다.
- 오류 메시지와 개발 도구가 자세합니다.
- 현재 구현을 둘러보는 용도로 가장 편합니다.

### Production mode — 빌드 가능성과 실제 번들 확인

먼저 개발 서버를 종료한 뒤 실행합니다.

```powershell
npm run build
npm run start
```

- 앱 주소는 기본적으로 <http://localhost:3000>입니다.
- 코드 변경 시 다시 `npm run build`해야 합니다.
- 이것은 로컬에서 production build를 실행하는 것이며, 실제 인터넷 운영 서버에 배포한 것은 아닙니다.
- production mode도 동일한 `DATABASE_URL`의 PostgreSQL이 필요합니다.

```mermaid
flowchart TD
    Source[소스 코드] --> Dev[npm run dev<br/>빠른 개발 확인]
    Source --> Build[npm run build]
    Build --> Start[npm run start<br/>로컬 production mode]
    Start --> Acceptance[Playwright·성능 인수 검증]
    Start -. 배포 작업은 별도 .-> Live[실제 운영 서비스]
```

## 8. 현재 구현에서 확인할 수 있는 기능

회원가입 후 다음 흐름으로 주요 기능을 확인할 수 있습니다.

1. Dashboard에서 마인드맵 생성·이름 변경
2. Editor에서 child Node 생성, 제목 편집, drag, 접기/펼치기
3. Node 상세 패널에서 Markdown 편집·GFM 미리보기·전체화면
4. 2초 자동저장, 저장 상태, 실패 후 재시도와 로컬 초안 복구
5. 일반 Node subtree 안전 삭제와 Mindmap 삭제
6. 전체 Mindmap, 현재 Node, subtree Markdown 내보내기

브라우저를 새로고침한 뒤 제목·좌표·접힘·Markdown이 유지되는지 확인하면 DB 저장도 함께 검증할 수 있습니다.

## 9. 데이터베이스 운영 명령

| 명령 | 용도 | 데이터 위험 |
|---|---|---|
| `npm run db:generate` | Prisma client 재생성 | 없음 |
| `npm run db:migrate:deploy` | 기존 migration 적용 | 일반 실행용 |
| `npm run db:migrate -- --name 이름` | schema 변경용 새 migration 생성 | 개발자 작업용 |
| `npm run db:studio` | DB 내용을 GUI로 조회·수정 | 수정·삭제 주의 |
| `npm run db:seed` | 개발용 사용자·기본 Mindmap 보충 | 멱등 실행, 로그인용 계정 아님 |

Prisma Studio를 열려면 DB를 먼저 실행한 뒤 다음 명령을 사용합니다.

```powershell
npm run db:studio
```

표시되는 URL로 접속하면 User, Session, Mindmap, Node 데이터를 확인할 수 있습니다. 운영 데이터에는 직접 수정 대신 앱 API를 사용하는 것이 안전합니다.

## 10. 테스트 명령과 필요한 환경

| 명령 | DB 필요 | 설명 |
|---|---:|---|
| `npm run lint` | 아니요 | 코드 규칙 검사 |
| `npm run typecheck` | 아니요 | TypeScript 검사 |
| `npm run test` | 아니요 | unit/component 테스트 |
| `npm run build` | 일반적으로 아니요 | production bundle 생성 |
| `npm run test:integration` | 예, **전용 `mindmap_test`** | 실제 PostgreSQL 통합 테스트 |
| `npm run test:e2e` | 예 | 브라우저 기능 테스트 |
| `npm run test:e2e:production` | 예 | build + `next start` 브라우저 테스트 |
| `npm run test:acceptance` | 예, **전용 DB 2개** | 12단계 전체 인수·성능 검증 |

Playwright 브라우저가 설치되지 않았다면 최초 한 번 실행합니다.

```powershell
npx playwright install chromium
```

## 11. 12단계 인수 환경은 일상 실행과 다릅니다

12단계는 실제 운영 사이트를 검사하는 것이 아니라, **로컬에서 production build/`next start`를 실행하되 Remote PostgreSQL 전용 DB로 누적 기능·보안·1,000-node 성능을 검증하는 환경**입니다.

필요한 DB는 다음 두 개입니다.

- `mindmap_acceptance`: production E2E와 성능 fixture용
- `mindmap_test`: integration 실행마다 초기화되는 테스트용

```powershell
Copy-Item .env.acceptance.example .env.acceptance.local
# 파일 안의 URL, 비밀번호, SESSION_SECRET을 실제 전용 DB 값으로 변경
npm run test:acceptance
```

이 명령은 안전 확인을 거친 뒤 전용 DB schema를 초기화합니다. 이름만 비슷한 일반 개발 DB나 실제 운영 DB를 연결해서는 안 됩니다. 현재 구현을 잠깐 둘러보는 데에는 이 환경이 전혀 필요하지 않습니다.

## 12. 자주 발생하는 문제

### `ECONNREFUSED`, `P1001`, `Can't reach database server`

PostgreSQL이 실행되지 않았거나 URL/포트가 다릅니다.

```powershell
Test-NetConnection localhost -Port 5432
docker compose ps
```

- Docker 방식: Docker Desktop 실행 후 `docker compose up -d postgres`
- 직접 설치: Windows PostgreSQL 서비스가 실행 중인지 확인
- 외부 DB: 방화벽, SSL 옵션, 허용 IP 확인

### Docker가 실행되지 않음

Docker Desktop이 중지됐거나 WSL2/가상화가 비활성화된 경우입니다. Docker 설정을 고치지 않아도 이 문서의 **방법 B(직접 설치)** 또는 **방법 C(외부 PostgreSQL)**로 실행할 수 있습니다.

### `port 5432 is already allocated`

PC에 다른 PostgreSQL이 이미 5432 포트를 사용 중일 가능성이 큽니다. 기존 DB를 방법 B처럼 사용하거나, `compose.yaml`의 host 포트를 예를 들어 `5433:5432`로 바꾸고 `.env` URL도 `localhost:5433`으로 맞춥니다.

### `SESSION_SECRET must be at least 32 characters`

`.env`의 `SESSION_SECRET`을 공백 없는 32자 이상 값으로 변경하고 서버를 다시 시작합니다.

### migration은 성공했는데 로그인할 수 없음

seed 계정은 로그인용이 아닙니다. 브라우저의 `회원가입` 탭에서 새 계정을 생성합니다. 기존 회원가입 이메일을 다시 쓰면 중복 오류가 나므로 다른 이메일을 사용하거나 원래 비밀번호로 로그인합니다.

### 변경한 환경변수가 적용되지 않음

실행 중인 Next.js 서버를 `Ctrl+C`로 종료하고 다시 `npm run dev` 또는 `npm run start`를 실행합니다.

### DB를 새로 시작하고 싶음

개발 데이터 삭제가 확실히 괜찮은지 먼저 확인하세요. Docker volume 삭제는 해당 Compose DB 전체를 지웁니다.

```powershell
docker compose down -v
docker compose up -d postgres
npm run db:migrate:deploy
```

## 13. 일상 실행 체크리스트

### Docker를 쓰는 경우

```powershell
Set-Location D:\mindmap
docker compose up -d postgres
npm run dev
```

종료할 때:

```powershell
# 앱 터미널에서 Ctrl+C
docker compose down
```

### 직접 설치 또는 외부 DB를 쓰는 경우

```powershell
Set-Location D:\mindmap
npm run dev
```

로컬 PostgreSQL 서비스는 필요에 따라 별도로 시작·종료합니다. 외부 DB라면 별도 로컬 DB 시작 과정은 없습니다.

## 14. Google 소셜 로그인 설정

OAuth 키가 없으면 소셜 로그인 버튼은 숨겨지며 기존 이메일 로그인은 그대로 동작합니다. 로컬 OAuth를 사용할 때 브라우저 주소와 `APP_BASE_URL`은 반드시 `http://localhost:3000`으로 통일하고 `127.0.0.1`과 혼용하지 않습니다.

1. Google Cloud Console에서 OAuth 2.0 Web application client를 생성합니다.
2. Authorized redirect URI에 `http://localhost:3000/api/auth/oauth/google/callback`을 정확히 등록합니다.
3. `.env`의 `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`을 채웁니다.
4. 앱은 로그인 목적의 `openid email` scope만 요청하며 Gmail 메일함 권한은 요청하지 않습니다.

ID와 secret 중 하나만 입력하면 안전하지 않은 부분 설정으로 판단해 환경 검증 오류가 발생합니다. 값을 변경한 뒤에는 개발 서버를 다시 시작합니다. 현재 실연동 검증 상태와 후속 인증 기능은 `docs/AUTH_BACKLOG.md`에서 추적합니다.

## 15. 최소 권장 경로

현재 구현을 **가볍게 직접 사용해 보는 것**이 목적이라면 다음 순서가 가장 짧습니다.

1. Docker가 이미 되면 방법 A를 사용합니다.
2. Docker가 안 되면 외부 PostgreSQL DB 하나의 URL을 `.env`에 넣는 방법 C가 설치 부담이 가장 적습니다.
3. 외부 DB도 원하지 않으면 PostgreSQL을 PC에 직접 설치하는 방법 B를 사용합니다.
4. 어느 경우든 DB 테이블은 `npm run db:migrate:deploy`가 만들며, 사용자가 직접 schema를 작성할 필요는 없습니다.
5. `npm run dev` 후 화면에서 회원가입하면 전체 기능을 확인할 수 있습니다.

현재는 완전한 DB 없는 demo/mock mode가 구현되어 있지 않습니다. 따라서 로그인 화면 너머의 실제 동작을 확인할 때 필요한 최소 외부 구성은 PostgreSQL DB 하나입니다.
