import { describe, expect, it } from "vitest";

import { DomainError } from "@/server/domain/errors";
import {
  assertFinitePosition,
  normalizeEmail,
  normalizeTitle,
  normalizeTokenHash,
} from "@/server/domain/normalization";

describe("domain normalization", () => {
  it("normalizes email and title values", () => {
    expect(normalizeEmail("  User@Example.COM ")).toBe("user@example.com");
    expect(normalizeTitle("  금융 공부  ")).toBe("금융 공부");
  });

  it("rejects blank and overlong values", () => {
    expect(() => normalizeEmail("   ")).toThrow(DomainError);
    expect(() => normalizeTitle(" ".repeat(3))).toThrow(DomainError);
    expect(() => normalizeTitle("a".repeat(201))).toThrow(DomainError);
  });

  it("accepts only lowercase-normalized SHA-256 hashes", () => {
    expect(normalizeTokenHash("A".repeat(64))).toBe("a".repeat(64));
    expect(() => normalizeTokenHash("not-a-hash")).toThrow(DomainError);
  });

  it("rejects non-finite positions", () => {
    expect(() => assertFinitePosition(Number.POSITIVE_INFINITY, 0)).toThrow(
      DomainError,
    );
  });
});
