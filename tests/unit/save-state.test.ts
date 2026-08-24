import { describe, expect, it } from "vitest";

import { ApiClientError } from "@/features/mindmap/api/client";
import {
  aggregateSaveRecords,
  isRetryableSaveError,
} from "@/features/mindmap/model/save-state";

describe("save state", () => {
  it("uses failed, saving, dirty, saved, idle priority", () => {
    expect(aggregateSaveRecords([
      { phase: "saved" },
      { phase: "dirty" },
      { phase: "saving" },
      { phase: "failed", error: "failed" },
    ])).toMatchObject({ phase: "failed" });
    expect(aggregateSaveRecords([{ phase: "idle" }, { phase: "saved" }])).toMatchObject({
      phase: "saved",
    });
    expect(aggregateSaveRecords([
      { phase: "failed", retryable: false },
      { phase: "failed", retryable: true },
    ])).toMatchObject({ phase: "failed", retryable: true });
  });

  it("only classifies network, timeout, rate limit and server failures as transient", () => {
    expect(isRetryableSaveError(new TypeError("network"))).toBe(true);
    expect(isRetryableSaveError(new ApiClientError("timeout", "TIMEOUT", 408))).toBe(true);
    expect(isRetryableSaveError(new ApiClientError("rate", "RATE_LIMIT", 429))).toBe(true);
    expect(isRetryableSaveError(new ApiClientError("server", "INTERNAL", 503))).toBe(true);
    expect(isRetryableSaveError(new ApiClientError("conflict", "CONFLICT", 409))).toBe(false);
    expect(isRetryableSaveError(new ApiClientError("invalid", "VALIDATION", 400))).toBe(false);
    expect(isRetryableSaveError(new ApiClientError("missing", "NOT_FOUND", 404))).toBe(false);
  });
});
