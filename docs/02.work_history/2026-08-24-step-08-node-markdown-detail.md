# 08단계 Node 상세 Markdown 패널·미리보기·전체화면

> 작업일: 2026-08-24  
> 대상 단계: `docs/MASTER_PLAN.md` 08  
> 최종 상태: `✅ DONE`  
> 미검증 항목: PostgreSQL integration 및 DB 기반 Playwright E2E는 12단계 Infrastructure Validation Backlog로 이관

## 1. 작업 배경

07단계까지 Editor는 node tree를 조회하고 제목 편집, 자식 생성, drag 위치 저장, 하위 tree 접기·펼치기를 지원했다. 그러나 node가 구조상의 짧은 제목만 가질 수 있어, MVP의 두 번째 핵심 가치인 “노드별 상세 지식 기록”은 아직 사용할 수 없었다.

08단계의 목표는 다음 사용자 흐름을 완성하는 것이었다.

```text
Node 선택 또는 [상세]
        ↓
오른쪽 상세 패널
        ↓
Markdown 편집 / GFM 미리보기
        ↓
전체화면 집중 편집
        ↓
기존 선택·viewport·zoom·panel 상태로 복귀
```

자동저장 전체 상태기는 09단계 책임이므로, 이번 단계에서는 실제 콘텐츠 API와 mutation 기반을 준비하되 UI가 임의의 저장 정책을 만들지 않도록 범위를 구분했다. 작성 내용은 Editor가 열린 동안 node별 in-memory draft로 유지한다.

## 2. 변경 요약

### Backend

- `GET /api/nodes/:nodeId/content`를 추가했다.
- `PATCH /api/nodes/:nodeId/content`를 추가했다.
- 응답을 `id`, `title`, `contentMd`, `revision`으로 제한했다.
- 비소유 node를 404로 처리하고 revision 충돌은 409로 처리했다.
- Markdown 본문을 UTF-8 기준 256KiB 이하로 제한했다.
- content 저장과 Mindmap `updatedAt` 갱신을 같은 transaction에서 수행했다.

### Frontend

- node 선택과 node 내부 `[상세]` 버튼을 동일한 상세 열기 동작으로 연결했다.
- 오른쪽 상세 패널에 제목, 편집/미리보기 tab, textarea, 상태 영역, 닫기와 전체화면 버튼을 구현했다.
- 전체화면을 Editor 내부 overlay로 구현했다.
- desktop에서는 편집기와 미리보기를 분할하고 좁은 화면에서는 tab으로 전환한다.
- node ID별 Query cache와 in-memory draft를 분리했다.
- 전체화면 종료 시 선택 node, 패널, React Flow viewport/zoom을 유지하고 진입 버튼으로 focus를 복원한다.

### Markdown

- `react-markdown`과 `remark-gfm`을 추가했다.
- heading, list, table, 취소선, code block, link를 미리보기에서 지원한다.
- `rehype-raw`를 사용하지 않아 Markdown 안의 raw HTML을 DOM으로 렌더하지 않는다.

### 문서 및 테스트

- `docs/MASTER_PLAN.md`의 08단계를 `✅ DONE`으로 갱신했다.
- API route, Markdown renderer, component, integration, E2E test를 추가했다.
- 실제 DB 및 브라우저 검증 항목은 12단계 backlog에 기록했다.

## 3. 구조 분석

```text
src/
├── app/api/nodes/[nodeId]/content/route.ts
├── features/mindmap/
│   ├── api/
│   │   ├── client.ts
│   │   └── contracts.ts
│   ├── components/
│   │   ├── markdown-preview.tsx
│   │   ├── mindmap-editor.tsx
│   │   ├── mindmap-node.tsx
│   │   └── node-detail.tsx
│   └── hooks/use-node-content.ts
├── server/
│   ├── domain/
│   │   ├── mindmap.dto.ts
│   │   └── node.service.ts
│   └── http/api.ts
└── app/globals.css

tests/
├── unit/
│   ├── markdown-preview.test.tsx
│   ├── mindmap-editor.test.tsx
│   └── node-content-route.test.ts
├── integration/node.service.test.ts
└── e2e/editor.spec.ts
```

### API 계약 계층

`contracts.ts`는 client와 Route Handler가 공유하는 Node content DTO, PATCH input과 크기 상한을 정의한다. UTF-8 byte 검증을 계약에 둬 한글과 ASCII가 서로 다른 byte 수를 갖는 경우에도 같은 정책을 적용한다.

### 서버 domain 계층

`node.service.ts`는 소유권 조회와 revision 조건부 저장을 담당한다. 기존 title, position, collapse가 사용하는 공통 `updateOwnedNodeWithRevision`에 `contentMd` mutation을 추가해 충돌 정책을 통일했다.

### Query 계층

`use-node-content.ts`는 전체 Mindmap query와 독립된 node content query key를 사용한다.

```text
["mindmaps", mindmapId]       → canvas에 필요한 구조·좌표·revision
["nodes", nodeId, "content"] → 선택 node의 Markdown 본문
```

content mutation 성공 시 content cache와 Mindmap detail cache의 revision을 함께 갱신할 수 있도록 hook을 구성했다. 실제 debounce 호출은 09단계에서 연결한다.

### UI 계층

`mindmap-editor.tsx`가 selected node, panel/fullscreen 상태와 node별 draft map을 소유한다. `node-detail.tsx`는 서버 조회 상태와 controlled draft를 받아 panel 및 overlay UI를 제공한다. Markdown 변환은 별도의 `markdown-preview.tsx`로 격리했다.

## 4. 주요 기술적 결정

### 전체 Mindmap 응답에서 `contentMd`를 제외

Mindmap 하나에 최대 1,000개 node를 관리하는 목표가 있으므로 모든 Markdown 본문을 Editor 최초 조회에 포함하면 구조만 탐색하려는 사용자도 전체 문서 크기를 부담하게 된다.

따라서 기존 `MindmapNodeDTO`는 그대로 유지하고, 사용자가 node 상세을 열 때만 content API를 호출한다. 이 선택은 초기 canvas 응답 크기를 예측 가능하게 유지하고 향후 content cache와 자동저장을 node 단위로 다루기 쉽게 한다.

### UTF-8 256KiB 상한

제품 문서에는 Markdown 상한이 정해져 있지 않았다. PoC에서 긴 기술 문서를 수용하면서 무제한 요청 본문과 DB row 성장을 피하기 위해 node 하나당 UTF-8 256KiB를 기술 기본값으로 정했다.

```ts
export const NODE_CONTENT_MAX_BYTES = 256 * 1_024;

export const updateNodeContentInputSchema = z.object({
  contentMd: z.string().refine(
    (value) => new TextEncoder().encode(value).byteLength <= NODE_CONTENT_MAX_BYTES,
    "Markdown 내용은 UTF-8 기준 256KiB 이하여야 합니다.",
  ),
  revision: z.number().int().nonnegative(),
});
```

문자 수가 아니라 실제 UTF-8 byte를 측정하므로 한글이나 emoji를 포함해도 저장 정책이 명확하다. JSON escape로 인해 전송 body가 원문보다 커질 수 있어 content route의 body 상한은 worst-case escape를 수용하고, 최종 본문 크기는 Zod schema가 판정한다.

### 기존 revision 공통 update 재사용

content만 별도의 저장 규칙으로 구현하면 title·position·collapse와 동시 변경될 때 오래된 요청이 최신 상태를 덮을 수 있다. 모든 node 변경은 하나의 revision을 공유하므로 content 역시 기존 조건부 update helper를 사용했다.

```ts
return updateOwnedNodeWithRevision(
  nodeId,
  userId,
  revision,
  { contentMd },
  client,
);
```

조건에 맞는 row가 없으면 409를 반환하고, 소유권 확인 단계에서 찾지 못하면 404를 반환한다. 저장 성공 시 node revision을 증가시키고 Mindmap 수정 시간을 같은 transaction에서 갱신한다.

### node별 draft map

하나의 `contentDraft` 문자열만 두면 node A를 편집하다 B로 전환할 때 A의 내용이 B에 잠시 보이거나 늦게 도착한 조회 응답이 다른 node의 초안을 덮을 수 있다.

```ts
const [contentDrafts, setContentDrafts] = useState<
  Readonly<Record<string, string>>
>({});

const changeContentDraft = useCallback((nodeId: string, value: string) => {
  setContentDrafts((current) =>
    current[nodeId] === value ? current : { ...current, [nodeId]: value },
  );
}, []);
```

서버 content는 Query cache가 node ID별로 관리하고, 사용자가 실제로 입력한 시점부터 draft map이 우선한다. `draft ?? serverContent` 규칙을 사용해 조회 완료를 effect로 복사하지 않고도 늦은 응답이 사용자 입력을 덮지 않게 했다.

### 전체화면을 route가 아닌 overlay로 구현

별도 route로 이동하면 Editor와 React Flow가 unmount되며 viewport, zoom, selection을 복원하기 위한 추가 직렬화가 필요하다. 이번 전체화면은 Editor tree 위에 fixed overlay를 올려 기존 canvas를 그대로 유지한다.

```tsx
<div
  role="dialog"
  aria-modal="true"
  className="fixed inset-0 z-50 flex flex-col bg-[var(--background)]"
>
  {/* Markdown editor / preview */}
</div>
```

overlay 종료 시 `queueMicrotask`에서 전체화면 진입 버튼으로 focus를 돌려 키보드 사용자가 문맥을 잃지 않게 했다. `Escape`도 동일한 종료 함수를 사용한다.

### 자동저장을 09단계에 유지

08단계에서 임시 수동 저장 버튼이나 blur 저장을 추가하면 09단계의 2초 debounce, 요청 순서 보호, 재시도, local draft journal과 충돌하는 임시 UX가 생긴다.

이번 단계는 다음까지만 제공한다.

- content 조회·수정 API
- content mutation hook과 cache 갱신 기반
- controlled in-memory draft
- 서버 원문과 draft 차이를 보여 주는 상태 영역

실제 mutation 호출 시점과 저장 상태기는 09단계에서 한 번에 완성한다.

## 5. 핵심 구현

### Content Route Handler

```ts
export async function PATCH(request: NextRequest, context: NodeContentRouteContext) {
  assertSameOrigin(request);
  const user = await requireApiUser(request);
  const nodeId = nodeIdSchema.safeParse((await context.params).nodeId);
  const body = updateNodeContentInputSchema.safeParse(
    await readJsonBody(request, CONTENT_REQUEST_MAX_BYTES),
  );

  const node = await updateNodeContentForUser(
    nodeId.data,
    user.id,
    body.data.contentMd,
    body.data.revision,
  );

  return NextResponse.json({ node: toNodeContentDTO(node) });
}
```

mutation route는 기존 보안 경계와 동일하게 same-origin, DB session, UUID, JSON body, domain ownership을 차례로 검증한다. GET은 상태를 바꾸지 않으므로 same-origin mutation 검사는 적용하지 않는다.

### 안전한 Markdown renderer

```tsx
export function MarkdownPreview({ content }: { content: string }) {
  return (
    <div className="markdown-preview break-words text-sm leading-7">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
    </div>
  );
}
```

GFM plugin만 사용하고 raw HTML parser를 추가하지 않았다. `<script>`와 event handler가 있는 `<img>`가 실제 DOM에 생성되지 않는지 component test로 확인했다.

### Panel과 fullscreen의 동일 draft 공유

panel과 fullscreen은 같은 `contentDrafts[selectedNodeId]`를 받는다. 전체화면을 열 때 내용을 복사하지 않으므로 두 화면 사이에 별도 동기화 문제가 생기지 않는다.

```tsx
<NodeDetailPanel
  nodeId={selectedNodeId}
  draft={contentDrafts[selectedNodeId]}
  onChangeDraft={changeContentDraft}
/>

<NodeDetailFullscreen
  nodeId={selectedNodeId}
  draft={contentDrafts[selectedNodeId]}
  onChangeDraft={changeContentDraft}
/>
```

## 6. 구현 중 발견한 문제와 해결

### 조회 실패가 loading 상태에 가려지는 문제

초기 구현은 `draft === undefined`를 error보다 먼저 검사했다. content 요청이 실패하면 draft가 초기화되지 않으므로 화면이 영원히 skeleton으로 남고 재시도 버튼이 나타나지 않았다.

조건 순서를 error → pending 순으로 변경했다.

```ts
if (content.isError) {
  return <ContentError onRetry={content.refetch} />;
}
if (content.isPending || draft === undefined) {
  return <ContentSkeleton />;
}
```

이 회귀는 “실패 응답 후 오류와 다시 시도 버튼 표시” component test로 고정했다.

### node 선택이 기존 test의 API 호출 수를 바꾼 문제

기존 07단계 component test는 node 선택이 로컬 selection만 바꾼다고 가정했다. 08단계부터 node 선택은 content GET도 발생시키므로 collapse API mock이 content 요청까지 소비하는 문제가 드러났다.

test mock을 URL 기준으로 분기하고 collapse endpoint 호출만 필터링해 검증하도록 수정했다. 이는 test 기대값을 느슨하게 만든 것이 아니라 새 공개 동작을 정확히 반영한 것이다.

### 병렬 검증 중 bcrypt test timeout

unit, lint, typecheck를 동시에 실행한 한 차례 검증에서 CPU 비용이 큰 bcrypt test가 5초 제한을 넘었다. 기능 실패와 구분하기 위해 전체 unit suite를 단독 재실행했고 22 files, 81 tests가 모두 통과했다. timeout을 임의로 늘리거나 보안 cost를 낮추지는 않았다.

### PostgreSQL 연결 불가

`npm run test:integration`은 `localhost:5432`의 IPv4/IPv6 연결 거부로 시작 단계에서 실패했다. integration test code 자체는 추가했지만 실행 결과를 성공으로 간주하지 않았다. 실제 DB 검증 책임은 `docs/MASTER_PLAN.md` Infrastructure Validation Backlog의 08 항목에 남겼다.

## 7. 검증 결과

### PASS

| 검증 | 결과 |
|---|---|
| `npm run lint` | 오류·경고 없이 성공 |
| `npm run typecheck` | 성공 |
| `npm run test` | 22 files, 81 tests 성공 |
| Markdown renderer test | heading/list/table/취소선/code/link/raw HTML 비실행 성공 |
| content route test | GET/PATCH, 빈 값, 256KiB 경계, 초과 거부, 409/404 성공 |
| detail component test | A/B draft 격리, preview, fullscreen, Escape, focus·viewport 유지 성공 |
| `npm run build` | Next.js 16.3.1 production build 성공 |
| `npx playwright test --list` | 4 files, 6 tests 수집 성공 |
| `git diff --check` | whitespace 오류 없음 |

### NOT VERIFIED

| 검증 | 사유 |
|---|---|
| `npm run test:integration` | PostgreSQL `localhost:5432` 연결 거부 |
| DB 기반 content 저장·소유권·revision·updatedAt | PostgreSQL 미실행 |
| 실제 Playwright Markdown 시나리오 | E2E가 migration된 PostgreSQL test data를 요구함 |
| 실제 긴 문서·반응형·시각·browser console | 실행 가능한 DB/browser E2E 환경 미준비 |

### 의존성 점검

`react-markdown`, `remark-gfm` 설치 후 npm audit에서 high severity 3건이 보고됐다. 기존 기록과 같은 Prisma CLI 의존 경로의 advisory이며 자동 수정은 Prisma major downgrade를 제안할 수 있어 `npm audit fix --force`를 실행하지 않았다.

## 8. Trade-off

### 선택 시 별도 content GET이 발생하는 비용

node를 처음 열 때 네트워크 round trip이 한 번 추가된다. 대신 사용하지 않는 999개 node의 긴 본문을 초기 canvas 응답에서 제외할 수 있고, 한번 조회한 node는 Query cache를 재사용한다. 1,000 node 목표에서는 이 trade-off가 초기 로딩에 유리하다.

### in-memory draft의 한계

node 전환과 panel/fullscreen 왕복에서는 draft가 유지되지만 새로고침이나 tab 종료에는 남지 않는다. 이는 누락이 아니라 09단계의 local draft journal과 서버 자동저장이 해결해야 할 명시적 경계다. 08단계에서 불완전한 localStorage 정책을 먼저 만들지 않았다.

### 하나의 node revision을 공유하는 영향

title, position, collapse, content가 같은 revision을 사용하므로 서로 다른 필드의 동시 변경도 충돌할 수 있다. 충돌 빈도는 늘 수 있지만 오래된 요청이 다른 필드의 최신 상태를 모른 채 저장되는 것을 막는다. 09단계는 409 시 최신 node를 재조회하고 draft를 보존하는 흐름을 구현해야 한다.

### 직접 만든 Markdown 스타일

Tailwind Typography plugin을 추가하지 않고 현재 디자인 token에 맞춘 최소 `.markdown-preview` CSS를 작성했다. 의존성과 전역 스타일 영향을 줄이는 대신 복잡한 문서 typography 옵션은 제한된다. MVP에서 필요한 heading, list, quote, code, table, link 가독성에 범위를 맞췄다.

### 임시 수동 저장 버튼을 만들지 않은 이유

사용자는 최종 제품에서 자동저장을 기대한다. 08단계만을 위해 수동 저장 버튼을 만들었다가 09단계에서 제거하면 UI와 test가 불필요하게 흔들린다. 상태 영역에 현재 내용이 임시 초안이며 자동저장은 다음 단계에서 연결된다고 정직하게 표시했다.

## 9. 후속 개선 방향

### 09단계 자동저장

- 마지막 입력 후 2초 debounce
- node별 저장 sequence와 in-flight 상태
- 실제 서버 응답 기준 `Dirty → Saving → Saved/Error`
- 409 충돌 시 최신 revision 재조회와 사용자 draft 유지
- 실패 재시도 및 panel 닫기/화면 이동 시 즉시 저장 시도
- 새로고침·tab 종료에 대비한 local draft journal
- content mutation 성공 후 Mindmap 수정 시간과 관련 cache 일관성 확인

### 12단계 실제 검증

- PostgreSQL integration test 전체 실행
- 256KiB ASCII/한글/emoji 경계 검증
- 사용자 A/B content 접근 격리
- 실제 Chromium에서 panel/preview/fullscreen/focus/viewport 확인
- 긴 Markdown과 1,000 node 환경에서 content on-demand 조회 성능 측정
- browser console의 hydration, accessibility, unhandled rejection 확인

### 품질 개선 후보

- Markdown link의 새 창 정책이 필요해지면 안전한 `rel` 정책과 함께 결정
- 문서 내 heading anchor, syntax highlighting은 실제 요구가 확인된 뒤 추가
- 256KiB 상한이 부족하거나 과도한지 운영 데이터로 재평가
- fullscreen focus trap은 MVP 접근성 검증 결과에 따라 보강

## 10. 결론

08단계에서는 전체 Mindmap 초기 응답을 비대하게 만들지 않으면서 선택 node의 Markdown을 안전하게 조회·편집·미리보기할 수 있는 기반을 완성했다. node별 Query cache와 draft map으로 A/B 초안을 격리했고, Editor 내부 overlay를 사용해 전체화면 왕복 후에도 선택과 canvas viewport를 보존했다.

정적 검사, 81개 unit/component test, production build와 Playwright 시나리오 수집은 성공했다. 실제 PostgreSQL integration과 DB 기반 E2E는 환경 제약을 숨기지 않고 12단계 backlog에 유지했다. 다음 09단계는 이번에 만든 content API와 mutation cache 기반 위에서 2초 자동저장, 저장 상태, 충돌·실패 복구와 재접속 draft 보호를 구현하면 된다.
