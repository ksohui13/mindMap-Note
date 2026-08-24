import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

import { DeleteConfirmModal } from "@/shared/ui/delete-confirm-modal";

function Harness({ pending = false }: { pending?: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>삭제 열기</button>
      <DeleteConfirmModal
        open={open}
        title="삭제 확인"
        description="영구 삭제됩니다."
        pending={pending}
        onOpenChange={setOpen}
        onConfirm={vi.fn()}
      />
    </>
  );
}

describe("DeleteConfirmModal", () => {
  it("focuses cancel first, closes with Escape, and restores trigger focus", async () => {
    render(<Harness />);
    const trigger = screen.getByRole("button", { name: "삭제 열기" });
    trigger.focus();
    fireEvent.click(trigger);

    const cancel = await screen.findByRole("button", { name: "취소" });
    await waitFor(() => expect(cancel).toHaveFocus());
    fireEvent.keyDown(document, { key: "Escape" });

    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
    await waitFor(() => expect(trigger).toHaveFocus());
  });

  it("blocks Escape and all actions while deletion is pending", async () => {
    render(<Harness pending />);
    fireEvent.click(screen.getByRole("button", { name: "삭제 열기" }));
    const dialog = await screen.findByRole("alertdialog");

    expect(screen.getByRole("button", { name: "취소" })).toBeDisabled();
    expect(screen.getByRole("button", { name: /삭제 중/ })).toBeDisabled();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(dialog).toBeInTheDocument();
  });
});
