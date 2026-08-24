# 12단계 1,000 Node 성능·보안 회귀·최종 인수 검증

> 작업일: 2026-08-24  
> 대상 단계: `docs/MASTER_PLAN.md` 12  
> 현재 상태: `🟡 IN_PROGRESS`  
> 완료 조건: Remote PostgreSQL integration·production E2E·두 1,000-node fixture의 2초/5초 실측 통과

## 1. 변경 이유

01~11단계에서는 PostgreSQL 실행 환경이 없어 DB integration과 실제 browser 영속성 검증을 코드로만 누적했다. 12단계의 목적은 새로운 제품 기능을 늘리는 것이 아니라, 누적된 기능이 실제 transaction·session·브라우저에서 함께 동작하는지 증명하고 1,000-node에서도 사용할 수 있는지 수치로 판정하는 것이다.

검증 자체가 schema reset과 대량 fixture 생성을 포함하므로 실행 편의보다 데이터 안전을 먼저 고정했다.

```text
mindmap_acceptance
├─ production E2E
├─ 100/1,000-node fixture
└─ backend/browser benchmark

mindmap_test
└─ integration 실행마다 public schema reset
```

두 DB는 이름, URL 분리, 명시적 확인값을 모두 만족해야 한다. harness가 준비됐다는 사실과 실제 인수가 통과했다는 사실도 구분해, Remote DB가 없는 현재 상태는 완료로 표시하지 않았다.

## 2. 변경 요약

### Acceptance DB 안전장치

- `mindmap_acceptance`, `mindmap_test` 외 이름과 `postgres/template` system DB를 거부한다.
- remote reset은 DB 이름과 같은 확인 환경변수가 있어야 한다.
- host·port·DB 이름이 같은 두 URL을 user/password/query가 달라도 동일 DB로 판정해 중단한다.
- 기존 localhost `mindmap_test` 자동 생성 흐름은 유지하지만 production/development DB reset은 허용하지 않는다.
- acceptance bootstrap은 reset, migration deploy/status, seed 2회를 순서대로 실행한다.

### 결정적 성능 fixture

- 성능 전용 사용자와 100-node, expanded 1,000-node, collapsed 1,000-node Mindmap을 매번 같은 구조로 만든다.
- parent index `floor((index - 1) / 4)`의 4진 balanced tree와 결정적 UUID를 사용한다.
- 각 Node는 최대 1,024-byte Markdown과 고정 제목·좌표를 가진다.
- collapsed fixture는 depth 2의 16개 branch를 접어 DB에는 1,000개가 있으면서 초기 visible tree는 작게 유지된다.
- seed는 성능 전용 사용자만 cascade 재생성해 다른 acceptance 사용자 데이터를 삭제하지 않는다.

### Backend benchmark

- detail 100/1,000, ALL export 100/1,000, autosave 1,000을 warm-up 후 각 10회 측정한다.
- 1,000-node subtree 삭제는 container root 아래 정확히 1,000개 subtree를 만들고 fixture 준비 시간을 제외해 3회 측정한다.
- Prisma query event로 query 수를 세고 duration, response bytes, heap delta를 함께 기록한다.
- 100에서 1,000으로 증가할 때 detail/export query 수가 2개보다 더 늘면 N+1 실패로 exit code를 1로 만든다.
- 결과는 `artifacts/performance/backend.json`에 기록한다.

### Production browser acceptance

- 별도 Playwright config는 `next start`, 1 worker, production build, 전용 DB global setup을 사용한다.
- expanded/collapsed 각각 warm-up 1회 후 5회 직접 navigation을 측정한다.
- first-visible은 첫 React Flow Node가 실제 DOM에 보이는 시점, usable은 Zoom과 Node 선택이 성공한 시점으로 정의했다.
- 5개 sample 중 하나라도 2,000ms/5,000ms를 넘으면 test가 실패한다.
- 1,000-node 상세 autosave와 ALL export 파일 내용도 같은 시나리오에서 확인한다.
- 결과는 `artifacts/performance/browser.json`에 기록한다.

### 보안과 실패 복구

- 사용자 B의 session으로 사용자 A의 Mindmap/Node 전체 endpoint를 직접 호출해 모두 404인지 검사한다.
- invalid UUID 400, evil Origin 403, logout 후 401과 error envelope를 검증한다.
- content PATCH network failure를 강제로 만들고 failed → 수동 retry → saved를 확인한다.
- 두 번째 실패 후 reload하여 local journal recovery prompt, 초안 적용, 자동저장과 재접속 영속성을 검증한다.

### 렌더 최적화

- production React Flow에 `onlyRenderVisibleElements`를 적용해 viewport 밖 Node/Edge DOM 생성을 줄였다.
- 전체 tree DTO와 React Flow 내부 model은 유지하므로 선택, Fit View, Pan/Zoom, collapse와 서버 계약은 바뀌지 않는다.
- JSDOM은 실제 layout geometry가 없어 가시 판정이 왜곡되므로 test 환경에서만 옵션을 끈다. production 성능 assertion은 실제 Chromium에서 검증한다.

## 3. 구조 분석

```text
scripts/
├─ acceptance/
│  ├─ database-safety.ts       # DB 이름·분리·confirmation·schema reset
│  └─ setup-database.ts        # migration/status/seed 2회
└─ performance/
   ├─ fixture.ts               # 결정적 4진 fixture
   ├─ seed.ts
   └─ benchmark-backend.ts     # query/time/payload/heap 측정

tests/e2e/
├─ global-setup.ts             # acceptance DB와 fixture 사전 검증
├─ performance.spec.ts
├─ security.spec.ts
└─ recovery.spec.ts

playwright.production.config.ts # next start + serial acceptance
```

`npm run test:acceptance`는 다음 순서를 고정한다.

```text
acceptance DB reset/migrate/status/seed×2
→ integration DB reset/migrate/full suite
→ performance seed
→ backend benchmark
→ production build
→ production Playwright 9 scenarios
```

## 4. 핵심 코드와 설계 의도

### 파괴적 작업 이전의 exact-name guard

```ts
if (databaseName !== expectedDatabase) {
  throw new Error(
    `Expected dedicated database '${expectedDatabase}', received '${databaseName}'.`,
  );
}
if (confirmation !== expectedDatabase) {
  throw new Error(`Set the reset confirmation to '${expectedDatabase}'.`);
}
```

URL이 PostgreSQL이라는 사실만으로 reset을 허용하지 않는다. 실수로 production URL을 복사하더라도 이름이 다르면 연결·DROP 전에 중단된다. localhost integration만 기존 개발 편의를 위해 confirmation 생략을 유지한다.

### DB URL 분리 비교

```ts
const target = `${protocol}//${host}:${port || "5432"}${pathname}`;
if (acceptanceTarget === integrationTarget) {
  throw new Error("Acceptance and integration databases must be different databases.");
}
```

credential과 `schema`, SSL query가 다르더라도 실제 host/database가 같으면 같은 DB다. query string을 비교에서 제외해 우회되는 안전 검사를 막았다.

### 4진 tree

```ts
const parentIndex = index === 0 ? null : Math.floor((index - 1) / 4);
const parentNodeId = parentIndex === null
  ? rootParentNodeId
  : uuidFor(group, parentIndex);
```

chain 1,000개는 극단적인 recursive depth만 측정하고, flat 999 siblings는 실사용 tree와 다르다. depth와 breadth가 함께 있는 4진 tree를 사용해 tree 검증, edge 생성, export path와 React Flow를 동시에 부하한다.

### N+1 판정

```ts
nPlusOne: {
  detail: maxQueries(detail1000) <= maxQueries(detail100) + 2,
  export: maxQueries(export1000) <= maxQueries(export100) + 2,
}
```

절대 query 수는 transaction BEGIN/COMMIT과 Prisma 구현에 따라 달라질 수 있다. 작은 fixture와 큰 fixture의 증가량을 비교해 node 수에 비례하는 query만 실패시키도록 했다.

### 성능 hard assertion

```ts
for (const sample of samples) {
  expect(sample.firstVisibleMs).toBeLessThanOrEqual(2_000);
  expect(sample.usableMs).toBeLessThanOrEqual(5_000);
}
```

평균이나 median만 합격 기준으로 사용하면 느린 sample을 숨길 수 있다. 선택한 정책대로 expanded와 collapsed의 측정 5회를 모두 통과해야 한다. median과 max는 분석용 report에 별도로 남긴다.

## 5. 구현 중 문제 해결

### React Flow 가시 렌더와 JSDOM

`onlyRenderVisibleElements`를 바로 켜자 component test에서 실제 화면에 있어야 할 child가 사라졌다. JSDOM은 Node 크기와 viewport intersection을 실제 browser처럼 계산하지 못해 모든 child를 화면 밖으로 판단했다.

옵션을 제거하지 않고 `NODE_ENV !== "test"`에서 활성화했다. component test는 전체 DOM으로 기존 상호작용을 검증하고 production Playwright가 실제 가시 렌더를 검증하는 역할 분리를 택했다.

### 직접 실행 script의 `.env` 로딩

Prisma CLI는 `.env`를 불러오지만 `tsx scripts/performance/seed.ts`는 자동으로 읽지 않는다. 최초 실행에서 `DATABASE_URL` validation이 import 시점에 실패했다. performance entrypoint와 production Playwright config에 `dotenv/config`를 가장 먼저 로드해 CLI별 환경 차이를 제거했다.

### 현재 DB를 acceptance로 오인할 위험

현재 `.env`의 DB 이름은 `mindmap`이다. `db:acceptance:setup`을 실행했을 때 연결을 시도하기 전에 다음 오류로 안전하게 중단됐다.

```text
Expected dedicated database 'mindmap_acceptance', received 'mindmap'.
```

이는 인프라 부재이면서 동시에 reset guard가 실제로 작동했다는 검증이다. URL을 자동으로 바꾸거나 현재 DB를 재사용하지 않았다.

## 6. 검증 결과

### PASS

| 검증 | 결과 |
|---|---|
| `npm run lint` | 오류·경고 없이 성공 |
| `npm run typecheck` | 성공 |
| `npm run test -- --run` | 35 files, 131 tests 성공 |
| DB safety unit test | remote confirmation, system/unexpected DB 거부, URL 분리 성공 |
| fixture unit test | 결정성, 1,000 count, 4진 parent, 1KiB 상한, depth-2 collapse 16개 성공 |
| 기존 Editor 회귀 | 가시 렌더 production 분기 후 component/drag test 성공 |
| `npm run build` | Next.js 16.3.1 production build 성공 |
| production Playwright 수집 | 7 files, 9 tests 성공 |
| acceptance DB guard | `mindmap`을 `mindmap_acceptance`로 초기화하지 않고 연결 전에 거부 |

### NOT VERIFIED

| 검증 | 결과/사유 |
|---|---|
| `npm run test:integration` | localhost IPv4/IPv6 5432 `ECONNREFUSED` |
| `npm run perf:seed` | localhost PostgreSQL `ECONNREFUSED` |
| migration/status와 seed 2회 | Remote `mindmap_acceptance` URL 미주입 |
| backend 100/1,000 실측 | fixture를 저장할 Remote DB 미주입 |
| production Playwright 9개 실행 | global setup이 현재 DB 이름 `mindmap`을 안전하게 거부 |
| expanded/collapsed 2초/5초 | browser fixture 미생성으로 측정값 없음 |
| 01~11 Infrastructure Backlog | 실제 PostgreSQL·browser 실행 전이므로 그대로 NOT VERIFIED |

현재 시점에는 baseline/final 성능 수치를 만들 수 없다. 숫자를 추정하거나 test 수집 결과를 성능 통과로 대체하지 않았다.

## 7. Trade-off

### Remote DB 이름 고정

managed PostgreSQL에서 원하는 DB 이름을 만들 수 없는 경우 유연성이 낮다. 그러나 schema drop을 포함하는 명령이므로 임의 이름 allowlist보다 정확한 `mindmap_acceptance`/`mindmap_test` 계약을 우선했다.

### Acceptance E2E를 1 worker로 실행

전체 실행 시간이 늘지만 Mindmap sequence, deletion, performance fixture와 console 결과가 병렬 test의 DB 경쟁에 영향을 받지 않는다. 기능 병렬성보다 재현 가능한 최종 인수 결과를 우선했다.

### 성능 artifact를 Git에 포함하지 않음

host, Node version, DB latency에 따라 달라지는 JSON을 기준값처럼 커밋하지 않는다. 실행 artifact는 무시하고 최종 개발 로그에 환경과 판정 수치를 옮긴다.

### Lazy loading을 선제 구현하지 않음

현재는 전체 content를 초기 detail에 포함하지 않고 lightweight Node metadata만 조회한다. 실제 DB/browser 병목 증거 없이 query/API/cache 계약을 크게 바꾸지 않았다. Remote 실측에서 payload/query가 2초/5초 실패 원인일 때만 MASTER_PLAN의 visible/subtree loading 조건을 적용한다.

## 8. 개선 및 다음 실행

Remote PostgreSQL 전용 DB가 준비되면 비밀값을 커밋하지 않고 다음 환경을 주입한다.

```powershell
Copy-Item .env.acceptance.example .env.acceptance.local
# 비공개 .env.acceptance.local에 아래 값을 설정
$env:DATABASE_URL = ".../mindmap_acceptance"
$env:TEST_DATABASE_URL = ".../mindmap_test"
$env:ACCEPTANCE_DATABASE_RESET_CONFIRM = "mindmap_acceptance"
$env:TEST_DATABASE_RESET_CONFIRM = "mindmap_test"
$env:SESSION_SECRET = "<32자 이상>"
npm run test:acceptance
```

실행 후 해야 할 일은 다음과 같다.

1. `artifacts/performance/backend.json`, `browser.json`의 실제 수치를 이 로그에 반영한다.
2. 병목이 있으면 EXPLAIN/React 측정 근거로 최소 최적화를 적용하고 같은 5회 조건으로 재측정한다.
3. integration·E2E·성능이 모두 통과한 backlog 행만 VERIFIED로 변경한다.
4. Final Acceptance Criteria 20개가 모두 통과할 때만 12단계와 전체 MVP를 `✅ DONE`으로 변경한다.

## 9. 결론

12단계의 안전한 Remote DB bootstrap, 결정적 1,000-node fixture, backend/browser 계측, production E2E, 소유권 보안과 journal 실패 복구 코드는 구현됐다. 정적 검사, 131개 unit/component test, production build와 9개 Playwright 수집도 성공했다.

다만 선택한 Remote PostgreSQL URL이 아직 실행 환경에 없으므로 실제 transaction, 영속성, 2초/5초 성능은 검증되지 않았다. 따라서 상태는 `🟡 IN_PROGRESS`이며, Remote DB 인수 결과 없이 완료로 올리지 않는다.
