import { afterEach, describe, expect, it, vi } from "vitest";

import {
  downloadMindmapExport,
  parseDownloadFilename,
} from "@/features/mindmap/lib/export-download";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("export download", () => {
  it("parses RFC 5987 filenames before ASCII fallback", () => {
    expect(parseDownloadFilename(
      "attachment; filename=\"mindmap-export.md\"; filename*=UTF-8''%ED%95%9C%EA%B8%80-all.md",
    )).toBe("한글-all.md");
    expect(parseDownloadFilename("attachment; filename=\"fallback.md\"")).toBe("fallback.md");
  });

  it("downloads the blob once and revokes its object URL", async () => {
    vi.useFakeTimers();
    const createObjectURL = vi.fn(() => "blob:test");
    const revokeObjectURL = vi.fn();
    vi.stubGlobal("URL", { ...URL, createObjectURL, revokeObjectURL });
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);
    const fetchMock = vi.fn().mockResolvedValue(new Response("# 문서\n", {
      headers: {
        "content-type": "text/markdown; charset=utf-8",
        "content-disposition": "attachment; filename*=UTF-8''%EB%AC%B8%EC%84%9C-all.md",
      },
    }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(downloadMindmapExport("map-a", { scope: "ALL", format: "MARKDOWN" }))
      .resolves.toEqual({ filename: "문서-all.md" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(click).toHaveBeenCalledTimes(1);
    expect(createObjectURL).toHaveBeenCalledOnce();
    await vi.runAllTimersAsync();
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:test");
  });
});
