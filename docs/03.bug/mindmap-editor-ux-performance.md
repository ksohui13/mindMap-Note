# Mindmap 편집 UX·성능 버그

- 작성일: 2026-08-31
- 상태: 구현 완료 / 실브라우저 인수 검증 대기
- 대상: Dashboard, Mindmap 상세 편집기, Node 상세 패널

## 한눈에 보기

- 새 마인드맵 생성과 상세 진입이 서버 응답에 묶여 즉각적인 전환 피드백이 부족하다.
- 노드 제목 입력 상태가 전체 편집기에 있어 글자 입력마다 전체 React Flow 데이터가 다시 만들어진다.
- 제목 입력창은 포커스를 잃으면 저장이 아니라 취소되어 작성한 글자가 원래 값으로 돌아간다.
- 노드 생성·저장 중 전역 상호작용 잠금과 원격 PostgreSQL 왕복이 겹쳐 캔버스 전체가 멈춘 것처럼 보인다.
- 상세 저장, 패널 크기 조절, 메뉴 레이어, 마인드맵 제목 수정·삭제 UX가 부족하다.

## 재현 항목과 현재 원인

| ID | 재현 절차 | 실제 동작 | 확인된 원인 |
|---|---|---|---|
| BUG-01 | Dashboard에서 `새 마인드맵` 클릭 | 생성 API가 끝날 때까지 Dashboard에 머묾 | 서버가 ID를 만든 뒤 `router.push`를 호출함 |
| BUG-02 | 기존 마인드맵 상세 진입 | 첫 진입 또는 원격 DB 환경에서 지연 | 동적 route compile, 세션 조회와 상세 조회의 순차 DB 왕복 |
| BUG-03 | 루트 제목을 입력하고 바깥 클릭 | 입력한 제목이 원래 값으로 돌아감 | `onBlur`가 저장이 아닌 `cancelEdit` 호출 |
| BUG-04 | Node 상세 Markdown 작성 | 즉시 저장 버튼이 없음 | 2초 debounce 자동 저장과 실패 재시도만 제공 |
| BUG-05 | Node 상세 패널 너비 변경 시도 | 고정 너비라 변경 불가 | `sm:w-[26rem]` 고정 스타일 |
| BUG-06 | 노드 `...` 메뉴를 열고 바깥 클릭/다른 노드와 겹침 | 자동으로 닫히지 않거나 다른 노드 뒤에 표시 | native `details`와 React Flow stacking context 내부 렌더링 |
| BUG-07 | 하위 노드 생성·제목 연속 입력 | 생성 대기와 편집 렉, 제목 저장 실패처럼 보임 | 서버 성공 후 노드 표시, 전역 pending 잠금, 전체 flow 재생성 |
| BUG-08 | 상세 헤더의 마인드맵 제목 확인 | 제목 수정·전체 삭제 진입점 없음 | 헤더가 읽기 전용 `h1`만 렌더링 |

## AS-IS → TO-BE

| 구분 | AS-IS | TO-BE |
|---|---|---|
| 새 마인드맵 | 서버 생성 완료 후 상세 이동 | 클라이언트 UUID로 상세 URL에 즉시 이동하고 idempotent 생성 |
| 상세 진입 | 세션과 상세를 순차 조회 | 소유권을 포함한 단일 조회와 route loading/prefetch 적용 |
| 제목 편집 | 상위 controlled draft, blur 취소 | 노드 내부 draft, blur/Enter 저장, Escape 취소 |
| 하위 노드 | 서버 성공 후 표시, 전체 잠금 | 즉시 optimistic 표시, 해당 노드만 pending 처리 |
| 상세 저장 | 2초 자동 저장만 제공 | 자동 저장 유지 + 즉시 저장 버튼 |
| 상세 패널 | 416px 고정 | 데스크톱 320~720px drag resize |
| 노드 메뉴 | node 내부 `details` | Portal dropdown, 외부 클릭·Escape 닫기 |
| 상세 헤더 | 제목 표시만 제공 | 마인드맵 이름 변경·삭제 제공 |

## 완료 기준

- 새 마인드맵 클릭 후 100ms 안에 상세 route loading 또는 상세 화면이 표시된다.
- 노드 제목을 한글로 연속 입력하고 바깥을 클릭해도 글자가 유실되지 않으며 새로고침 후 유지된다.
- 하위 노드 클릭 후 100ms 안에 임시 노드가 보이고 다른 노드는 계속 조작할 수 있다.
- Markdown은 자동 저장과 `저장` 버튼 모두로 저장되며 중복 요청을 만들지 않는다.
- 상세 패널은 데스크톱에서 320~720px 범위로 조절되고 모바일에서는 전체 너비다.
- 노드 메뉴는 다른 노드에 가려지지 않고 바깥 클릭·Escape로 닫힌다.
- 상세 헤더에서 마인드맵 제목 수정과 전체 삭제가 가능하다.
- warm production 상세 진입의 첫 노드 표시와 조작 가능 시점이 각각 2초 이내다.
- Chromium에서 위 재현 절차가 모두 통과하기 전에는 완료 상태로 변경하지 않는다.

## 구현 및 검증 결과

### 적용 내용

- Dashboard에서 `crypto.randomUUID()`로 마인드맵·루트 ID를 만든 뒤 생성 API를 기다리지 않고 생성 전용 상세 URL로 이동한다.
- 생성 화면은 같은 ID로 POST를 재시도하고, 성공 응답의 detail DTO로 편집기를 즉시 확정한다.
- 마인드맵과 노드 생성 API는 클라이언트 ID를 받으며 같은 소유 관계의 재요청은 기존 데이터를 반환한다. 다른 소유자·부모 관계의 ID 재사용은 `CONFLICT`로 차단한다.
- 기존 카드 진입은 Next `Link` prefetch를 사용하고, 일반 상세 진입은 세션·사용자·소유 마인드맵·노드를 Prisma 한 번의 조회로 가져온다. 만료 세션 정리는 예외적으로 추가 쓰기 쿼리를 사용한다.
- 제목 draft를 각 `MindmapNode`의 비제어 input으로 옮겼다. blur/Enter 저장, Escape 취소, IME 조합 Enter 무시, 실패 draft 유지와 재시도를 적용했다.
- 저장·생성 상태를 node ID별 Set으로 분리했다. 하위 노드는 클라이언트 UUID로 즉시 캐시에 추가하고 생성 완료 전 입력한 제목은 생성 Promise 뒤에 순서대로 저장한다.
- React Flow 입력 데이터를 memoization하고 Markdown draft 변경 시 캔버스 props가 불필요하게 바뀌지 않도록 mutation/autosave callback 참조를 안정화했다.
- 상세 패널에 수동 `저장` 버튼과 320~720px resize handle(키보드 지원)을 추가했고, 모바일은 전체 너비를 유지한다.
- 노드 메뉴를 Radix Portal dropdown으로 교체해 외부 클릭·Escape 닫기, focus 복귀, collision 배치, 최상위 z-index를 적용했다.
- 상세 헤더에 마인드맵 제목 수정과 node count 확인 기반 전체 삭제를 추가했다. 삭제 성공 시 Dashboard로 `replace`한다.
- Prisma schema와 migration은 변경하지 않았다. 기존 UUID PK를 그대로 사용한다.

### 주요 변경 파일

- `src/features/dashboard/components/dashboard-screen.tsx`: 즉시 생성 route 이동, 카드 prefetch
- `src/features/mindmap/components/mindmap-creation-page.tsx`: 생성/loading/실패 재시도 화면
- `src/features/mindmap/components/mindmap-editor.tsx`: optimistic 노드, 노드별 저장 상태, 헤더 수정·삭제, canvas memoization
- `src/features/mindmap/components/mindmap-node.tsx`: 로컬 제목 draft와 Portal dropdown
- `src/features/mindmap/components/node-detail.tsx`: 수동 저장과 패널 resize
- `src/app/api/mindmaps/route.ts`, `src/server/domain/mindmap.service.ts`: idempotent 마인드맵 생성
- `src/server/domain/node.service.ts`: idempotent 하위 노드 생성
- `src/server/domain/session.repository.ts`, `src/server/auth/session.ts`, `src/app/mindmaps/[mindmapId]/page.tsx`: 세션·소유 상세 단일 조회
- `tests/unit/*`, `tests/integration/*`: 변경 계약과 편집 UX 회귀 테스트

### 검증 결과

- `npm run typecheck`: 통과
- 변경 파일 ESLint 및 `npm run lint`: 통과
- `npm test`: 40개 파일, 150개 테스트 통과
- `npm run build`: Next.js 16.3.1 production build 통과
- `npm run test:integration`: 미완료. 테스트용 PostgreSQL `localhost:5432`가 실행 중이지 않아 DB setup에서 `ECONNREFUSED` 발생
- production Chromium 재현 테스트: 미완료. 현재 실행 환경에서 연결 가능한 Browser/Chromium 인스턴스가 없어 브라우저 선택 단계에서 중단

### 현재 완료 판정

코드 구현과 정적·단위 검증은 완료했지만, 이 문서의 완료 기준은 Chromium 재현 통과다. 따라서 PostgreSQL과 Chromium을 사용할 수 있는 환경에서 기존 8개 재현 절차 및 100ms/2초 성능 기준을 확인하기 전까지 최종 완료로 판정하지 않는다.

---

## 추가 발견: 상세 패널 오픈 조건과 신규 노드 겹침

- 발견일: 2026-08-31
- 상태: 코드 구현 완료 · PostgreSQL/production Chromium 인수 검증 대기

### BUG-09. 제목을 수정하려고 하면 상세 화면이 전체화면처럼 열림

#### 재현

1. 마인드맵 노드 제목을 클릭하거나 더블클릭한다.
2. 제목 편집과 함께 노드 상세 화면이 열린다.
3. 브라우저 콘텐츠 폭이 640px 미만이면 상세 패널이 캔버스 전체를 덮는다.

#### 코드 기반 원인

실제 `NodeDetailFullscreen`을 여는 상태 변경은 상세 패널의 `전체 보기` 버튼에만 연결되어 있다. 노드 제목 클릭이 `setDetailFullscreenOpen(true)`를 직접 호출하는 경로는 없다.

문제는 서로 다른 두 동작이 결합되어 발생한다.

1. `MindmapNode`의 `onDoubleClick`은 제목 편집을 시작하지만, 더블클릭 전에 발생하는 일반 click 이벤트는 React Flow까지 전달된다.
2. React Flow의 `onNodeClick`은 단순 선택이 아니라 `openNodeDetail()`을 호출한다. 따라서 제목 편집을 위한 더블클릭도 상세 패널을 함께 연다.
3. `NodeDetailPanel`은 `sm` 미만에서 `w-full`이다. 노트북 브라우저의 실제 콘텐츠 영역이 640px보다 작거나 개발 도구·앱 사이드 패널로 좁아지면 사이드바가 화면 전체를 차지한다.
4. 데스크톱 기본 너비도 416px로 고정되어 있어 중간 크기 viewport에서는 캔버스보다 패널 비중이 과도하게 크다.

즉, 사용자가 본 화면은 fullscreen component가 아니라, 전체 너비로 렌더링된 sidebar일 가능성이 높다.

#### AS-IS → TO-BE

| 구분 | AS-IS | TO-BE |
|---|---|---|
| 노드 일반 클릭 | 노드 선택과 상세 패널 열기를 동시에 수행 | 노드 선택만 수행 |
| 제목 더블클릭 | 제목 편집 전에 click이 전파되어 패널도 열림 | 제목 편집만 시작하고 패널 상태는 유지 |
| 상세 진입 | 노드 어디를 클릭해도 열림 | 노드의 `상세` 버튼으로만 열림 |
| 전체 보기 | 패널 내부 버튼으로 열림 | 현재처럼 명시적인 `전체 보기` 클릭으로만 열림 |
| 패널 기본 너비 | 416px, 640px 미만에서 `w-full` | 기본 360px, 항상 우측 sidebar 형태, viewport 여유 폭 내에서 제한 |
| 패널 최대 너비 | 최대 720px | `min(560px, viewport의 45~50%)` 수준으로 제한 |

#### 추천 설계

- React Flow의 `onNodeClick`에서는 `selectedNodeId`만 변경한다.
- `openNodeDetail()`은 노드 내부의 명시적인 `상세` 버튼에서만 호출한다.
- 제목 영역의 double click은 편집만 시작하고 click/double click 전파를 모두 차단한다.
- `detailFullscreenOpen`은 `전체 보기` 버튼 외의 경로에서는 `true`로 바꾸지 않는다.
- 패널 너비는 기본 360px로 낮추고 `min(22.5rem, calc(100vw - 1rem))` 같은 방식으로 viewport에 맞춘다.
- resize 최대값도 720px 고정 대신 viewport 비율을 함께 적용한다. 모바일에서도 fullscreen component로 자동 전환하지 않고, 거의 전체 폭인 우측 panel로 유지한다.

### BUG-10. 여러 노드를 만들면 처음부터 서로 겹침

#### 재현

1. 같은 부모에서 하위 노드를 빠르게 여러 번 생성한다.
2. 또는 서로 다른 부모에서 같은 깊이의 하위 노드를 생성한다.
3. 새 노드의 영역이 기존 노드와 일부 또는 전부 겹친다.

#### 코드 기반 원인

현재 `calculateChildPosition()`은 아래 조건만 검사한다.

- 후보 x는 항상 `parent.x + 240`이다.
- y는 부모를 기준으로 `0, +96, -96, +192, -192...` 순서다.
- 충돌 대상은 `parentNodeId`가 같은 형제 노드뿐이다.
- 충돌 판단은 두 노드의 x/y 좌표가 거의 완전히 같은지만 확인한다.

이 방식에는 다음 한계가 있다.

- 노드 실제 너비·높이를 고려하지 않아 좌표가 달라도 시각 영역이 겹칠 수 있다.
- 다른 부모의 자식과는 충돌 검사를 하지 않아 서로 다른 branch가 같은 공간을 사용할 수 있다.
- 사용자가 드래그해 옮긴 기존 노드도 형제가 아니면 장애물로 취급하지 않는다.
- 빠른 연속 생성에서는 `addChild()`가 render 시점의 `effectiveNodes` closure를 사용한다. 첫 optimistic 노드를 query cache에 넣은 직후 다음 click이 render보다 먼저 들어오면 동일한 과거 노드 목록으로 같은 좌표를 다시 계산할 수 있다.
- 노드에 오류·저장 상태 UI가 붙어 높이가 커지면 고정 96px 간격으로는 더 쉽게 겹친다.

#### AS-IS → TO-BE

| 구분 | AS-IS | TO-BE |
|---|---|---|
| 배치 기준 | 같은 부모의 형제 좌표 | 현재 표시된 모든 노드의 사각 영역 |
| 충돌 판정 | x/y가 동일한지 확인 | 노드 폭·높이와 여백을 포함한 rectangle intersection |
| 연속 생성 | render closure의 노드 목록 사용 | query cache의 최신 optimistic 노드와 동기식 예약 좌표 사용 |
| 다른 branch | 충돌 검사 제외 | 동일 canvas의 모든 visible node를 장애물로 검사 |
| 사용자 drag | 후속 자동 배치에서 사실상 무시 | 이동된 최신 좌표도 충돌 검사에 포함 |
| 전체 재배치 | 없음 | 유지. 사용자 배치를 임의로 다시 움직이지 않음 |

#### 추천 설계

전체 트리를 자동 재정렬하는 dagre/ELK 방식은 기존에 사용자가 드래그한 위치까지 바꿀 수 있어 이번 문제의 기본 해법으로는 사용하지 않는다. 신규 노드 한 개의 위치만 결정하는 local collision search를 추천한다.

1. 배치 직전에 `queryClient.getQueryData()`로 최신 detail을 읽고 position override를 적용한다.
2. 아직 React Query render에 반영되지 않은 좌표는 `placementReservations` ref에 즉시 예약한다.
3. 기본 후보는 부모 오른쪽에서 시작하되, 충분한 세로 간격으로 위·아래 slot을 탐색한다.
4. 각 후보를 노드 예상 크기와 안전 여백을 포함한 사각형으로 만든다.
5. 형제뿐 아니라 현재 canvas의 모든 노드 및 예약 사각형과 교차하지 않는 첫 후보를 선택한다.
6. 생성 성공 시 예약을 실제 노드 좌표로 대체하고, 실패·임시 노드 제거 시 예약을 해제한다.
7. 사용자가 드래그한 좌표는 그대로 유지하며 이후 생성되는 노드만 그 영역을 피한다.

초기 상수 추천값은 실제 노드 CSS를 기준으로 테스트에서 확정한다.

```text
예상 노드 폭: 256px
예상 노드 최소 높이: 112~128px
가로 안전 간격: 48~64px
세로 안전 간격: 32~48px
후보 탐색: parent y, +step, -step, +2step, -2step ...
```

노드 높이가 상태 UI에 따라 변할 수 있으므로 1차 구현은 보수적인 최대 예상 높이를 사용한다. 이후 필요하면 React Flow의 measured width/height를 배치 함수에 전달하는 방식으로 정밀도를 높인다.

### 수정 대상 파일

- `src/features/mindmap/components/mindmap-editor.tsx`
  - 노드 선택과 상세 열기 동작 분리
  - 최신 query cache 및 placement reservation 기반 생성 좌표 계산
  - fullscreen 상태 전환 경로 제한
- `src/features/mindmap/components/mindmap-node.tsx`
  - 제목 편집 click/double click 전파 차단
  - 상세 버튼만 `onOpenDetail` 호출
- `src/features/mindmap/components/node-detail.tsx`
  - 기본·최대 panel 너비 축소
  - 좁은 viewport에서도 sidebar와 fullscreen의 의미 분리
- `src/features/mindmap/model/node-position.ts`
  - 전체 노드 rectangle 충돌 검사와 후보 탐색 구현
  - 예약 좌표를 함께 검사할 수 있는 입력 타입 추가
- `tests/unit/mindmap-editor.test.tsx`
  - 제목 편집 시 패널이 열리지 않는지 검증
  - 상세 버튼과 전체 보기 버튼의 단계별 전환 검증
- `tests/unit/node-position.test.ts`
  - 다른 부모, 부분 겹침, 드래그 좌표, 연속 예약 좌표 회피 검증

### 완료 기준

- 노드 제목 클릭·더블클릭으로 상세 패널이나 fullscreen이 새로 열리지 않는다.
- 상세 패널은 `상세` 버튼으로만 열리고 `전체 보기` 전까지 우측 sidebar를 유지한다.
- 패널 기본 너비가 캔버스의 절반 이상을 과도하게 차지하지 않는다.
- 같은 부모에서 빠르게 10개를 연속 생성해도 신규 노드 영역이 겹치지 않는다.
- 서로 다른 부모의 하위 노드 및 사용자가 이동한 노드와도 신규 노드가 겹치지 않는다.
- 기존 노드의 사용자 지정 위치는 신규 노드 생성 때문에 자동으로 변경되지 않는다.
- 위 시나리오를 단위 테스트와 Chromium 실제 화면에서 모두 확인한다.

## 2026-08-31 구현 결과

### BUG-09 상세 패널 오픈 조건

- React Flow의 일반 노드 click은 선택만 변경하고 상세 패널을 열지 않도록 분리했다.
- 제목 영역의 click/double click 전파를 차단해 더블클릭은 제목 편집만 시작한다.
- 상세 패널은 노드의 `상세` 버튼으로만 열리고, fullscreen은 패널의 `전체화면` 버튼으로만 열린다.
- 패널 기본 너비를 360px로 변경했다.
- viewport 기준 동적 범위를 적용했다.
  - 최소: `min(320px, viewport - 16px)`
  - 최대: `max(최소값, min(560px, viewport * 0.5))`
- 좁은 화면의 `w-full` 자동 전환을 제거해 기본 표현을 우측 sidebar로 유지했다.
- drag와 키보드 resize 및 동적 `aria-valuemin`, `aria-valuemax`, `aria-valuenow`를 유지했다.

### BUG-10 신규 생성 및 펼침 배치

- 예상 노드 영역 256x160px, 가로 여백 64px, 세로 여백 40px을 기준으로 사각형 충돌을 검사한다.
- 부모 오른쪽에서 `y`, `+step`, `-step`, `+2step`, `-2step` 순서로 모든 visible node와 예약 좌표를 피하는 첫 위치를 선택한다.
- `addChild()`는 render closure 대신 React Query의 최신 detail과 position/collapse override를 읽는다.
- API 요청 전에 ref에 좌표를 동기 예약해 같은 부모에서 10회 연속 생성해도 같은 영역을 재사용하지 않는다.
- 생성 성공 시 예약을 해제하고 실제 서버 노드로 교체한다. 생성 실패는 예약과 입력을 유지해 같은 좌표로 재시도하며, 임시 노드 제거 시 예약도 제거한다.
- 펼치기 전후 visible ID를 비교하고 새로 보이는 노드만 부모 우선으로 배치한다.
- 기존 visible node와 사용자가 드래그한 위치는 고정 장애물로 유지하며, 내부적으로 접힌 descendant는 실제로 펼쳐질 때까지 제외한다.
- 자동 배치 좌표는 optimistic 반영 후 batch API로 저장한다. 실패하면 로컬 좌표를 유지한 채 전체 배치를 재시도하거나 서버 좌표로 복원할 수 있다.

### Batch position API

- `PATCH /api/mindmaps/[mindmapId]/nodes/positions`를 추가했다.
- 요청은 `{ nodes: [{ id, x, y, revision }] }`이며 ID 중복, 좌표, revision을 API 경계에서 검증한다.
- 소유 마인드맵을 잠근 뒤 대상 노드와 모든 revision을 먼저 검증한다.
- 하나의 Serializable transaction에서 모든 좌표와 revision을 갱신하고 mindmap timestamp는 한 번만 갱신한다.
- 노드 누락·타 사용자/타 마인드맵은 `404`, revision 또는 transaction 충돌은 `409`이며 하나라도 실패하면 전체 transaction이 rollback된다.
- Prisma schema와 migration은 변경하지 않았다.

## 검증 결과

### 통과

- `npm run typecheck`: 통과
- `npm run lint`: 오류·경고 없이 통과
- `npm test`: 41개 파일, 159개 테스트 통과
- BUG-09 component test: 노드 click과 제목 double click으로 sidebar/fullscreen이 열리지 않고 `상세` 버튼에서만 sidebar가 열리는 것을 확인
- sidebar bounds test: 375px, 640px, 1440px viewport의 동적 최소·최대값 확인
- BUG-10 component/model test: 같은 부모 10회 연속 생성 예약, 전체 visible obstacle 충돌 회피, 펼침 시 신규 visible node만 이동 확인
- batch route unit test: 정상 응답과 중복 ID 거부 확인
- `npm run build`: Next.js 16.3.1 production build 통과, batch route 포함 확인
- `npx playwright test --list`: Chromium E2E 9개 시나리오 수집 통과

### 실행 불가 / 미검증

- `npm run test:integration`: `localhost:5432`의 test PostgreSQL이 실행 중이지 않아 IPv4/IPv6 `ECONNREFUSED`
- Docker Compose: Docker engine이 실행 중이지 않아 PostgreSQL 컨테이너를 시작할 수 없음
- batch transaction의 실제 PostgreSQL 원자 갱신·revision rollback·소유권 격리 테스트: 테스트 코드는 추가했으나 DB 부재로 미실행
- production Chromium BUG-01~10 재현: 연결 가능한 인앱 브라우저가 없어 미실행
- 100ms 생성 반응, warm 상세 진입 2초, 실제 DOM bounding box 비충돌: E2E assertion은 추가했으나 production Chromium에서 미실행

## 현재 완료 판정

코드 구현, 정적 검사, 전체 단위 회귀, production build는 통과했다. 그러나 요청된 완료 조건은 실제 PostgreSQL 통합 검증과 production Chromium에서 BUG-01~10 및 기존 편집 기능을 재현했을 때 모두 정상인 것이다. 현재 두 실행 환경이 없어 해당 검증을 수행하지 못했으므로 **최종 상태는 완료가 아니라 인수 검증 대기**다.
