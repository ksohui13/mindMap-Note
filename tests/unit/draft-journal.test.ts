import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  createDraftJournalEntry,
  draftJournalKey,
  listMindmapDraftJournals,
  readDraftJournal,
  removeDraftJournal,
  removeMindmapDraftJournals,
  writeDraftJournal,
} from "@/features/mindmap/lib/draft-journal";

describe("draft journal", () => {
  beforeEach(() => localStorage.clear());

  it("writes, reads, isolates and removes a draft", () => {
    const entry = createDraftJournalEntry(
      "map-a",
      "node-a",
      "# draft",
      3,
      new Date("2026-08-24T00:00:00.000Z"),
    );

    expect(writeDraftJournal(localStorage, entry)).toEqual({ ok: true });
    expect(readDraftJournal(localStorage, "map-a", "node-a")).toEqual(entry);
    expect(readDraftJournal(localStorage, "map-a", "node-b")).toBeNull();
    expect(readDraftJournal(localStorage, "map-b", "node-a")).toBeNull();

    removeDraftJournal(localStorage, "map-a", "node-a");
    expect(readDraftJournal(localStorage, "map-a", "node-a")).toBeNull();
  });

  it("ignores and removes a corrupted record", () => {
    const key = draftJournalKey("map-a", "node-a");
    localStorage.setItem(key, "{broken");

    expect(readDraftJournal(localStorage, "map-a", "node-a")).toBeNull();
    expect(localStorage.getItem(key)).toBeNull();
  });

  it("does not throw when storage is unavailable or quota is exceeded", () => {
    const entry = createDraftJournalEntry("map-a", "node-a", "draft", 0);
    const unavailable = {
      getItem: vi.fn(() => { throw new Error("blocked"); }),
      setItem: vi.fn(() => { throw new DOMException("full", "QuotaExceededError"); }),
      removeItem: vi.fn(() => { throw new Error("blocked"); }),
    };

    expect(writeDraftJournal(unavailable, entry)).toEqual({
      ok: false,
      error: "로컬 초안 보호에 실패했습니다.",
    });
    expect(readDraftJournal(unavailable, "map-a", "node-a")).toBeNull();
    expect(() => removeDraftJournal(unavailable, "map-a", "node-a")).not.toThrow();
    expect(writeDraftJournal(null, entry).ok).toBe(false);
  });

  it("removes only journals belonging to a deleted mindmap", () => {
    writeDraftJournal(localStorage, createDraftJournalEntry("map-a", "node-a", "a", 0));
    writeDraftJournal(localStorage, createDraftJournalEntry("map-a", "node-b", "b", 0));
    writeDraftJournal(localStorage, createDraftJournalEntry("map-b", "node-a", "keep", 0));
    localStorage.setItem("unrelated", "keep");

    removeMindmapDraftJournals(localStorage, "map-a");

    expect(readDraftJournal(localStorage, "map-a", "node-a")).toBeNull();
    expect(readDraftJournal(localStorage, "map-a", "node-b")).toBeNull();
    expect(readDraftJournal(localStorage, "map-b", "node-a")?.contentMd).toBe("keep");
    expect(localStorage.getItem("unrelated")).toBe("keep");
  });

  it("lists only valid journals belonging to one mindmap", () => {
    writeDraftJournal(localStorage, createDraftJournalEntry("map-a", "node-a", "a", 0));
    writeDraftJournal(localStorage, createDraftJournalEntry("map-a", "node-b", "b", 1));
    writeDraftJournal(localStorage, createDraftJournalEntry("map-b", "node-a", "other", 0));

    expect(listMindmapDraftJournals(localStorage, "map-a").map((entry) => entry.nodeId)).toEqual([
      "node-a",
      "node-b",
    ]);
  });
});
