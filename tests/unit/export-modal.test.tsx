import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ExportModal } from "@/features/mindmap/components/export-modal";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function Harness({ withNode = true, prepareExport }: {
  withNode?: boolean;
  prepareExport?: () => Promise<{ ok: true } | { ok: false; message: string }>;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>내보내기 열기</button>
      <ExportModal
        open={open}
        mindmapId="map-a"
        mindmapTitle="테스트 맵"
        node={withNode ? { id: "node-a", title: "선택 노드" } : undefined}
        defaultScope={withNode ? "SUBTREE" : "ALL"}
        prepareExport={prepareExport}
        onOpenChange={setOpen}
      />
    </>
  );
}

describe("ExportModal", () => {
  it("uses context defaults, disables unavailable scopes, and restores focus", async () => {
    const { rerender } = render(<Harness withNode={false} />);
    const trigger = screen.getByRole("button", { name: "내보내기 열기" });
    trigger.focus();
    fireEvent.click(trigger);
    expect(await screen.findByRole("radio", { name: "전체 마인드맵" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "현재 노드만" })).toBeDisabled();
    expect(screen.getByRole("radio", { name: "현재 노드 + 모든 하위 개념" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "취소" })).toHaveFocus();
    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    await waitFor(() => expect(trigger).toHaveFocus());

    rerender(<Harness />);
  });

  it("blocks generation when preflight fails", async () => {
    const prepareExport = vi.fn().mockResolvedValue({ ok: false, message: "복구 초안을 처리해 주세요." });
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    render(<Harness prepareExport={prepareExport} />);
    fireEvent.click(screen.getByRole("button", { name: "내보내기 열기" }));
    expect(await screen.findByRole("radio", { name: "현재 노드 + 모든 하위 개념" })).toBeChecked();
    fireEvent.click(screen.getByRole("button", { name: "파일 생성" }));

    expect(await screen.findByText("복구 초안을 처리해 주세요.")).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
