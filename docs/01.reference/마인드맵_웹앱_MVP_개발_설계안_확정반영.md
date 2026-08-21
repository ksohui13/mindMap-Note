# 마인드맵 웹앱 MVP 개발 설계안

> 목적: 확정된 PRD와 화면 구성을 기반으로 MVP 개발 범위, 개발 순서, 컴포넌트 구조, 프론트엔드 구조, API·상태관리·DB 초안을 정의함.

---

# 1. 개발 방향

## 1.1 핵심 목표

MVP에서는 사용자가 다음 흐름을 끊김 없이 수행할 수 있는 것을 우선함.

```text
회원가입 / 로그인
        ↓
마인드맵 목록 조회
        ↓
새 마인드맵 생성
        ↓
노드 생성 / 수정 / 이동
        ↓
노드 상세 Markdown 작성
        ↓
자동 저장
        ↓
Markdown 내보내기
```

핵심 가치는 다음 두 가지임.

1. 마인드맵을 통한 **지식 구조화**
2. 노드별 Markdown을 통한 **상세 지식 기록**

따라서 디자인·개발 모두 **마인드맵 편집 경험을 최우선**으로 둠.

---

# 2. 전체 화면 구성

| ID | 화면 | 유형 | 주요 목적 |
|---|---|---|---|
| S01 | 로그인 / 회원가입 | Page | 사용자 인증 |
| S02 | 마인드맵 대시보드 | Page | 마인드맵 조회·생성·관리 |
| S03 | 마인드맵 편집기 | Page | 노드 구조 작성·탐색 |
| S04 | 노드 상세 패널 | Panel | 노드별 Markdown 작성 |
| S05 | 노드 상세 전체화면 | Page / Overlay | Markdown 집중 편집 |
| S06 | 삭제 확인 | Modal | 마인드맵/노드 삭제 확인 |
| S07 | Markdown 내보내기 | Modal | 내보내기 범위 선택 |

총 주요 화면은 **7개**로 관리함.

저장 상태, 제목 편집 상태, Empty State 등은 새로운 화면을 추가하지 않고 각 화면의 State 또는 Variant로 관리함.

---

# 3. 기능 개발 우선순위

## 3.1 전체 개발 순서

화면 번호 순서대로 개발하지 않고 **사용자 핵심 흐름과 기능 의존성**을 기준으로 개발함.

```text
1단계
인증 / 기본 데이터 구조
        ↓
2단계
대시보드 / 마인드맵 생성
        ↓
3단계
마인드맵 편집기
        ↓
4단계
노드 상세 Markdown
        ↓
5단계
자동저장 / 오류 처리
        ↓
6단계
삭제 / 내보내기
        ↓
7단계
1,000 Node 성능 최적화
```

---

## 3.2 Phase 1. 인증과 기본 구조

### 대상 화면

- S01 로그인 / 회원가입

### 구현 기능

- 회원가입
- 로그인
- 로그아웃
- 로그인 상태 확인
- 비로그인 Route 접근 차단
- 사용자별 데이터 분리
- 인증 실패 메시지

### 우선 구현 이유

모든 Mindmap 데이터가 사용자에 종속되므로 Mindmap 기능보다 인증과 사용자 식별 구조가 먼저 존재해야 함.

---

# 4. Phase 2. 대시보드 및 마인드맵 생성

### 대상 화면

- S02 마인드맵 대시보드

### MVP 기능

- 사용자 마인드맵 목록 조회
- 제목 표시
- 최근 수정일 표시
- 노드 수 표시
- 새 마인드맵 생성
- 마인드맵 열기
- 마인드맵 이름 변경
- 마인드맵 삭제
- Markdown 내보내기 진입

### 생성 프로세스

```text
[+ 새 마인드맵]
        ↓
현재 사용자의 Mindmap 중
MAX(sequence_no) 조회
        ↓
N = MAX(sequence_no) + 1
        ↓
Mindmap 생성
title = 새로운 마인드맵 N
        ↓
Root Node 생성
title = 시작
        ↓
Editor 이동
        ↓
Root Node Edit Mode
```

번호 정책:

- `N`은 **현재 존재하는 최대 번호 + 1**
- `1, 2, 3`에서 `3` 삭제 후 신규 생성 시 `3` 재사용
- `1, 3` 상태에서 신규 생성 시 `4`
- 중간에 비어 있는 번호를 별도로 검색하여 채우지는 않음

### MVP 이후

다음 기능은 현재 PRD 기준 필수가 아니므로 후순위로 둠.

- 즐겨찾기
- 폴더
- 최근 열람
- 휴지통
- 검색
- 정렬 방식 다양화
- Grid / List 전환

디자인 시안에는 포함될 수 있으나 **MVP 개발 범위와는 별도로 판단**함.

---

# 5. Phase 3. 마인드맵 편집기

### 대상 화면

- S03 마인드맵 편집기

가장 우선순위가 높은 핵심 기능 영역임.

---

## 5.1 노드 조회

지원 기능:

- Root Node 표시
- Child Node 표시
- 부모-자식 연결선 표시
- Node 선택 상태
- 현재 Mindmap 정보 표시

---

## 5.2 노드 생성

지원 기능:

- 선택 Node의 Child Node 생성
- 기본 위치 계산
- 생성 직후 Edit Mode
- 자동 Focus
- 빈 Node 생성 금지

```text
Node [+]
   ↓
Child 생성
   ↓
Edit Mode
   ↓
사용자 입력
   ↓
Enter
   ↓
서버 저장
```

---

## 5.3 노드 제목 편집

공통 규칙:

```text
더블클릭
   ↓
Edit Mode

Enter
   ↓
변경 확정

Esc
   ↓
변경 취소
```

유효성 규칙:

- 빈 문자열 저장 불가
- 공백만 있는 문자열 저장 불가
- Esc 입력 시 이전 제목 복원

---

## 5.4 노드 이동

지원 기능:

- Drag 시작
- Drag 중 프론트 위치 변경
- Drag 종료
- 최종 위치 서버 저장

```text
Drag Start
    ↓
Frontend Position Update
    ↓
Drag End
    ↓
PATCH Node Position
    ↓
저장 중...
    ↓
저장 완료
```

Drag로 부모 관계는 변경하지 않음.

---

## 5.5 캔버스 탐색

지원 기능:

- Pan
- Zoom In
- Zoom Out
- Fit View
- 하위 트리 접기
- 하위 트리 펼치기

---

# 6. Phase 4. 노드 상세 Markdown

## 대상 화면

- S04 노드 상세 패널
- S05 노드 상세 전체화면

---

## 6.1 상세 패널

지원 기능:

- 선택 Node 제목
- Markdown Editor
- Markdown Preview
- 자동저장
- 저장 상태
- Panel Close
- Fullscreen 진입

```text
Node 선택
   ↓
Detail Panel Open
   ↓
Node Content 조회
   ↓
Markdown 작성
```

---

## 6.2 전체화면 편집

지원 기능:

- Markdown Editor
- Markdown Preview
- Editor / Preview 분할
- 자동저장
- 전체화면 종료

전체화면 종료 시 다음 상태를 유지함.

- 선택 Node
- Canvas Position
- Zoom
- Detail Panel 상태

---

# 7. Phase 5. 저장 및 오류 처리

## 자동저장 대상

- Mindmap 제목
- Node 제목
- Node 위치
- Node Markdown
- Collapse 상태

### 저장 전략

| 데이터 | 저장 Trigger |
|---|---|
| Node 제목 | Enter |
| Node 위치 | Drag End |
| Markdown | 마지막 입력 후 **2초 debounce** |
| Mindmap 제목 | 입력 확정 |
| Collapse 상태 | 접기/펼치기 발생 |

---

## 저장 상태

```text
Idle
 ↓
Dirty
 ↓
Saving
 ↓
Saved
```

실패 시:

```text
Saving
 ↓
Failed
 ↓
Retry
```

UI:

```text
저장 중…
저장 완료
저장 실패 · 다시 시도
```

서버 저장 실패 시 사용자가 작성한 Frontend State를 즉시 제거하지 않음.

추가 저장 규칙:

- Detail Panel 닫기 또는 다른 화면으로 이동할 때 미저장 Markdown이 있으면 즉시 저장 시도
- 같은 Node에 대한 이전 저장 요청보다 최신 편집 내용이 우선되도록 요청 순서/버전 관리 필요

---

# 8. Phase 6. 삭제 및 Markdown 내보내기

## S06 삭제 확인 Modal

### Mindmap 삭제

- 대상 Mindmap 표시
- 전체 Node가 삭제된다는 사실 안내
- 취소
- 삭제

### Node 삭제

- 대상 Node 표시
- 하위 Node 개수 표시
- 하위 Tree 삭제 안내
- 취소
- 삭제

Root Node에는 삭제 기능을 제공하지 않음.

---

## S07 Markdown 내보내기

지원 범위:

```text
전체 마인드맵

현재 Node

현재 Node
+
모든 하위 Node
```

MVP 지원 Format:

```text
Markdown (.md)
```

포함 정보:

- Mindmap 제목
- 선택 범위
- Tree 구조
- Node 경로
- Node 제목
- Node Markdown

---

# 9. MVP / 2차 기능 구분

## 9.1 MVP

### 인증

- 회원가입
- 로그인
- 로그아웃
- 사용자 데이터 분리

### Mindmap

- 생성
- 조회
- 제목 수정
- 삭제

### Node

- 생성
- 조회
- 제목 수정
- 삭제
- 위치 이동
- Tree Collapse / Expand

### Canvas

- Pan
- Zoom
- Fit View

### Detail

- Markdown 편집
- Markdown Preview
- 전체화면 편집

### 저장

- 자동저장
- 저장 상태
- 저장 실패 Retry

### Export

- 전체 Mindmap
- 현재 Node
- 현재 Node + 하위 Tree
- Markdown 다운로드

---

## 9.2 2차 기능

### Node 구조

- 부모 Node 변경
- Drag 기반 부모 변경
- 부모 선택 Tree UI
- 자기 자신을 부모로 선택할 수 없음
- **자신의 하위 Node를 새로운 부모로 선택할 수 없음**
- 부모 변경으로 순환 구조가 발생하지 않도록 검증
- Root Node의 부모는 변경할 수 없음

### Layout

- 자동 정렬
- Tree Layout
- Layout 방향 변경

### 탐색

- Node 검색
- Markdown 검색
- 검색 결과 Focus

### 관리

- Folder
- Favorite
- Trash
- 최근 열람

### 협업

- 공유 Link
- 사용자 초대
- 공동 편집
- 권한 설정

### 확장

- 이미지 첨부
- 파일 첨부
- PNG Export
- PDF Export
- Import
- Version History

### AI

- AI Node 생성
- AI 요약
- AI Chat
- 선택 Tree Context 기반 질의

---

# 10. 화면별 컴포넌트 구조

# 10.1 S01 Auth

```text
AuthPage
├── BrandSection
│   ├── Logo
│   ├── Headline
│   └── MindmapPreview
│
└── AuthCard
    ├── AuthTabs
    ├── EmailField
    ├── PasswordField
    ├── ErrorMessage
    ├── LoginButton
    └── SignUpButton
```

---

# 10.2 S02 Dashboard

```text
DashboardPage
├── AppHeader
│
├── Sidebar
│
└── DashboardContent
    ├── PageHeader
    │   ├── PageTitle
    │   └── CreateMindmapButton
    │
    ├── MindmapList
    │   └── MindmapCard
    │       ├── MindmapPreview
    │       ├── MindmapTitle
    │       ├── ModifiedDate
    │       ├── NodeCount
    │       └── MindmapMenu
    │
    └── DashboardEmptyState
```

---

# 10.3 S03 Mindmap Editor

```text
MindmapEditorPage
├── EditorHeader
│   ├── BackButton
│   ├── MindmapTitleEditor
│   ├── SaveStatus
│   └── ExportButton
│
└── MindmapCanvas
    ├── Node
    │   ├── NodeTitle
    │   ├── AddChildButton
    │   └── NodeMenu
    │
    ├── Edge
    │
    ├── CanvasToolbar
    │
    └── ZoomControl
```

---

# 10.4 S04 Node Detail

```text
NodeDetailPanel
├── DetailHeader
│   ├── NodeTitle
│   ├── SaveStatus
│   ├── ExpandButton
│   └── CloseButton
│
├── DetailTabs
│   ├── EditTab
│   └── PreviewTab
│
└── MarkdownEditor
```

---

# 10.5 S05 Fullscreen Detail

```text
NodeDetailFullscreen
├── Header
│   ├── CloseFullscreenButton
│   ├── NodeTitle
│   └── SaveStatus
│
└── MarkdownWorkspace
    ├── MarkdownToolbar
    ├── MarkdownEditor
    └── MarkdownPreview
```

---

# 10.6 S06 Delete Modal

```text
DeleteConfirmModal
├── DeleteIcon
├── Title
├── Description
├── CancelButton
└── DeleteButton
```

Mindmap와 Node 삭제가 같은 Modal Component를 공유함.

---

# 10.7 S07 Export Modal

```text
ExportModal
├── ModalHeader
├── ExportScopeSelector
├── IncludeInfo
├── ExportFormat
├── CancelButton
└── ExportButton
```

---

# 11. 재사용 컴포넌트 기준

컴포넌트를 `도메인 컴포넌트`와 `공통 UI 컴포넌트`로 구분함.

---

## 11.1 Shared UI

프로젝트의 특정 비즈니스 개념을 몰라도 사용할 수 있는 UI.

```text
shared/ui

Button
IconButton
Input
Textarea
Modal
Dropdown
Popover
Tabs
Badge
Tooltip
Spinner
Toast
EmptyState
Divider
Avatar
```

예:

```tsx
<Button variant="primary">
  저장
</Button>

<Button variant="danger">
  삭제
</Button>
```

---

## 11.2 Domain Component

Mindmap 비즈니스 의미를 가진 Component.

```text
features/mindmap

MindmapCard
MindmapCanvas
MindmapNode
MindmapEdge
MindmapToolbar
NodeDetailPanel
NodeDetailFullscreen
ExportModal
```

이 컴포넌트들은 `shared/ui`로 이동시키지 않음.

---

# 12. Frontend Folder 구조

Feature 기반 구조를 권장함.

```text
src/
├── app/
│   ├── router/
│   ├── providers/
│   ├── guards/
│   ├── layouts/
│   └── store/
│
├── features/
│
│   ├── auth/
│   │   ├── api/
│   │   │   └── auth.api.ts
│   │   │
│   │   ├── components/
│   │   │   ├── AuthForm.tsx
│   │   │   └── AuthTabs.tsx
│   │   │
│   │   ├── hooks/
│   │   │   └── useAuth.ts
│   │   │
│   │   ├── model/
│   │   │   └── auth.types.ts
│   │   │
│   │   ├── pages/
│   │   │   └── AuthPage.tsx
│   │   │
│   │   └── routes/
│   │
│   ├── mindmap/
│   │   ├── api/
│   │   │   ├── mindmap.api.ts
│   │   │   └── node.api.ts
│   │   │
│   │   ├── components/
│   │   │   ├── MindmapCanvas.tsx
│   │   │   ├── MindmapNode.tsx
│   │   │   ├── MindmapEdge.tsx
│   │   │   ├── MindmapToolbar.tsx
│   │   │   ├── NodeDetailPanel.tsx
│   │   │   ├── NodeDetailFullscreen.tsx
│   │   │   ├── DeleteConfirmModal.tsx
│   │   │   └── ExportModal.tsx
│   │   │
│   │   ├── hooks/
│   │   │   ├── useMindmap.ts
│   │   │   ├── useNode.ts
│   │   │   └── useAutosave.ts
│   │   │
│   │   ├── model/
│   │   │   ├── mindmap.types.ts
│   │   │   ├── mindmap.store.ts
│   │   │   └── node.types.ts
│   │   │
│   │   ├── pages/
│   │   │   ├── MindmapEditorPage.tsx
│   │   │   └── NodeDetailFullscreenPage.tsx
│   │   │
│   │   └── routes/
│   │
│   └── dashboard/
│       ├── api/
│       ├── components/
│       │   ├── MindmapCard.tsx
│       │   ├── MindmapList.tsx
│       │   └── DashboardEmptyState.tsx
│       ├── hooks/
│       ├── model/
│       └── pages/
│           └── DashboardPage.tsx
│
└── shared/
    ├── assets/
    ├── constants/
    ├── hooks/
    ├── lib/
    │   ├── api/
    │   └── query/
    ├── styles/
    ├── types/
    ├── ui/
    │   ├── button/
    │   ├── input/
    │   ├── modal/
    │   ├── dropdown/
    │   ├── tabs/
    │   ├── tooltip/
    │   └── toast/
    └── utils/
```

---

# 13. Dashboard Feature 분리 기준

Dashboard가 단순히 Mindmap 목록만 제공한다면 초기 MVP에서는 다음처럼 합칠 수도 있음.

```text
features/
└── mindmap/
    ├── dashboard/
    ├── editor/
    └── detail/
```

다만 이후 다음 기능이 추가될 가능성이 높음.

- 최근 열람
- Favorite
- Folder
- 공유
- 검색

따라서 확장성을 고려하면 다음 구성을 권장함.

```text
features/
├── auth/
├── dashboard/
└── mindmap/
```

---

# 14. 화면 명세서 초안

## S01 Auth

| 항목 | 내용 |
|---|---|
| URL | `/login` |
| 주요 Action | 로그인, 회원가입 |
| 성공 | `/` 이동 |
| 실패 | 오류 메시지 표시 |

---

## S02 Dashboard

| 항목 | 내용 |
|---|---|
| URL | `/` |
| 주요 데이터 | Mindmap List |
| 주요 Action | 생성, 열기, 수정, 삭제, Export |
| Empty | 생성 안내 |

---

## S03 Mindmap Editor

| 항목 | 내용 |
|---|---|
| URL | `/mindmaps/:mindmapId` |
| 주요 데이터 | Mindmap + Nodes |
| 주요 Action | Node CRUD, Drag, Collapse |
| 저장 | Autosave |

---

## S04 Node Detail

Page가 아닌 S03 내부 UI State로 관리함.

```text
/mindmaps/:mindmapId?node=:nodeId
```

URL Query 사용 여부는 구현 단계에서 선택 가능함.

---

## S05 Fullscreen Detail

예:

```text
/mindmaps/:mindmapId/nodes/:nodeId
```

또는 S03 내부 Overlay 상태로 관리할 수 있음.

MVP에서는 Overlay 방식이 단순함.

---

# 15. API 목록 초안

# Auth

## 회원가입

```http
POST /api/auth/signup
```

Request:

```json
{
  "email": "user@example.com",
  "password": "password"
}
```

---

## 로그인

```http
POST /api/auth/login
```

---

## 로그아웃

```http
POST /api/auth/logout
```

---

# Mindmap

## 목록

```http
GET /api/mindmaps
```

---

## 생성

```http
POST /api/mindmaps
```

Response 예:

```json
{
  "id": 1,
  "title": "새로운 마인드맵 3",
  "rootNodeId": 10
}
```

Mindmap 생성 API 내부에서 Root Node까지 함께 생성하는 방식을 권장함.

---

## 상세 조회

```http
GET /api/mindmaps/:mindmapId
```

---

## 제목 수정

```http
PATCH /api/mindmaps/:mindmapId
```

```json
{
  "title": "금융 공부"
}
```

---

## 삭제

```http
DELETE /api/mindmaps/:mindmapId
```

---

# Node

## Node 생성

```http
POST /api/mindmaps/:mindmapId/nodes
```

```json
{
  "parentNodeId": 10,
  "title": "새 노드",
  "x": 300,
  "y": 200
}
```

---

## Node 수정

```http
PATCH /api/nodes/:nodeId
```

예:

```json
{
  "title": "예금"
}
```

---

## 위치 저장

```http
PATCH /api/nodes/:nodeId/position
```

```json
{
  "x": 450,
  "y": 320
}
```

Node Update API와 통합할 수도 있음.

---

## Markdown 저장

```http
PATCH /api/nodes/:nodeId/content
```

```json
{
  "contentMd": "# 예금"
}
```

---

## Node 삭제

```http
DELETE /api/nodes/:nodeId
```

하위 Node까지 Cascade 삭제함.

---

## Collapse 상태

```http
PATCH /api/nodes/:nodeId/collapse
```

---

# Export

```http
POST /api/mindmaps/:mindmapId/export
```

```json
{
  "scope": "SUBTREE",
  "nodeId": 15,
  "format": "MARKDOWN"
}
```

Scope:

```text
ALL
NODE
SUBTREE
```

---

# 16. 상태관리 설계

상태를 크게 세 종류로 구분함.

```text
Server State
UI State
Editing State
```

---

## 16.1 Server State

서버의 데이터가 원본인 상태.

예:

- Mindmap 목록
- Mindmap 정보
- Node 정보
- Node Markdown

TanStack Query 등의 Server State Library 사용을 권장함.

```text
Mindmap Query
Node Query
Mutation
Cache
```

---

## 16.2 UI State

화면 동작만을 위한 상태.

예:

```text
selectedNodeId
detailPanelOpen
fullscreenMode
zoom
viewport
openMenuId
deleteModalOpen
exportModalOpen
```

이 상태는 Zustand 또는 React Local State로 관리 가능함.

---

## 16.3 Editing State

서버 저장 전 사용자가 변경 중인 데이터.

```text
editingNodeTitle
draftMarkdown
draggingPosition
saveStatus
```

특히 Markdown은 저장 실패 시에도 데이터가 유지되어야 하므로 Server State와 Editing State를 구분하는 것이 중요함.

---

# 17. 상태 구조 예시

```ts
interface MindmapUIState {
  selectedNodeId: string | null;

  detailPanelOpen: boolean;

  fullscreenNodeId: string | null;

  saveStatus:
    | 'idle'
    | 'dirty'
    | 'saving'
    | 'saved'
    | 'failed';

  viewport: {
    x: number;
    y: number;
    zoom: number;
  };
}
```

---

# 18. DB / Entity 초안

## User

```text
User
────────────────
id
email
password_hash
created_at
updated_at
```

---

## Mindmap

```text
Mindmap
────────────────
id
user_id
title
sequence_no
created_at
updated_at
```

`sequence_no`는 사용자별 `새로운 마인드맵 N`의 번호를 저장함.

생성 규칙:

```text
N = 현재 사용자가 보유한 Mindmap의 MAX(sequence_no) + 1
```

예외:

```text
Mindmap이 하나도 없으면 N = 1
```

권장 DB 제약:

```text
UNIQUE(user_id, sequence_no)
```

동일 사용자의 동시 생성 요청으로 같은 번호가 계산되는 경쟁 조건을 방지하기 위해 Mindmap 생성은 트랜잭션으로 처리하고, Unique 충돌 시 번호를 재계산하여 재시도하는 방식을 권장함.

---

## Node

```text
Node
────────────────
id
mindmap_id
parent_node_id
title
content_md

x
y

is_collapsed

created_at
updated_at
```

---

# 19. Entity 관계

```text
User
 │
 │ 1:N
 ▼
Mindmap
 │
 │ 1:N
 ▼
Node
 │
 │ 1:N
 └───────────► Node
```

Node 자기참조:

```text
Node
├── id = 1
│   parent_node_id = null
│
├── id = 2
│   parent_node_id = 1
│
└── id = 3
    parent_node_id = 2
```

Root Node:

```text
parent_node_id = NULL
```

---

# 20. 주요 DB 제약

## Mindmap

- `user_id` 필수
- `title` 빈 문자열 및 공백 문자열 금지
- `sequence_no` 양의 정수
- `(user_id, sequence_no)` Unique 권장

## Node

- `mindmap_id` 필수
- `title` 빈 문자열 및 공백 문자열 금지

Root:

```text
parent_node_id = null
```

일반 Node:

```text
parent_node_id != null
```

---

# 21. 보안 기준

모든 Mindmap API에서 다음 검증이 필요함.

```text
Request User
      ↓
Mindmap 조회
      ↓
mindmap.user_id 확인
      ↓
일치
→ 처리

불일치
→ 403 / 404
```

Node API에서도 반드시 해당 Node가 속한 Mindmap의 사용자 권한을 확인함.

URL의 ID만 알고 다른 사용자의 Mindmap이나 Node에 접근할 수 없어야 함.

---

# 22. 1,000 Node 대응 설계

목표:

> Mindmap 하나에 최대 1,000개의 Node 데이터를 관리할 수 있도록 설계함.

이는 **1,000개 Node를 동시에 화면에 렌더링한다는 의미는 아님.**

## 22.1 사용자 체감 성능 기준

- Editor 진입 시 최초 가시 Node 영역: **2초 이내 표시 목표**
- 네트워크 및 데이터 조회 포함: **최대 5초 이내 사용 가능한 화면 표시**
- 성능 측정은 1,000개 전체 동시 렌더링이 아니라 실제 초기 가시 영역을 기준으로 함.

## 22.2 Canvas Library

1순위 PoC 후보:

```text
React Flow (@xyflow/react)
```

우선 확인:

- Custom Node
- Node / Edge 렌더링
- Drag
- Pan / Zoom / Fit View
- Collapse / Expand
- 1,000 Node 데이터 환경에서의 초기 가시 영역 성능

## 22.3 단계적 최적화

기본 구현 후 실제 PoC 결과에 따라 순차 적용함.

1. Collapse / Expand로 표시 Node 수 제어
2. 필요한 영역 중심 로딩
3. viewport 기반 렌더링
4. Custom Node 불필요한 재렌더링 최소화
5. Node / Edge 상태 구독 범위 최소화

처음부터 별도의 Canvas/WebGL 엔진을 직접 구현하지 않고 React Flow 기반으로 검증한 뒤 필요한 최적화만 적용함.

---

# 23. 구현 순서 최종안

실제 개발 Task 기준으로는 다음 순서를 권장함.

## Step 1

```text
User
Auth
Route Guard
```

## Step 2

```text
Mindmap Entity
Node Entity
DB
```

## Step 3

```text
Dashboard
Mindmap List
Create Mindmap
```

## Step 4

```text
Mindmap Editor
Node Rendering
Edge Rendering
```

## Step 5

```text
Node Create
Node Edit
Node Delete
```

## Step 6

```text
Node Drag
Pan
Zoom
```

## Step 7

```text
Node Detail Panel
Markdown Editor
```

## Step 8

```text
Autosave
Save Status
Retry
```

## Step 9

```text
Collapse / Expand
```

## Step 10

```text
Delete Modal
Export Modal
Markdown Export
```

## Step 11

```text
React Flow PoC
1,000 Node 데이터 테스트
최초 가시 영역 2초 목표 검증
사용 가능 화면 5초 상한 검증
필요 시 Viewport 최적화
```

---

# 24. 산출물 작성 순서

현재 PRD와 본 설계안 이후에는 다음 순서로 구체화하는 것이 적절함.

```text
PRD
 ↓
화면 구성
 ↓
UI Design
 ↓
본 개발 설계안
 ↓
화면 명세서
 ↓
API 명세서
 ↓
DB ERD
 ↓
Frontend Component 설계
 ↓
개발 Task
```

특히 개발 시작 전에 최소한 다음 세 가지는 확정하는 것을 권장함.

### ① Canvas Library

1순위 후보:

```text
React Flow (@xyflow/react)
```

PoC 검토 대상:

- Node / Edge 구현 방식
- Custom Node
- Drag
- Zoom / Pan / Fit View
- Collapse / Expand
- 필요 시 Viewport Rendering
- 1,000 Node 데이터 환경
- 최초 가시 영역 2초 목표 / 사용 가능 화면 5초 상한

### ② Markdown Editor Library

검토 대상:

- Markdown 직접 입력
- Preview
- Split View
- Toolbar
- React 연동

### ③ Autosave 정책

확정:

```text
Node 제목       → Enter 시 즉시 저장
Node 위치       → Drag End 시 즉시 저장
Mindmap 제목    → 입력 확정 또는 Focus Out 시 저장
Markdown        → 마지막 입력 후 2초 debounce
```

추가 구현 검토:

```text
Retry 횟수
실패 상태 유지
동시 요청 처리 방식
페이지 이탈 직전 미저장 데이터 처리
```

---

# 25. MVP 개발의 핵심 기준

기능을 추가할지 고민될 경우 다음 질문으로 판단함.

> **“사용자가 자신의 지식을 마인드맵으로 만들고, 상세 내용을 작성하고, 다시 접속했을 때 이어서 사용할 수 있는 데 필요한 기능인가?”**

YES라면 MVP 우선 검토함.

NO라면 2차 기능으로 미루는 것을 기본 원칙으로 함.

따라서 현재 MVP에서 가장 중요한 영역은 다음임.

```text
1. Mindmap Editor

2. Node CRUD

3. Markdown Detail

4. Autosave

5. Data Persistence
```

검색, 공유, 폴더, AI 등의 기능은 이후 확장 가능함.

---

# 최종 요약

본 프로젝트의 MVP는 **7개의 주요 화면을 기반으로 하되, 실제 개발은 화면 단위가 아니라 `인증 → Mindmap → Node → Markdown → 저장 → Export`의 기능 의존 순서로 진행함.**

Frontend는 `auth / dashboard / mindmap` 중심의 Feature 구조를 사용하고, Button·Modal·Input 등 범용 요소만 `shared/ui`에서 관리함.

Server State와 UI State, Editing State를 분리하여 마인드맵 조작과 자동저장 과정의 복잡도를 낮추고, DB는 `User → Mindmap → Node`의 단순한 Tree 구조에서 시작함.

**MVP 성공의 핵심은 많은 기능을 넣는 것이 아니라, 마인드맵 구조 작성 → 상세 기록 → 2초 debounce 자동저장 → 재접속 → Markdown 내보내기라는 핵심 경험을 안정적으로 완성하는 것임.**

확정된 구현 기준:

- `새로운 마인드맵 N` = 현재 존재하는 최대 번호 + 1
- 상세 Markdown = 2초 debounce
- 최대 1,000 Node 데이터 관리
- 최초 가시 영역 = 2초 이내 목표
- 사용 가능한 화면 = 최대 5초
- Canvas = React Flow 1순위 PoC
- 2차 부모 변경 시 자기 자신/하위 Node 선택 금지 및 순환 구조 방지