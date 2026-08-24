# 09단계 통합 자동저장·저장 상태·실패 복구

> 작업일: 2026-08-24  
> 대상 단계: `docs/MASTER_PLAN.md` 09  
> 최종 상태: `✅ DONE`  
> 미검증 항목: PostgreSQL integration 및 DB 기반 Playwright E2E는 12단계 Infrastructure Validation Backlog로 이관

## 1. 변경 이유

08단계는 node별 Markdown 조회·편집 UI와 content mutation 기반을 만들었지만, 실제 저장 시점과 실패 복구는 의도적으로 남겨 두었다. 동시에 Node의 title, position, collapse, content가 하나의 `revision`을 공유하므로 각 mutation을 독립 실행하면 서로 다른 필드 변경도 409 충돌을 일으킬 수 있었다.

09단계는 다음 세 문제를 하나의 저장 흐름으로 해결한다.

```text
연속 Markdown 입력 ── 2초 debounce ─┐
제목·좌표·접기 즉시 저장 ───────────┼─ node별 coordinator ─ API revision
node 전환·화면 이동 즉시 flush ─────┘          │
                                                ├─ 실제 저장 상태
                                                └─ localStorage journal
```

- 같은 node의 요청 순서를 보장한다.
- 서버 응답이 확인된 경우에만 저장 완료를 표시한다.
- 네트워크 실패나 page 종료 후에도 로컬 초안을 복구한다.

## 2. 변경 요약

### Backend/API

- 모든 node mutation의 409 응답을 `{ error: { code, message, details: { currentRevision } } }`로 확장했다.
- revision 조건 update 실패 시 소유권을 다시 확인한 뒤 현재 revision을 조회한다.
- 비소유·삭제된 node는 현재 revision을 노출하지 않고 404로 처리한다.
- `DomainError`와 `ApiClientError`에 details 전달 경로를 추가했다.
- server/client 모두 음이 아닌 정수 `currentRevision`만 전달하도록 runtime 검증했다.
- TanStack mutation retry는 사용하지 않고 coordinator와 사용자 action만 재시도를 시작한다.

### 저장 coordinator

- node ID별 Promise tail을 사용해 같은 node의 title·position·collapse·content mutation을 직렬화했다.
- 서로 다른 node는 별도 tail을 사용해 병렬 처리한다.
- node와 mutation 종류별 client sequence로 오래된 응답이 최신 상태를 덮지 못하게 했다.
- 성공 응답의 revision과 409의 `currentRevision`을 coordinator가 관리한다.
- 저장 상태를 `idle | dirty | saving | saved | failed`로 명시하고 전체 상태 우선순위를 구현했다.

### Markdown 자동저장과 복구

- 마지막 입력 2초 후 최신 Markdown만 저장한다.
- 저장 중 추가 입력은 중간 본문을 보내지 않고 현재 요청 종료 후 최신 draft를 다시 예약한다.
- node 전환, panel 닫기, Dashboard 이동 시 dirty draft를 즉시 flush한다.
- `pagehide`와 hidden `visibilitychange`에서 `keepalive` 요청을 최선 시도한다.
- 입력 event에서 localStorage journal을 동기 기록한다.
- 서버본과 journal이 다르면 `[초안 적용]` 또는 `[서버본 사용]` 선택 전까지 편집을 잠시 멈춘다.
- storage 접근·quota 오류는 네트워크 autosave를 막지 않고 경고만 표시한다.

### UI와 테스트

- Editor Header에 전체 저장 상태와 재시도를 연결했다.
- Detail footer에 선택 node의 content 저장 상태, 오류, 재시도, local protection 경고를 표시한다.
- 단위/component/API/integration/E2E test를 추가·갱신했다.
- `docs/MASTER_PLAN.md`의 09 상태, 진행률, backlog와 Decision Log를 갱신했다.

## 3. 구조 분석

```text
src/features/mindmap/
├── hooks/
│   ├── use-node-mutation-coordinator.ts  # node별 요청 queue/revision/sequence
│   ├── use-markdown-autosave.ts          # debounce/flush/recovery/lifecycle
│   └── use-node-content.ts               # content query/mutation cache
├── lib/draft-journal.ts                  # localStorage record 계약
├── model/save-state.ts                   # 상태·집계·오류 분류
└── components/
    ├── mindmap-editor.tsx                # 기존 node mutation 통합
    └── node-detail.tsx                   # 상태·복구 선택 UI

src/shared/ui/save-status.tsx             # Header/Detail 공통 상태 표현
src/server/domain/
├── errors.ts                             # 안전한 details 운반
└── node.service.ts                       # 409 currentRevision 조회
src/server/http/api.ts                    # error envelope 제한
```

저장 책임은 세 층으로 분리했다.

1. coordinator는 node revision과 요청 순서만 책임진다.
2. Markdown autosave hook은 입력 시점, journal, content cache와 lifecycle flush를 책임진다.
3. Editor는 기존 interaction을 coordinator에 연결하고 화면 상태만 관리한다.

이 분리로 title/position/collapse는 Markdown debounce를 알 필요가 없고, Markdown hook은 React Flow local override 구현을 알 필요가 없다.

## 4. 핵심 코드와 설계 의도

### 같은 node만 직렬화

```ts
const previous = tails.current.get(nodeId) ?? Promise.resolve();
const task = previous.catch(() => undefined).then(execute);
const settledTask = task.then(() => undefined, () => undefined);
tails.current.set(nodeId, settledTask);
```

queue key를 mutation 종류가 아니라 `nodeId`로 잡았다. 네 mutation이 하나의 revision을 공유하기 때문이다. 실패한 Promise가 뒤의 저장까지 막지 않도록 tail은 settled Promise로 유지하고, 호출자에게는 원래 task를 반환해 오류 상태를 기록한다.

### client sequence와 server revision의 역할 분리

```ts
const sequence = supersede(nodeId, kind);
const response = await operation(currentRevision);
revisions.current.set(nodeId, response.node.revision);

if (sequences.current.get(key) === sequence) {
  setRecord(nodeId, kind, { phase: "saved" });
}
```

- server revision은 DB의 오래된 쓰기를 409로 거부한다.
- client sequence는 이미 시작된 요청의 늦은 성공·실패 표시가 새 입력의 `dirty` 상태를 덮지 못하게 한다.

둘 중 하나만으로는 충분하지 않다. revision만 있으면 UI의 최신 draft 상태가 오래된 응답에 의해 `saved`로 보일 수 있고, sequence만 있으면 서버에서 다른 필드의 경쟁 쓰기를 막을 수 없다.

### journal은 입력 시 동기 기록

```ts
writeDraftJournal(
  getBrowserStorage(),
  createDraftJournalEntry(
    mindmapId,
    nodeId,
    value,
    server.node.revision,
  ),
);
```

React state 반영이나 debounce timer보다 먼저 현재 입력을 localStorage에 쓴다. record key에 Mindmap ID와 node ID를 모두 포함해 다른 문서·node의 초안이 섞이지 않는다.

```json
{
  "version": 1,
  "mindmapId": "...",
  "nodeId": "...",
  "contentMd": "# draft",
  "baseRevision": 3,
  "updatedAt": "2026-08-24T...Z"
}
```

### 저장 성공 확인 후에만 정리

```ts
onSuccess: () => {
  if (draftsRef.current[nodeId] !== submitted) {
    coordinator.markDirty(nodeId, "content");
    return;
  }
  if (!options.keepalive) {
    removeDraftJournal(storage, mindmapId, nodeId);
  }
  removeInMemoryDraft(nodeId);
}
```

요청 중 새 입력이 있으면 제출한 이전 내용이 성공해도 journal을 지우지 않는다. lifecycle keepalive는 응답을 받더라도 page 종료 경계의 최종 성공을 가정하지 않고 journal을 남긴다. 다음 접속에서 서버 내용과 같으면 조용히 제거된다.

### 409를 자동 덮어쓰지 않음

409가 오면 client는 최신 content/detail을 다시 조회하지만 로컬 draft는 유지한다. `currentRevision`은 coordinator에 반영하되 재저장은 사용자가 `[다시 시도]`를 눌렀을 때만 시작한다. 서버 최신 변경을 자동으로 덮지 않으면서 작성 내용도 잃지 않는 절충이다.

## 5. 구현 중 문제 해결

### 실패 queue에서 unhandled rejection이 발생한 문제

초기 coordinator는 호출자에게 반환하는 rejecting task와 동일한 Promise를 queue tail로 저장했다. 화면 호출부가 오류를 처리해도 별도 `finally()` tail이 다시 reject해 Vitest가 unhandled rejection을 탐지했다.

queue용 Promise를 성공·실패 모두 resolve되는 `settledTask`로 분리했다. 공개 task는 기존처럼 reject하므로 UI 오류 처리는 유지되고 내부 queue만 안전하게 다음 작업으로 진행한다.

### React 19 lint의 render 중 ref 접근 금지

최신 React lint는 render 본문에서 `ref.current = value`를 갱신하는 패턴을 오류로 판정했다. 이벤트 handler에서 state와 ref를 함께 갱신하고, callback ref 교체는 effect에서 수행하도록 바꿨다. recovery 탐색의 state 반영도 microtask로 분리해 effect의 동기 cascading render를 피했다.

### localStorage 자체 접근이 throw할 수 있는 문제

quota 초과뿐 아니라 보안 설정에 따라 `window.localStorage` getter나 `getItem`도 예외를 낼 수 있다. storage 획득, read, write, remove를 각각 방어하고 실패 시 네트워크 저장 흐름은 계속 진행하도록 했다.

### 기존 Step08 component mock과 자동 flush의 충돌

Step08 test의 content mock은 GET 응답만 가정했다. node 전환 시 즉시 PATCH가 추가되면서 서버 응답이 제출 draft를 반영하지 않아 test cache가 잘못 갱신됐다. mock을 method/body 기준으로 분리하고 node 전환 시 PATCH가 실제 발생하는지 검증하도록 바꿨다.

## 6. 오류 계약

| 분류 | 예 | 자동 재시도 | draft/journal | UI |
|---|---|---:|---|---|
| 일시적 | network, 408, 429, 5xx | 없음 | 유지 | 실패 + 다시 시도 |
| 충돌 | 409 | 없음 | 유지 | 최신 서버 조회 + 다시 시도 |
| 입력/권한 | 400, 401/403, 404 | 없음 | 유지 | 원인 표시, retry 숨김 |
| storage | quota/security | network 저장 지속 | 기록 실패 가능 | 로컬 보호 실패 경고 |

TanStack Query의 mutation retry는 명시적으로 사용하지 않는다. 재시도 횟수와 요청 순서를 coordinator와 사용자 action 한 곳에서만 관리하기 위해서다.

## 7. 검증 결과

### PASS

| 검증 | 결과 |
|---|---|
| `npm run lint` | 오류·경고 없이 성공 |
| `npm run typecheck` | 성공 |
| `npm run test` | 27 files, 97 tests 성공 |
| coordinator test | 같은 node 직렬화, 다른 node 병렬, 오래된 응답 무시, 409 revision retry 성공 |
| autosave test | 2초 debounce/reset, journal 성공 삭제, recovery 적용/폐기, pagehide keepalive 성공 |
| journal test | 읽기·쓰기·격리·손상 record·quota/storage 오류 성공 |
| API route/client test | title/position/collapse/content 409 currentRevision, 잘못된 details 제거 성공 |
| `npm run build` | Next.js 16.3.1 production build 성공 |
| `npx playwright test --list` | 4 files, 6 tests 수집 성공 |
| `git diff --check` | whitespace 오류 없음 |

### NOT VERIFIED

| 검증 | 사유 |
|---|---|
| `npm run test:integration` | PostgreSQL `localhost:5432` IPv4/IPv6 연결 거부 |
| 실제 DB 공유 revision·409·updatedAt | PostgreSQL 미실행 |
| 실제 Playwright autosave/reload 시나리오 | migration된 PostgreSQL test DB가 필요함 |
| 실제 page 종료·긴 keepalive body | 실행 가능한 DB/browser 환경 미준비 |

Playwright 시나리오는 Markdown 저장 완료를 기다린 뒤 reload하여 본문을 다시 확인하도록 갱신했다. 실행 책임은 12단계 backlog에 유지한다.

## 8. Trade-off

### node별 queue의 메모리 비용

활성 mutation이 있는 node만 Map entry를 갖고 완료 후 제거한다. 전역 queue보다 구조는 조금 복잡하지만 서로 다른 node 저장을 불필요하게 막지 않는다.

### journal TTL을 두지 않음

오래된 record가 남을 수 있지만 미저장 입력을 시간만으로 삭제하지 않는 정책을 우선했다. 성공 저장, 서버 동일 확인, 사용자 폐기만 삭제 조건으로 사용한다.

### lifecycle keepalive의 한계

브라우저별 전송 크기와 종료 timing 때문에 성공을 보장할 수 없다. 특히 긴 Markdown은 keepalive 제한을 넘을 수 있다. 별도 동기 API나 성공 추정치를 만들지 않고 journal 복구를 최종 안전망으로 선택했다.

### conflict 자동 merge를 하지 않음

Markdown 자동 merge는 내용 의미를 훼손할 수 있고 다른 필드도 같은 revision을 쓴다. 이번 단계는 서버 최신 revision을 반영하고 로컬 draft를 유지한 뒤 명시적 재시도만 제공한다. 다중 사용자 실시간 협업은 MVP 범위가 아니다.

## 9. 개선 방향

- 12단계 실제 PostgreSQL에서 delayed concurrent mutation과 currentRevision을 검증한다.
- 실제 Chromium에서 강제 reload/pagehide와 journal 복구를 확인한다.
- 256KiB 근처 본문의 keepalive 실패와 일반 autosave 성공을 구분해 관찰한다.
- 1,000 node fixture에서 coordinator 상태 변경이 전체 React Flow rerender를 유발하는지 profiler로 측정한다.
- 향후 협업 요구가 생기면 overwrite 재시도 대신 diff/merge UI 또는 field별 revision 도입을 검토한다.

## 10. 결론

09단계는 네 종류의 node 변경을 하나의 revision 흐름으로 통합하고, Markdown의 2초 자동저장과 실패 복구를 완성했다. 서버 revision은 오래된 쓰기를 막고 client sequence는 오래된 응답의 UI 덮어쓰기를 막는다. localStorage journal은 네트워크와 browser lifecycle이 보장하지 못하는 마지막 데이터 보호 계층이다.

정적 검사, 97개 unit/component test, production build와 Playwright 수집은 성공했다. 실제 PostgreSQL integration과 DB 기반 browser E2E는 연결 불가 사실을 숨기지 않고 12단계 backlog에 남겼다.
