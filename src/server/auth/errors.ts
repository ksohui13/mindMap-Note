export type AuthErrorCode =
  | "EMAIL_ALREADY_EXISTS"
  | "INVALID_CREDENTIALS"
  | "OAUTH_ACCOUNT_CONFLICT"
  | "OAUTH_EMAIL_REQUIRED"
  | "OAUTH_NOT_CONFIGURED"
  | "OAUTH_PROVIDER_REJECTED"
  | "OAUTH_STATE_INVALID"
  | "UNAUTHORIZED";

export class AuthError extends Error {
  constructor(
    public readonly code: AuthErrorCode,
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = "AuthError";
  }
}
