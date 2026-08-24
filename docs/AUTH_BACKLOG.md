# 인증 기능 Backlog

최종 갱신: 2026-08-24

이 문서는 OAuth 이후 남은 인증 기능을 지속적으로 추적하기 위한 작업 목록이다. 상태는 `TODO`, `IN_PROGRESS`, `BLOCKED`, `DONE` 중 하나로 관리하며, 완료 시 완료 조건과 검증 결과를 함께 갱신한다.

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
| Kakao | DONE | provider mock 기반 검증 | BLOCKED | Kakao REST API key/client secret 미발급 |

실제 키가 준비되면 `docs/OPERATOR_MANUAL.md`의 callback URI를 등록하고, 신규 가입·재로그인·동의 취소·이메일 충돌·Kakao 이메일 미동의 시나리오를 확인한 뒤 `BLOCKED`를 `DONE`으로 변경한다.
