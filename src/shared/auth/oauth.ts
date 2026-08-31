export const OAUTH_PROVIDERS = ["google"] as const;
export type OAuthProvider = (typeof OAUTH_PROVIDERS)[number];

const OAUTH_ERROR_MESSAGES: Readonly<Record<string, string>> = {
  OAUTH_ACCOUNT_CONFLICT:
    "같은 이메일의 기존 계정이 있습니다. 기존 로그인 방식을 이용해 주세요.",
  OAUTH_EMAIL_REQUIRED:
    "소셜 계정에서 인증된 이메일을 확인할 수 없습니다.",
  OAUTH_NOT_CONFIGURED:
    "요청한 소셜 로그인이 아직 설정되지 않았습니다.",
  OAUTH_PROVIDER_REJECTED:
    "소셜 로그인이 취소되었거나 완료되지 않았습니다.",
  OAUTH_STATE_INVALID:
    "로그인 요청이 만료되었거나 올바르지 않습니다. 다시 시도해 주세요.",
};

export function getOAuthErrorMessage(code: string | undefined): string | undefined {
  return code ? OAUTH_ERROR_MESSAGES[code] : undefined;
}
