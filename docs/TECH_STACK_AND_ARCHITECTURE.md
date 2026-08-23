# Mindmap 기술 스택과 운영 아키텍처 가이드

> 작성일: 2026-08-23  
> 기준 문서: `docs/MASTER_PLAN.md`  
> 현재 구현 범위: 01~07단계 완료, 08~12단계 예정

## 1. 먼저 보는 결론

PoC에서 운영 단계로 전환한다고 해서 프론트엔드와 백엔드를 반드시 분리해야 하는 것은 아니다.

이 프로젝트는 현재 Next.js 하나가 React 화면, HTTP API, 인증, 도메인 서비스를 함께 제공하는 **풀스택 모듈형 모놀리스**다. 웹 클라이언트 하나를 중심으로 한 서비스이고 팀과 트래픽 규모가 아직 크지 않다면, 운영에서도 이 구조를 유지하는 편이 개발·배포·장애 대응 측면에서 더 단순할 수 있다.

운영 전환에서 우선 필요한 것은 서버 분리가 아니라 다음 항목이다.

- 실제 PostgreSQL 환경에서 migration, integration test, E2E 검증
- TLS, 운영용 secret, 안전한 cookie와 환경 변수 관리
- DB 백업·복구, connection 관리와 monitoring
- CI/CD, 배포 롤백, 로그·지표·오류 추적
- rate limit, 입력 크기 제한, 권한 격리 등 보안 보강
- 1,000 node 기준 성능 측정과 병목 최적화

운영 중 독립 확장·독립 배포·다중 클라이언트·Python/Java 전용 작업 같은 요구가 실제로 생길 때 백엔드를 분리하는 것이 좋다. 서버 분리는 운영 단계의 필수 조건이 아니라, 복잡성을 감수할 만큼 분명한 이점이 생겼을 때 적용할 선택지다.

## 2. 모놀리스의 정확한 의미

모놀리스는 여러 애플리케이션 기능이 **하나의 배포 단위**로 제공되는 구조를 뜻한다.

현재 프로젝트는 다음 기능을 한 Next.js 애플리케이션으로 빌드하고 배포한다.

```text
Next.js 애플리케이션
├── React 화면과 페이지 라우팅
├── Route Handler 기반 HTTP API
├── 로그인·세션·접근 제어
├── Mindmap/Node 도메인 서비스
└── Prisma 기반 DB 접근
```

PostgreSQL은 별도 프로세스 또는 관리형 DB로 운영하지만, 이것 때문에 애플리케이션이 분산 서비스가 되는 것은 아니다. 일반적으로 모놀리스도 데이터베이스는 별도 인프라로 운영한다.

모놀리스가 모든 코드를 한 파일에 섞는다는 뜻도 아니다. 이 프로젝트는 내부 책임을 다음과 같이 분리했기 때문에 **모듈형 모놀리스(Modular Monolith)**에 가깝다.

```text
src/
├── app/       Next.js page와 API Route Handler
├── features/  auth, dashboard, mindmap UI와 client logic
├── server/    인증, DB, repository, domain service
└── shared/    공통 설정, provider, utility와 type
```

배포는 하나지만 UI, API, 비즈니스 규칙, 데이터 접근의 코드 경계는 유지한다.

## 3. 기존 분리형 구성과의 차이

### React + Spring/FastAPI

```text
브라우저
   ↓
React 프론트엔드 서버
   ↓ HTTP/REST
Spring 또는 FastAPI 서버
   ↓
PostgreSQL
```

### 현재 Next.js 풀스택 구성

```text
브라우저
   ↓
Next.js 애플리케이션
├── React UI
└── /api Route Handler
        ↓
   Domain Service
        ↓
   Prisma Repository
        ↓
   PostgreSQL
```

| 구분 | React + Spring/FastAPI | Next.js 풀스택 모놀리스 |
|---|---|---|
| 애플리케이션 배포 | 프론트와 백엔드가 별도 | 하나의 Next.js 앱 |
| 주요 언어 | TypeScript + Java/Python | TypeScript |
| API 진입점 | Controller/FastAPI route | Next.js Route Handler |
| 인증 cookie/CORS | 서비스 간 설정 필요 | 동일 출처 구성이 쉬움 |
| 타입 공유 | OpenAPI 또는 별도 계약 필요 | TypeScript 타입 공유가 쉬움 |
| 독립 배포·확장 | 상대적으로 쉬움 | 앱 전체를 함께 배포·확장 |
| 초기 운영 복잡도 | 상대적으로 높음 | 상대적으로 낮음 |

## 4. 이 프로젝트가 풀스택 모놀리스를 선택한 이유

Master Plan의 결정 기록에는 다음과 같이 명시되어 있다.

> 빈 저장소의 PoC에서 배포 단위와 타입 경계를 단순화하고 별도 서버 운영 부담을 줄이기 위함

구체적인 이유는 다음과 같다.

### 4.1 현재 기능이 웹 중심 MVP에 적합하다

현재 핵심 기능은 인증, 마인드맵 CRUD, 노드 편집, Markdown, 저장·삭제·내보내기다. 복잡한 분산 처리나 별도 계산 서버 없이 일반적인 웹 요청과 PostgreSQL transaction으로 처리할 수 있다.

### 4.2 프론트와 백엔드를 TypeScript로 통일한다

DTO와 API 계약을 같은 저장소에서 관리할 수 있고, 프론트와 서버 사이의 타입 불일치를 줄일 수 있다.

### 4.3 동일 출처 인증 구성이 단순하다

화면과 API가 같은 Next.js 서버에서 제공되므로 별도 API 도메인, CORS, cross-origin credential 설정을 줄일 수 있다. 현재 인증은 DB 기반 session과 `HttpOnly` cookie를 사용한다.

### 4.4 로컬 실행과 배포 단위가 작다

개발 환경에서 Next.js와 PostgreSQL만 실행하면 된다. 프론트와 API의 버전 호환, 별도 빌드 파이프라인, 두 서버의 환경 변수를 처음부터 각각 관리할 필요가 없다.

### 4.5 현재 조직과 제품 규모에서 분리 비용을 피한다

서비스를 나누면 API 계약, 네트워크 오류, 배포 순서, 로그 추적, CORS와 인증 정책 등 새로운 운영 문제가 생긴다. 아직 이 비용을 상쇄할 독립 확장이나 조직적 요구가 확인되지 않았다.

## 5. 현재 사용 중인 기술 스택

### 5.1 프론트엔드

| 기술 | 역할 | 상태 |
|---|---|---|
| Next.js 16 App Router | 페이지, layout, server component, loading/error 경계 | 적용됨 |
| React 19 | UI 컴포넌트와 화면 상태 | 적용됨 |
| TypeScript 5.9 | 정적 타입과 프론트·서버 타입 일관성 | 적용됨 |
| Tailwind CSS 4 | UI 스타일링 | 적용됨 |
| `@xyflow/react` 12 | 마인드맵 node/edge, drag, Pan/Zoom, Fit View | 적용됨 |
| TanStack Query 5 | 서버 상태, query/mutation, cache와 optimistic update | 적용됨 |
| React local state/custom hook | 선택 node, 편집 draft, 화면 상태 | 적용됨 |
| `react-markdown` + `remark-gfm` | Markdown 안전 렌더링과 GFM 미리보기 | 08단계 예정 |
| Radix Primitive | 접근성이 까다로운 Modal/Dropdown/Tabs 보조 | 필요 시 도입 예정 |

Redux나 Zustand 같은 전역 상태 라이브러리는 현재 사용하지 않는다. 실제 상태 복잡성이 커질 때 도입 여부를 다시 판단한다.

### 5.2 백엔드

| 기술 | 역할 | 상태 |
|---|---|---|
| Next.js Route Handler | `/api/auth`, `/api/mindmaps`, `/api/nodes`, `/api/health` | 적용됨 |
| Zod 4 | 요청 body와 환경 변수 검증 | 적용됨 |
| Prisma 7 | schema, migration, generated DB client | 적용됨 |
| `pg` + `@prisma/adapter-pg` | PostgreSQL 연결 | 적용됨 |
| `bcryptjs` | 비밀번호 hash | 적용됨 |
| Node.js 22+ | 애플리케이션 runtime | 적용됨 |

서버 내부 호출 흐름은 다음과 같다.

```text
Route Handler
   ↓
입력 검증과 인증·소유권 확인
   ↓
Domain Service
   ↓
Repository
   ↓
Prisma Client
   ↓
PostgreSQL
```

### 5.3 인증과 보안

- 이메일·비밀번호 기반 자체 인증
- `bcryptjs` 비밀번호 hash
- 무작위 opaque session token 발급
- 브라우저에는 token 원문을 `HttpOnly` cookie로 저장
- DB에는 token 원문이 아닌 hash 저장
- `SameSite=Lax`, 운영 환경 `Secure` cookie
- mutation 요청의 Origin/Host 검증
- 모든 Mindmap/Node query에 로그인 사용자 소유권 조건 적용
- 타 사용자 또는 존재하지 않는 자원은 일관된 404 처리
- Zod validation과 일관된 API error envelope

### 5.4 데이터베이스

- PostgreSQL 17
- Prisma migration과 seed
- `User`, `Session`, `Mindmap`, `Node` 모델
- UUID primary key
- 사용자별 Mindmap sequence와 index
- parent-child Node 관계와 cascade 삭제
- Node의 Markdown, 좌표, 접힘 상태, revision 저장
- 개발 DB와 integration test DB 분리

### 5.5 테스트와 품질 검사

| 기술 | 용도 |
|---|---|
| Vitest 4 | unit test |
| Testing Library | React component test |
| DB integration suite | repository/service/schema 검증 |
| Playwright | 실제 브라우저 E2E |
| ESLint 9 | 정적 코드 검사 |
| TypeScript | typecheck |
| Next.js production build | 배포 빌드 검증 |

## 6. 현재와 운영 환경의 서버 구성

### 6.1 로컬 개발 환경

```text
개발 PC
├── Node.js 22+
│   └── Next.js dev server :3000
└── Docker Compose
    └── PostgreSQL 17 :5432
        └── named volume
```

### 6.2 권장 운영 초기 구성

```text
사용자
   ↓ HTTPS
Load Balancer 또는 Hosting Edge
   ↓
Next.js 애플리케이션 인스턴스
   ├── React 화면
   ├── Route Handler API
   ├── 인증·도메인 서비스
   └── Prisma
         ↓ TLS connection
관리형 PostgreSQL
   ├── 자동 백업
   ├── 복구 정책
   └── monitoring
```

애플리케이션 인스턴스 자체에는 영구 session이나 사용자 데이터를 저장하지 않는다. 현재 session은 PostgreSQL에 있으므로 Next.js 인스턴스를 여러 개로 늘려도 같은 DB를 바라보게 구성할 수 있다.

운영 플랫폼은 아직 확정되지 않았다. container 기반 서버, Next.js hosting, VM 등 어느 방식을 택하더라도 `DATABASE_URL`, secret 관리, migration 실행 순서와 rollback 절차가 필요하다.

## 7. 운영 전환 시 우선 보강할 사항

### 애플리케이션

- production build와 health check
- 오류 추적, structured logging과 주요 지표
- request ID와 민감 정보 masking
- API rate limit과 body 크기 제한
- graceful shutdown과 배포 rollback
- 필요 시 background job 실행 방식 결정

### 데이터베이스

- 관리형 PostgreSQL 또는 검증된 PostgreSQL 17 환경
- 자동 백업과 실제 복구 훈련
- production migration 절차
- connection limit과 pooling 검토
- slow query와 index monitoring

### 보안

- 충분히 긴 운영용 `SESSION_SECRET`
- HTTPS와 `Secure` cookie
- secret manager 또는 안전한 환경 변수 주입
- 사용자 데이터 소유권 회귀 테스트
- dependency 취약점 관리

### 품질과 배포

- lint, typecheck, unit, integration, E2E, build를 CI에서 실행
- staging 환경에서 migration과 브라우저 시나리오 검증
- 배포 전후 smoke test
- 1,000 node fixture 성능 기준 측정

## 8. 프론트엔드와 백엔드를 분리해야 하는 신호

다음 중 하나 이상이 실제 문제로 확인되면 Spring, FastAPI 또는 별도 Node backend 분리를 검토할 수 있다.

### 제품과 클라이언트

- 모바일 앱, 데스크톱 앱, 외부 고객이 같은 API를 사용한다.
- 공개 API의 독립 버전 관리가 필요하다.
- 프론트와 무관한 partner integration이 많아진다.

### 조직과 배포

- 프론트팀과 백엔드팀의 배포 주기가 뚜렷하게 다르다.
- 백엔드 변경 없이 프론트만, 또는 반대로 독립 배포해야 하는 빈도가 높다.
- 서비스별 소유 팀과 장애 책임을 분리해야 한다.

### 성능과 확장

- API 트래픽만 독립적으로 크게 확장해야 한다.
- CPU 집약적인 작업이 Next.js 요청 처리를 방해한다.
- 장시간 background job, queue consumer, WebSocket 처리가 중요해진다.
- 한 애플리케이션 장애가 전체 기능에 미치는 영향을 줄여야 한다.

### 기술 요구

- AI/ML 처리 때문에 Python 생태계가 핵심이 된다.
- Java 기반 사내 시스템, 강한 조직 표준 또는 JVM 라이브러리가 필요하다.
- 별도 서비스가 가져야 할 보안·규제 경계가 생긴다.

단순히 사용자가 늘었거나 운영 서비스가 되었다는 이유만으로는 분리 근거가 충분하지 않다. 모놀리스도 여러 인스턴스로 수평 확장하고 관리형 PostgreSQL을 연결해 상당한 규모까지 운영할 수 있다.

## 9. 분리하지 않는 것이 나은 신호

- 주 클라이언트가 현재 웹앱 하나다.
- 한 팀이 프론트와 백엔드를 함께 개발한다.
- 주요 기능이 request/response 기반 CRUD다.
- 병목이 코드 구조가 아니라 query, index, payload 또는 렌더링에 있다.
- 독립 배포보다 end-to-end 변경이 더 자주 발생한다.
- 분리 후 추가되는 CORS, API 계약, 관측성과 배포 비용을 담당할 인력이 없다.

## 10. 이 프로젝트에 권장하는 진화 순서

### 1단계: 현재 모듈형 모놀리스 완성

08~11 기능을 구현하고 12단계에서 PostgreSQL integration, Playwright E2E, 보안 회귀와 1,000 node 성능을 검증한다.

### 2단계: 같은 구조로 운영 안정화

Next.js 애플리케이션과 관리형 PostgreSQL로 먼저 운영한다. 로그, monitoring, backup, CI/CD, rate limit과 connection 관리부터 보강한다.

### 3단계: 측정된 병목만 분리

예를 들어 Markdown export나 AI 기능이 장시간 작업이 되면 queue와 worker를 먼저 분리할 수 있다. 전체 백엔드를 한 번에 교체할 필요는 없다.

```text
Next.js 모놀리스
├── 화면/API/일반 CRUD
└── Queue → Export 또는 AI Worker
```

### 4단계: 명확한 필요가 생기면 독립 API로 전환

모바일·공개 API·독립 백엔드 조직이 생기면 Spring 또는 FastAPI 서비스를 두고 Next.js를 프론트/BFF로 축소할 수 있다.

```text
브라우저
   ↓
Next.js Frontend/BFF
   ↓
Spring 또는 FastAPI
   ↓
PostgreSQL
```

현재 코드도 Route Handler, Domain Service, Repository가 분리되어 있어 이러한 전환을 준비하기에 비교적 유리하다. 다만 Java/Python으로 이동할 경우 TypeScript domain service는 재작성해야 하므로, 실제 사업·성능·조직상의 근거가 있을 때 진행하는 것이 좋다.

## 11. 최종 권고

이 프로젝트는 운영 초기에도 풀스택 모듈형 모놀리스를 유지하는 것을 기본 선택으로 삼는다.

1. 먼저 현재 구조로 MVP와 실제 DB 검증을 완료한다.
2. 운영에 필요한 보안·백업·관측성·CI/CD를 갖춘다.
3. 트래픽과 장애 데이터를 측정한다.
4. 독립 확장이나 다른 언어가 필요한 부분만 점진적으로 추출한다.

따라서 질문에 대한 답은 다음과 같다.

> 운영 단계가 되었다고 프론트엔드와 백엔드를 반드시 분리할 필요는 없다. 현재 모듈형 모놀리스로도 운영할 수 있으며, 분리는 운영 중 확인된 확장·조직·기술적 요구가 그 비용보다 클 때 진행한다.

## 12. 관련 문서와 설정

- `docs/MASTER_PLAN.md`: 전체 계획, 목표 아키텍처와 Decision Log
- `README.md`: 로컬 실행, DB, 검사 명령
- `package.json`: 현재 dependency와 script
- `compose.yaml`: 로컬 PostgreSQL 17
- `prisma/schema.prisma`: 데이터 모델
- `src/app/api/**`: Next.js Route Handler
- `src/server/**`: 인증, DB, repository와 domain service
