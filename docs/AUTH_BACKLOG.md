# 인증 기능 Backlog

최종 갱신: 2026-08-29

이 문서는 OAuth 이후 남은 인증 기능을 지속적으로 추적하기 위한 작업 목록이다. 상태는 `TODO`, `IN_PROGRESS`, `BLOCKED`, `DONE` 중 하나로 관리하며, 완료 시 완료 조건과 검증 결과를 함께 갱신한다.

## 현재 단계와 진행 원칙

- 현재 판단: 기능 추가를 잠시 멈추고 1차 사용자 테스트를 진행한다.
- 내부 데모 기준: DB 기반 주요 기능과 실제 OAuth 연동 검증이 끝나면 1차 개발을 완료한다.
- 공개 배포 기준: 사용자 테스트 이후 `AUTH-01` 이메일 인증과 `AUTH-03` 비밀번호 재설정까지 구현한 뒤 공개한다.
- 새 기능보다 PostgreSQL integration·acceptance 및 실제 Provider 검증을 먼저 완료한다.

## 1차 개발 완료 조건

| ID | 검증 항목 | 상태 | 완료 조건 |
|---|---|---|---|
| VERIFY-01 | PostgreSQL migration 적용 | BLOCKED | DB 실행 후 `npm run db:migrate:deploy` 성공 |
| VERIFY-02 | DB integration test | BLOCKED | `npm run test:integration` 전체 통과 |
| VERIFY-03 | Acceptance test | BLOCKED | 전용 acceptance/test DB에서 `npm run test:acceptance` 전체 통과 |
| VERIFY-04 | 핵심 기능 사용자 테스트 | TODO | 아래 수동 테스트 체크리스트 완료 및 치명적 문제 없음 |
| VERIFY-05 | Google 실제 로그인 | BLOCKED | OAuth 키 발급 후 신규 가입·재로그인·취소·충돌 시나리오 통과 |

`test:acceptance`는 DB를 초기화하므로 일반 개발 DB가 아닌 전용 acceptance/test DB에서만 실행한다.

## 사용자 수동 테스트 체크리스트

- [ ] 이메일 회원가입 → 로그아웃 → 다시 로그인
- [ ] 마인드맵 생성·이름 변경·안전한 삭제
- [ ] 노드 생성·수정·이동·접기·펼치기
- [ ] Markdown 입력과 자동저장
- [ ] 새로고침 후 데이터 복원
- [ ] Markdown 내보내기
- [ ] 다른 계정의 마인드맵 URL 접근 차단
- [ ] Google 신규 가입·재로그인·로그인 취소
- [ ] 기존 이메일 계정과 동일한 OAuth 이메일의 자동 연결 차단

피드백은 `재현 순서 / 기대 결과 / 실제 결과 / 화면 캡처 / 브라우저·실행 환경` 형식으로 기록한다.

## 후속 인증 기능

| ID | 기능 | 우선순위 | 상태 | 의존성 | 완료 조건 |
|---|---|---:|---|---|---|
| AUTH-01 | 이메일 인증 | P0 | TODO | 메일 발송 서비스, 발신 도메인 | 신규 비밀번호 계정이 단일 사용·만료 토큰으로 이메일을 인증해야 활성화됨 |
| AUTH-02 | 인증 메일 재전송 | P0 | TODO | AUTH-01 | 응답 일반화, rate limit, 기존 토큰 폐기와 재발급이 검증됨 |
| AUTH-03 | 비밀번호 찾기·재설정 | P0 | TODO | 메일 발송 서비스 | 계정 노출 없는 요청, 단일 사용·만료 토큰, 기존 세션 폐기가 검증됨 |
| AUTH-04 | 비밀번호 확인 입력 | P1 | TODO | 없음 | 회원가입 UI와 서버 validation이 불일치 비밀번호를 거부함 |
| AUTH-05 | 가입 상태 모델 | P1 | TODO | AUTH-01 | `pending`·`active` 전이와 미활성 계정 로그인 차단 정책이 구현됨 |
| AUTH-06 | OAuth 계정 연결·해제 | P1 | TODO | 재인증 정책 | 로그인 사용자가 명시적으로 provider를 연결·해제하며 마지막 로그인 수단을 잃지 않음 |

## OAuth 운영 검증

| Provider | 구현 | 자동 검증 | 실제 Provider 검증 | 차단 사유 |
|---|---|---|---|---|
| Google | DONE | provider mock 기반 검증 | BLOCKED | Google OAuth client ID/secret 미발급 |

실제 키가 준비되면 `docs/OPERATOR_MANUAL.md`의 callback URI를 등록하고, 신규 가입·재로그인·동의 취소·이메일 충돌 시나리오를 확인한 뒤 `BLOCKED`를 `DONE`으로 변경한다.
