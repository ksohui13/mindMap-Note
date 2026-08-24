import { describe, expect, it } from "vitest";

import {
  assertDistinctDatabases,
  validateDedicatedDatabase,
} from "../../scripts/acceptance/database-safety";

describe("acceptance database safety", () => {
  it("allows the exact confirmed remote dedicated database", () => {
    expect(validateDedicatedDatabase({
      url: "postgresql://user:secret@db.example.test:5432/mindmap_test?sslmode=require",
      expectedDatabase: "mindmap_test",
      confirmation: "mindmap_test",
    })).toMatchObject({ databaseName: "mindmap_test", hostname: "db.example.test", isLocal: false });
  });

  it("refuses system, unexpected, and unconfirmed databases", () => {
    expect(() => validateDedicatedDatabase({
      url: "postgresql://user:secret@db.example.test/postgres",
      expectedDatabase: "mindmap_test",
      confirmation: "mindmap_test",
    })).toThrow(/unsafe database/);
    expect(() => validateDedicatedDatabase({
      url: "postgresql://user:secret@db.example.test/production",
      expectedDatabase: "mindmap_test",
      confirmation: "mindmap_test",
    })).toThrow(/Expected dedicated database/);
    expect(() => validateDedicatedDatabase({
      url: "postgresql://user:secret@db.example.test/mindmap_test",
      expectedDatabase: "mindmap_test",
      confirmation: undefined,
    })).toThrow(/reset confirmation/);
  });

  it("keeps the existing localhost mindmap_test workflow and rejects identical databases", () => {
    expect(validateDedicatedDatabase({
      url: "postgresql://mindmap:mindmap@localhost:5432/mindmap_test",
      expectedDatabase: "mindmap_test",
      confirmation: undefined,
      allowLocalWithoutConfirmation: true,
    }).isLocal).toBe(true);
    expect(() => assertDistinctDatabases(
      "postgresql://first:secret@db.example.test/mindmap_test?schema=one",
      "postgresql://second:secret@db.example.test/mindmap_test?schema=two",
    )).toThrow(/must be different/);
  });
});
