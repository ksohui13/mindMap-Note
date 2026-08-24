# 11단계 범위별 Markdown 내보내기

> 작업일: 2026-08-24  
> 대상 단계: `docs/MASTER_PLAN.md` 11  
> 최종 상태: `✅ DONE`  
> 미검증 항목: PostgreSQL integration 및 DB 기반 Playwright E2E는 12단계 Infrastructure Validation Backlog로 이관

## 1. 변경 이유

마인드맵 내보내기는 화면에 보이는 문자열을 단순히 파일로 바꾸는 기능이 아니다. 자동저장 중인 Markdown, 접힌 subtree, 오래된 Query cache, 복구 대기 journal이 동시에 존재할 수 있기 때문에 client 상태를 그대로 직렬화하면 누락되거나 서로 다른 revision의 내용이 한 문서에 섞일 수 있다.

11단계는 다음 두 경계를 명확히 했다.

```text
Editor 저장 경계
dirty draft → debounce 취소 → 즉시 저장 → node mutation queue 완료
             └─ 실패/recovery 존재 시 export 중단

Server 문서 경계
repeatable-read transaction
├─ owned Mindmap
├─ 전체 경량 tree metadata
└─ 선택 범위 content
    → 안정 preorder Markdown → raw UTF-8 response
```

내보낸 파일은 client draft를 직접 합치지 않고 서버 저장 snapshot만 사용한다. 따라서 최신 입력은 먼저 저장되어야 하며, 사용자가 아직 적용하거나 폐기하지 않은 복구 초안은 자동으로 무시하지 않는다.

## 2. 변경 요약

### Backend/API

- `POST /api/mindmaps/:mindmapId/export`를 추가했다.
- `ALL`, `NODE`, `SUBTREE`와 `MARKDOWN`만 허용하는 strict discriminated union으로 추가 필드와 잘못된 node 조합을 400 처리한다.
- 기존 mutation API와 같은 UUID, JSON, same-origin, DB session 검증을 적용했다.
- 비소유 Mindmap, 존재하지 않는 Node, 다른 Mindmap 소속 Node는 모두 404로 숨긴다.
- repeatable-read transaction에서 tree metadata를 먼저 읽고 선택 범위의 content만 조회한다.
- sibling은 `createdAt`, `id` 순으로 고정하고 root부터 안정적인 preorder를 생성한다.
- raw UTF-8 Markdown과 `Content-Disposition`, `Cache-Control: no-store`, `nosniff` 헤더를 반환한다.

### Markdown 문서

- Mindmap 제목, 범위, 기준 Node, 중첩 개념 트리, 번호가 있는 상세와 전체 root 경로를 포함한다.
- 제목·tree·경로 문자열만 Markdown 문법에 맞게 escape한다.
- `contentMd`는 HTML 실행이나 재포맷 없이 원문을 삽입한다.
- 빈 content Node도 상세 절과 `_(상세 Markdown 없음)_` 표시를 남긴다.
- UTF-8 BOM 없이 LF와 마지막 newline을 사용한다.
- 파일명은 `{Mindmap 제목}-{all|node|subtree}.md`이며 제어문자, Windows 금지문자, 예약어, 빈 값과 길이를 방어한다.

### Modal과 진입점

- `@radix-ui/react-dialog` 기반 `ExportModal`을 추가했다.
- 취소 버튼 초기 focus, focus trap, Escape, 진입점 focus 복원을 제공한다.
- 준비·파일 생성 중에는 중복 POST와 modal 종료를 막고 오류를 같은 modal에서 재시도할 수 있다.
- Dashboard 카드 메뉴는 `ALL`만, Editor 상단은 `ALL` 기본과 선택 Node 범위, Node 메뉴는 `SUBTREE` 기본으로 연다.
- root Node에도 export 메뉴를 제공하지만 삭제 메뉴는 계속 노출하지 않는다.
- Blob URL과 임시 anchor로 다운로드를 시작하고 event loop 이후 object URL을 해제한다.

### 저장과 recovery 연동

- node mutation coordinator에 현재 record 조회와 대상 queue 대기 기능을 추가했다.
- Editor export 준비 시 대상 범위의 autosave timer를 취소하고 dirty Markdown을 즉시 flush한다.
- title/content 저장 실패, 409, 남은 draft 또는 recovery가 있으면 파일 생성 요청을 보내지 않는다.
- localStorage의 Mindmap prefix journal을 열거해 서버 content와 비교한다.
- 같은 내용은 조용히 제거하고 다른 내용은 Node 제목과 개수를 안내하며 export를 차단한다.
- Dashboard `ALL`도 같은 journal 검사를 거치므로 Editor를 열지 않은 상태에서 미해결 초안을 누락시키지 않는다.

## 3. 구조 분석

```text
src/app/api/mindmaps/[mindmapId]/export/route.ts
  └─ HTTP validation/security + raw Markdown response

src/server/domain/
├─ mindmap-export.service.ts  # repeatable-read, scope, path, preorder
└─ mindmap-export.ts          # Markdown renderer, filename/header

src/features/mindmap/
├─ components/export-modal.tsx
├─ lib/export-download.ts     # Blob URL download/revoke
├─ lib/export-preflight.ts    # journal/server 비교
├─ lib/draft-journal.ts       # Mindmap journal 열거
├─ hooks/use-markdown-autosave.ts
├─ hooks/use-node-mutation-coordinator.ts
├─ components/mindmap-editor.tsx
└─ components/mindmap-node.tsx

src/features/dashboard/components/dashboard-screen.tsx
  └─ ALL 진입점 + Mindmap 전체 journal 검사
```

서버 renderer는 React나 HTTP에 의존하지 않는 순수 함수다. service가 소유권과 snapshot, tree 범위와 path를 만들고 route는 transport header만 책임진다. client도 `prepare → download` 경계를 modal에 주입해 Dashboard와 Editor가 각자 필요한 선행 검증을 수행하면서 다운로드 구현은 공유한다.

## 4. 핵심 코드와 설계 의도

### repeatable-read snapshot

```ts
return client.$transaction(async (transaction) => {
  const mindmap = await transaction.mindmap.findFirst({
    where: { id: mindmapId, userId },
  });
  const metadata = await transaction.node.findMany({
    where: { mindmapId },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
  });
  const contents = await transaction.node.findMany({
    where: { id: { in: includedNodeIds }, mindmapId },
  });
  return renderMindmapMarkdown(...);
}, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
```

tree와 content를 별도 query로 읽더라도 transaction 시작 이후의 동일 snapshot을 사용한다. `ALL`에서 1,000개 본문을 N+1로 읽지 않고 대상 content를 한 번에 조회하며, `NODE`와 `SUBTREE`는 선택 밖 content를 읽지 않는다.

### scope별 stable preorder

```ts
if (input.scope === "ALL") return fullOrder;
if (input.scope === "NODE") return [target];

const included = new Set([target.id]);
for (const node of fullOrder) {
  if (node.parentNodeId && included.has(node.parentNodeId)) included.add(node.id);
}
return fullOrder.filter((node) => included.has(node.id));
```

subtree를 별도 recursive query로 다시 정렬하지 않고 검증된 전체 preorder에서 descendant만 선택한다. sibling이 섞이지 않으며 같은 snapshot과 같은 tree에서는 언제나 같은 순서가 된다. `NODE` 문서도 표시 tree는 선택 Node 하나뿐이지만 상세 경로는 root부터 유지한다.

### export 전 저장 barrier

```ts
await Promise.all(targets.map((nodeId) => flushRef.current(nodeId)));
await coordinator.waitForNodes(targets);

if (hasFailedSave || draftsRef.current[nodeId] !== undefined) {
  return { ok: false, message: "대상 노드의 최신 내용을 저장하지 못했습니다." };
}
```

단순히 2초를 기다리는 대신 debounce를 취소하고 즉시 저장한다. coordinator의 node별 queue까지 비워야 title/position/collapse가 공유 revision을 먼저 소비하는 경우에도 content가 최신 revision으로 이어서 저장된다. 실패를 서버본 export로 우회하지 않아 다운로드 성공 표시와 실제 사용자 입력이 어긋나지 않는다.

### recovery journal 비교

```ts
for (const journal of listMindmapDraftJournals(storage, mindmapId)) {
  const server = await fetchNodeContent(journal.nodeId);
  if (server.node.contentMd === journal.contentMd) {
    removeDraftJournal(storage, mindmapId, journal.nodeId);
  } else {
    unresolved.push({ nodeId: journal.nodeId, title: server.node.title });
  }
}
```

journal의 `baseRevision`만으로 동일 여부를 추정하지 않는다. 실제 서버 content와 비교해 같을 때만 정리한다. 다르면 자동 적용이나 자동 폐기 없이 사용자가 해당 Node를 열어 recovery 선택을 완료하도록 안내한다.

### 안전한 파일 응답과 다운로드

```ts
const url = URL.createObjectURL(blob);
const anchor = document.createElement("a");
anchor.href = url;
anchor.download = filename;
anchor.click();
setTimeout(() => URL.revokeObjectURL(url), 0);
```

서버는 Unicode `filename*`와 고정 ASCII fallback을 함께 제공한다. client는 RFC 5987 값을 우선 해석하며 blob URL을 영구 보관하지 않는다. modal의 ref lock이 React pending render 전 같은 turn의 이중 클릭도 차단한다.

## 5. 구현 중 문제 해결

### root 메뉴 정책 변경

10단계에서는 root 삭제 금지를 가장 명확하게 표현하기 위해 root 메뉴 자체가 없었다. 11단계에서는 모든 Node가 export 진입점을 가져야 하므로 root 메뉴를 다시 제공하되 메뉴 항목을 export 하나로 제한했다. 기존 Editor component/E2E의 “root 메뉴 없음” 단언을 “root export 있음, root 삭제 없음”으로 갱신했다.

### 서버 저장과 journal 정리 순서

export journal 검사를 먼저 하면 방금 작성한 dirty draft가 서버와 달라 recovery로 오인될 수 있다. Editor에서는 autosave barrier를 먼저 통과시키고 그 다음 journal을 비교한다. 정상 저장 성공은 journal을 이미 지우며, keepalive 등으로 남은 동일 journal도 비교 단계에서 안전하게 정리된다.

### late response와 queue 대기

React state의 coordinator record만 읽으면 비동기 callback 직전의 상태를 놓칠 수 있다. coordinator 내부에 동기 ref mirror를 두고 `getCurrentRecord`와 `waitForNodes`가 이를 사용하게 했다. 화면 렌더용 state와 export 판단용 최신 상태를 분리하되 record 갱신 진입점은 하나로 유지했다.

### Playwright 실행 환경

다운로드 파일명과 내용을 실제로 읽는 E2E 코드를 Dashboard와 Editor 시나리오에 추가했다. 현재 PostgreSQL이 없어 DB 의존 5개는 skip 조건이며, foundation 시나리오는 session DB 연결 대기 때문에 결과가 끝나지 않아 약 3분 후 수동 중단했다. 이를 성공으로 기록하지 않고 12단계 backlog로 이관했다.

## 6. 검증 결과

### PASS

| 검증 | 결과 |
|---|---|
| `npm run lint` | 오류·경고 없이 성공 |
| `npm run typecheck` | 성공 |
| `npm run test -- --run` | 33 files, 126 tests 성공 |
| exporter/API unit test | scope 문서, path, 안정 순서, raw Markdown, 빈 본문, 파일명/header, strict validation·보안 성공 |
| component/lib test | modal scope/focus/중복 준비, journal 비교, Blob URL 생성·해제, Dashboard/Node 메뉴 회귀 성공 |
| autosave test | dirty target 즉시 flush 후 queue 완료·journal 삭제와 export 준비 성공 |
| `npm run build` | Next.js 16.3.1 production build 성공, export route 수집 |
| `npx playwright test --list` | 4 files, 6 tests 수집 성공 |

### NOT VERIFIED

| 검증 | 사유 |
|---|---|
| `npm run test:integration` | PostgreSQL `localhost:5432` IPv4/IPv6 `ECONNREFUSED` |
| export service integration | 작성 완료. 실제 repeatable-read/scope/소유권 query 실행에는 migration된 PostgreSQL 필요 |
| DB 기반 Playwright 5개 | `E2E_DATABASE_READY=true` 환경이 없어 skip |
| Playwright foundation 완료 | session DB 연결 대기로 종료되지 않아 약 3분 후 수동 중단 |
| 실제 `.md` 파일 열기 | DB 기반 download response를 생성할 실행 환경이 없어 미검증 |

E2E에는 Dashboard `ALL` 다운로드의 파일명·제목 확인과 Editor dirty Markdown을 `NODE`로 즉시 저장한 뒤 다운로드 파일 본문을 읽는 검증을 추가했다. service integration에는 ALL/NODE/SUBTREE, root path, sibling 제외, 비소유와 다른 Mindmap Node 404를 작성했다.

## 7. Trade-off

### export를 POST로 제공

파일 생성은 읽기 작업이지만 scope와 node 조합을 strict JSON으로 확장하고 same-origin 보호를 일관되게 적용하기 위해 POST를 사용했다. 응답은 `no-store`이며 browser/history cache에 문서를 남기지 않는다.

### 전체 tree metadata는 모든 scope에서 읽음

`NODE`도 root부터의 정확한 경로와 Mindmap 무결성을 검증하기 위해 경량 metadata 전체를 읽는다. `contentMd`는 선택 범위만 읽어 초기 payload와 DB 전송량을 보호한다. 1,000 node에서 metadata query 비용은 12단계에서 측정한다.

### recovery를 modal 안에서 직접 해결하지 않음

ExportModal에서 초안 적용/폐기까지 제공하면 선택 Node 변경, detail query, autosave timer가 modal 책임에 섞인다. 이번 단계는 제목·개수와 함께 명확히 차단하고 기존 상세 panel의 recovery UX로 해결하도록 유지했다.

### raw HTML을 제거하지 않고 원문 보존

export는 renderer가 아니라 데이터 이동 기능이다. Markdown preview는 raw HTML을 실행하지 않지만 파일에는 사용자가 작성한 원문을 유지한다. 외부 Markdown viewer의 HTML 정책은 해당 도구가 결정한다.

## 8. 개선 방향

- 12단계 PostgreSQL에서 export 중 동시 content 수정 transaction을 교차 실행해 snapshot 일관성을 검증한다.
- 1,000 node ALL export의 query 시간, Markdown 크기, 서버 메모리를 측정한다.
- 실제 Chromium에서 keyboard만으로 세 진입점, radio, Escape, focus 복원과 다운로드를 재검증한다.
- recovery가 여러 개인 경우 해당 Node 상세로 순차 이동하는 보조 UX를 향후 검토한다.
- 큰 Markdown의 browser Blob 메모리와 다운로드 시작 시간을 계측하고 필요할 때만 streaming response를 검토한다.

## 9. 결론

11단계는 저장이 끝난 서버 snapshot만 문서화한다는 원칙으로 ALL/NODE/SUBTREE export를 완성했다. 서버는 repeatable-read 안에서 안정적인 tree와 상세 경로를 생성하고, client는 대상 저장 queue와 recovery journal을 통과한 경우에만 UTF-8 파일 다운로드를 시작한다.

정적 검사, 126개 unit/component test와 production build는 통과했다. PostgreSQL integration과 실제 다운로드 E2E는 연결 거부와 DB 부재를 숨기지 않고 12단계 검증 backlog에 남겼다.
