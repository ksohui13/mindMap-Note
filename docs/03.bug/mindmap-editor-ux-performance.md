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
