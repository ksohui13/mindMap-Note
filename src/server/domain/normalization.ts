import { DomainError } from "./errors";

const EMAIL_MAX_LENGTH = 320;
const TITLE_MAX_LENGTH = 200;
const SHA_256_HEX_PATTERN = /^[0-9a-f]{64}$/;

export function normalizeEmail(email: string): string {
  const normalized = email.trim().toLowerCase();

  if (normalized.length === 0 || normalized.length > EMAIL_MAX_LENGTH) {
    throw new DomainError("INVALID_INPUT", "Email must be between 1 and 320 characters.");
  }

  return normalized;
}

export function normalizeTitle(title: string): string {
  const normalized = title.trim();

  if (normalized.length === 0 || normalized.length > TITLE_MAX_LENGTH) {
    throw new DomainError("INVALID_INPUT", "Title must be between 1 and 200 characters.");
  }

  return normalized;
}

export function normalizeTokenHash(tokenHash: string): string {
  const normalized = tokenHash.trim().toLowerCase();

  if (!SHA_256_HEX_PATTERN.test(normalized)) {
    throw new DomainError("INVALID_INPUT", "Token hash must be a SHA-256 hex value.");
  }

  return normalized;
}

export function assertFinitePosition(x: number, y: number): void {
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    throw new DomainError("INVALID_INPUT", "Node coordinates must be finite numbers.");
  }
}
