import { beforeEach, describe, expect, it, vi } from "vitest";

import { createDraftJournalEntry, draftJournalKey, writeDraftJournal } from "@/features/mindmap/lib/draft-journal";
import { findUnresolvedExportDrafts } from "@/features/mindmap/lib/export-preflight";

beforeEach(() => {
  localStorage.clear();
  vi.unstubAllGlobals();
});

describe("export draft preflight", () => {
  it("removes journals equal to the server and reports only divergent target drafts", async () => {
    writeDraftJournal(localStorage, createDraftJournalEntry("map-a", "same", "saved", 0));
    writeDraftJournal(localStorage, createDraftJournalEntry("map-a", "different", "local", 0));
    writeDraftJournal(localStorage, createDraftJournalEntry("map-a", "outside", "outside", 0));
    vi.stubGlobal("fetch", vi.fn((input: RequestInfo | URL) => {
      const nodeId = String(input).split("/").at(-2);
      return Promise.resolve(new Response(JSON.stringify({
        node: {
          id: nodeId,
          title: nodeId === "different" ? "다른 초안" : "동일 초안",
          contentMd: nodeId === "same" ? "saved" : "server",
          revision: 1,
        },
      }), { headers: { "content-type": "application/json" } }));
    }));

    await expect(findUnresolvedExportDrafts({
      storage: localStorage,
      mindmapId: "map-a",
      nodeIds: new Set(["same", "different"]),
    })).resolves.toEqual([{ nodeId: "different", title: "다른 초안" }]);
    expect(localStorage.getItem(draftJournalKey("map-a", "same"))).toBeNull();
    expect(localStorage.getItem(draftJournalKey("map-a", "different"))).not.toBeNull();
    expect(localStorage.getItem(draftJournalKey("map-a", "outside"))).not.toBeNull();
  });
});
