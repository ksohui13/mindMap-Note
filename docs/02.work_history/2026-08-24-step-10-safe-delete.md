# 10단계 Mindmap·Node 안전 삭제

> 작업일: 2026-08-24
> 대상 단계: `docs/MASTER_PLAN.md` 10
> 최종 상태: `✅ DONE`
> 미검증 항목: PostgreSQL integration 및 DB 기반 Playwright E2E는 12단계 Infrastructure Validation Backlog로 이관

## 1. 변경 이유

삭제는 일반 수정과 달리 성공 후 복구할 수 없는 영구 변경이다. 특히 Node 삭제는 선택한 한 개뿐 아니라 모든 descendant를 FK cascade로 제거하므로, modal을 연 시점과 DELETE transaction 시점 사이에 subtree가 달라지면 사용자가 확인하지 않은 데이터까지 삭제할 수 있다.

09단계 이후에는 삭제 대상에 다음 client 상태도 연결돼 있다.

```text
Node subtree
├── React Flow node/edge와 선택 상태
├── 상세 panel/fullscreen
├── title/position/collapse local override
├── node별 mutation coordinator와 autosave timer
├── in-memory Markdown draft/recovery
├── content/deletion-impact Query cache
└── localStorage draft journal
```

따라서 10단계는 DELETE API만 추가하는 작업이 아니라, 확인한 범위를 transaction에서 다시 고정하고 성공 여부에 따라 저장·복구 상태를 보존하거나 완전히 폐기하는 작업으로 설계했다.

## 2. 변경 요약

### Backend/API

- `GET /api/nodes/:nodeId/deletion-impact`를 추가해 node 제목, descendant 수, 전체 삭제 수를 반환한다.
- `DELETE /api/nodes/:nodeId`는 `expectedDeleteCount`와 transaction 안의 최신 recursive count가 같을 때만 subtree를 삭제한다.
- `DELETE /api/mindmaps/:mindmapId`는 `expectedNodeCount`와 최신 Node 수가 같을 때만 Mindmap을 cascade 삭제한다.
- 비소유·미존재 리소스는 404, root Node는 409, stale 범위는 409로 처리한다.
- UUID, JSON body, same-origin, DB session 검증을 기존 Route Handler 규칙으로 적용했다.
- Node 생성과 삭제가 같은 Mindmap 행의 `FOR UPDATE` 잠금을 공유하고 삭제 transaction은 serializable로 실행한다.

### 공통 확인 UI

- `@radix-ui/react-alert-dialog` 기반 `DeleteConfirmModal`을 추가했다.
- 취소 버튼 초기 focus, focus trap, Escape, 진입점 focus 복원을 제공한다.
- 삭제 중에는 취소·확인·Escape·외부 닫기를 막고 한 요청만 전송한다.
- 영향 조회 loading/error/retry와 DELETE 오류를 modal 안에서 표시한다.

### Dashboard와 Editor

- Dashboard 카드 메뉴에 Mindmap 삭제를 추가하고 실제 `nodeCount`를 확인 문구와 DELETE body에 사용한다.
- 일반 Node에만 `⋯ → 삭제`를 제공하며 root에는 메뉴 자체가 없다.
- Node modal은 서버 impact를 새로 조회해 leaf와 subtree 문구를 구분한다.
- 성공 전에는 목록이나 canvas를 낙관적으로 제거하지 않는다.
- 409에서는 modal을 유지한 채 목록 또는 영향 query를 갱신한다.

### 저장·cache 정리

- DELETE 요청 중 target subtree autosave timer를 일시 중지한다.
- 실패하면 draft/journal을 그대로 둔 채 autosave를 다시 예약한다.
- 성공하면 subtree의 draft, recovery, timer, retry/save state, journal과 content cache를 폐기한다.
- 선택 Node가 subtree에 포함될 때만 panel/fullscreen과 선택을 닫고, sibling과 React Flow viewport는 유지한다.
- coordinator tombstone과 Query tombstone을 함께 사용해 늦은 저장 응답을 무시한다.
- Mindmap 삭제 시 해당 ID prefix의 모든 draft journal과 알려진 detail/content cache를 정리한다.

## 3. 구조 분석

```text
src/app/api/
├── mindmaps/[mindmapId]/route.ts          # PATCH + DELETE
└── nodes/[nodeId]/
    ├── route.ts                           # PATCH + DELETE
    └── deletion-impact/route.ts           # GET

src/server/domain/
├── mindmap.repository.ts                  # Mindmap row lock
├── mindmap.service.ts                     # count 검증 + cascade delete
└── node.service.ts                        # impact + subtree delete

src/features/
├── dashboard/
│   ├── components/dashboard-screen.tsx    # 카드 삭제 진입점/modal
│   └── hooks/use-mindmaps.ts              # 삭제 mutation/cache/journal
└── mindmap/
    ├── hooks/use-node-deletion.ts          # impact query + DELETE mutation
    ├── hooks/use-markdown-autosave.ts      # pause/resume/discard subtree
    ├── hooks/use-node-mutation-coordinator.ts # forget/tombstone
    ├── hooks/use-node-content.ts           # late response tombstone
    ├── lib/draft-journal.ts                # Mindmap prefix 정리
    └── components/mindmap-editor.tsx       # subtree UI 상태 정리

src/shared/ui/delete-confirm-modal.tsx      # 접근성 공통 확인 modal
```

서버는 “삭제 가능한가”와 “현재 범위가 확인 값과 같은가”를 책임진다. client는 성공 전까지 상태를 보존하고, 성공 envelope를 받은 뒤 관련 상태만 제거한다. 이 경계를 지켜 UI 오류나 network 실패가 사용자 draft 손실로 이어지지 않게 했다.

## 4. 핵심 코드와 설계 의도

### 표시 범위를 transaction에서 재검증

```ts
const deletedCount = (await countDescendants(node.id, transaction)) + 1;
if (deletedCount !== expectedDeleteCount) {
  throw new DomainError(
    "CONFLICT",
    "Node subtree changed. Review the deletion impact and try again.",
  );
}

await transaction.node.delete({ where: { id: node.id } });
```

impact API의 숫자를 신뢰해 바로 삭제하지 않는다. DELETE가 시작된 transaction에서 다시 계산하고 다르면 어떤 row도 삭제하지 않는다. Mindmap 삭제도 같은 방식으로 `_count.nodes`를 비교한다.

### 생성과 삭제가 공유하는 Mindmap 잠금

```ts
SELECT "id"
FROM "Mindmap"
WHERE "id" = ${id}::uuid AND "userId" = ${userId}::uuid
FOR UPDATE
```

serializable 삭제만으로 생성 transaction의 격리 수준까지 통제한다고 가정하지 않았다. production child 생성과 Node/Mindmap 삭제가 같은 Mindmap row lock을 먼저 획득하게 해 범위 계산과 신규 child 생성을 직렬화했다. 잠금 query 자체에 user ID를 포함해 소유권이 없는 Mindmap 존재 여부를 노출하지 않는다.

### 실패 시 보존, 성공 시 폐기

```ts
markdownAutosave.pauseNodes(deleteTargetIds);
try {
  await deleteNodeMutation.mutateAsync({
    nodeId,
    input: { expectedDeleteCount },
  });
  markdownAutosave.discardNodes(deleteTargetIds);
  removeSubtreeFromDetailCache(deleteTargetIds);
} catch (error) {
  markdownAutosave.resumeNodes(deleteTargetIds);
}
```

modal을 열거나 취소할 때는 저장 상태에 손대지 않는다. 실제 DELETE 요청이 시작될 때 timer만 멈추고, 서버 성공 후에만 draft와 journal을 폐기한다. 실패 시 기존 작성 내용은 그대로 남아 자동저장이 다시 진행된다.

### 늦은 저장 응답 차단

```ts
coordinator.forgetNodes(nodeIds);
queryClient.setQueryData(nodeDeletedQueryKey(nodeId), true);

if (queryClient.getQueryData(nodeDeletedQueryKey(response.node.id)) === true) {
  queryClient.removeQueries({ queryKey: nodeContentQueryKey(response.node.id), exact: true });
  return;
}
```

coordinator의 client sequence만 지우면 공통 content mutation hook의 `onSuccess`가 cache를 다시 만들 수 있다. coordinator tombstone은 저장 상태·revision callback을 막고 Query tombstone은 content cache 재생성을 막는다. UUID는 재사용하지 않으므로 삭제 tombstone을 해제할 필요가 없다.

### focus 복원

```ts
onOpenAutoFocus={(event) => {
  event.preventDefault();
  restoreFocusRef.current = document.activeElement as HTMLElement;
  cancelRef.current?.focus();
}}
onCloseAutoFocus={(event) => {
  event.preventDefault();
  restoreFocusRef.current?.focus();
}}
```

controlled AlertDialog에는 Radix Trigger가 없으므로 자동 focus 복원 대상이 없다. modal이 열리기 직전 active element를 `onOpenAutoFocus`에서 기억하고 닫힐 때 직접 복원했다. render 중 ref 접근을 사용하지 않아 React 19 lint 규칙도 만족한다.

## 5. 구현 중 문제 해결

### serializable만으로 동시 생성 범위를 고정하려던 문제

삭제 transaction은 serializable이지만 기존 child 생성 transaction은 기본 격리 수준이었다. DB가 serialization conflict를 만들 것이라고 암묵적으로 기대하면, count 이후 들어온 child가 cascade에 포함되는 경계를 코드에서 설명하기 어렵다.

공통 Mindmap row lock을 도입해 생성과 삭제가 동일한 직렬화 지점을 사용하도록 바꿨다. stale count는 409가 되고, 삭제가 먼저 잠금을 얻으면 삭제된 parent를 대상으로 한 후속 생성은 실패한다.

### coordinator 폐기 직후 기존 node 목록 effect가 tombstone을 해제한 문제

초기 구현은 `nodes` effect에서 모든 ID를 “활성”으로 다시 표시했다. 삭제 성공 처리 중 React state가 먼저 갱신되면 detail cache에서 subtree를 제거하기 전 한 번 rerender될 수 있어, 방금 설정한 tombstone이 지워지고 늦은 응답 callback이 실행될 가능성이 있었다.

Node UUID는 재사용하지 않는 불변식을 이용해 tombstone을 자동 해제하지 않도록 수정했다. 그 결과 삭제된 ID는 해당 QueryClient/editor 생명주기에서 영구 폐기된다.

### mutation hook이 content cache를 되살릴 수 있던 문제

coordinator가 늦은 응답의 `onSuccess`를 건너뛰어도 TanStack mutation hook 자체의 global `onSuccess`는 먼저 실행된다. content query tombstone 검사를 hook에 추가하고 삭제 시 진행 중 query도 cancel/remove해 두 계층을 모두 막았다.

### controlled modal의 focus 복원 문제

Radix AlertDialog를 controlled 상태로만 사용하면 원래 Trigger 정보가 없어 Escape 후 focus가 `body`로 이동했다. open autofocus event에서 실제 진입 element를 캡처하고 close autofocus에서 복원해 Dashboard와 Node 메뉴 진입점 모두 같은 동작을 갖게 했다.

## 6. 검증 결과

### PASS

| 검증 | 결과 |
|---|---|
| `npm run lint` | 오류·경고 없이 성공 |
| `npm run typecheck` | 성공 |
| `npm run test -- --run` | 28 files, 114 tests 성공 |
| API route test | impact, DELETE envelope, invalid body/ID, same-origin, auth, root 409, 비소유 404, stale 409 성공 |
| component test | Dashboard/Node 메뉴, root 메뉴 부재, 최신 영향, 이중 확인 1회, subtree/sibling/cache/journal 정리 성공 |
| autosave/coordinator test | pause/resume/discard, 늦은 응답 무시와 content cache 비복원 성공 |
| modal test | 취소 초기 focus, Escape, focus 복원, pending 중 action 차단 성공 |
| `npm run build` | Next.js 16.3.1 production build 성공 |
| `npx playwright test --list` | 4 files, 6 tests 수집 성공 |
| `npx playwright test --reporter=line` | foundation 1 passed, DB 의존 5 skipped |

### NOT VERIFIED

| 검증 | 사유 |
|---|---|
| `npm run test:integration` | PostgreSQL `localhost:5432` IPv4/IPv6 연결 거부 |
| 실제 recursive CTE/cascade/rollback/행 잠금 | migration된 PostgreSQL이 필요함 |
| 동시 child 생성과 stale 삭제 경쟁 | 실제 PostgreSQL 다중 transaction 실행 필요 |
| Node subtree 삭제 후 reload E2E | `E2E_DATABASE_READY=true` DB 환경 필요 |
| Mindmap 삭제와 최대 sequence 재사용 E2E | `E2E_DATABASE_READY=true` DB 환경 필요 |

통합 test에는 leaf·다단계 subtree, sibling 보존, root/소유권, stale count 무삭제, Mindmap cascade와 sequence 재사용을 작성했다. E2E에는 Node subtree 삭제→reload와 Mindmap 삭제→새 번호 재사용 시나리오를 추가했다.

## 7. Trade-off

### soft delete나 휴지통을 추가하지 않음

확정 범위대로 즉시 영구 삭제를 유지했다. 복구 기능이 없는 대신 modal의 최신 영향 수와 transaction expected count를 안전장치로 사용한다.

### Node impact를 별도 GET으로 유지

DELETE 전에 서버 round trip이 하나 늘지만, client tree가 오래됐을 수 있으므로 최신 descendant 수를 보여주는 정확성을 우선했다. Mindmap은 Dashboard의 실제 list count를 사용하고 DELETE에서 다시 검증한다.

### Mindmap 단위 행 잠금

같은 Mindmap 안의 child 생성과 삭제는 짧게 직렬화된다. 서로 다른 Mindmap은 영향을 받지 않으며, 영구 삭제 범위의 안정성을 위해 수용 가능한 비용이다. 1,000 node subtree count/delete lock 시간은 12단계에서 측정한다.

### client가 알고 있는 subtree만 즉시 정리

Editor detail에는 전체 tree가 있으므로 정상 흐름에서는 모든 subtree ID를 알고 있다. 다른 tab에서 막 추가된 node는 현재 tab의 local draft/cache가 없고 서버 expected count 재검증 대상이다. 다중 tab 실시간 동기화는 MVP 범위가 아니다.

## 8. 개선 방향

- 12단계 PostgreSQL에서 두 connection으로 child 생성과 subtree 삭제를 교차 실행해 lock/409를 검증한다.
- 깊은 1,000 node fixture에서 recursive count, cascade delete, transaction lock 시간을 측정한다.
- 실제 Chromium에서 modal focus trap, Escape, 외부 click, 삭제 중 navigation을 keyboard 중심으로 재검증한다.
- Query cache GC 이후 Dashboard에서 삭제하는 경우의 content cache 관찰성을 위해 향후 content query key에 Mindmap ID 포함을 검토한다.
- 휴지통 요구가 생기면 현재 영구 삭제 API를 그대로 확장하지 말고 deletedAt, 복원 정책, sequence 정책을 별도 설계한다.

## 9. 결론

10단계는 삭제 대상을 보여주는 UI와 실제 transaction 범위를 expected count로 연결해, 확인 이후 범위가 바뀐 영구 삭제를 409로 중단한다. 서버에서는 소유권·root·최신 count와 Mindmap 행 잠금을 검증하고, client에서는 성공 전 draft를 보존하며 성공 후 subtree 관련 상태를 일괄 폐기한다.

정적 검사, 114개 unit/component test, production build와 Playwright foundation 실행은 통과했다. 실제 PostgreSQL integration과 DB 기반 삭제 E2E는 연결 거부 사실을 숨기지 않고 12단계 backlog에 남겼다.
