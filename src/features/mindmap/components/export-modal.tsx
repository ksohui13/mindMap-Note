"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { useRef, useState } from "react";

import type { ExportMindmapInput, ExportScope } from "@/features/mindmap/api/contracts";
import { downloadMindmapExport } from "@/features/mindmap/lib/export-download";

export type ExportPreparationResult = { ok: true } | { ok: false; message: string };

export function ExportModal({
  open,
  mindmapId,
  mindmapTitle,
  node,
  defaultScope,
  prepareExport,
  onOpenChange,
}: {
  open: boolean;
  mindmapId: string;
  mindmapTitle: string;
  node?: Readonly<{ id: string; title: string }>;
  defaultScope: ExportScope;
  prepareExport?: (scope: ExportScope) => Promise<ExportPreparationResult>;
  onOpenChange: (open: boolean) => void;
}) {
  const [scope, setScope] = useState<ExportScope>(defaultScope);
  const [stage, setStage] = useState<"preparing" | "generating" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef(false);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);
  const pending = stage !== null;

  function close(nextOpen: boolean) {
    if (pending) return;
    if (!nextOpen) {
      setScope(defaultScope);
      setError(null);
    }
    onOpenChange(nextOpen);
  }

  async function generate() {
    if (inFlight.current || (scope !== "ALL" && !node)) return;
    inFlight.current = true;
    setError(null);
    try {
      setStage("preparing");
      const prepared = await prepareExport?.(scope);
      if (prepared && !prepared.ok) {
        setError(prepared.message);
        return;
      }
      setStage("generating");
      const input: ExportMindmapInput = scope === "ALL"
        ? { scope, format: "MARKDOWN" }
        : { scope, nodeId: node?.id as string, format: "MARKDOWN" };
      await downloadMindmapExport(mindmapId, input);
      setScope(defaultScope);
      onOpenChange(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Markdown 파일을 생성하지 못했습니다.");
    } finally {
      setStage(null);
      inFlight.current = false;
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={close}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[70] bg-slate-950/45 backdrop-blur-[1px]" />
        <Dialog.Content
          aria-describedby="export-modal-description"
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            const activeElement = document.activeElement;
            restoreFocusRef.current = activeElement instanceof HTMLElement ? activeElement : null;
            cancelRef.current?.focus();
          }}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            restoreFocusRef.current?.focus();
          }}
          onEscapeKeyDown={(event) => {
            if (pending) event.preventDefault();
          }}
          onPointerDownOutside={(event) => {
            if (pending) event.preventDefault();
          }}
          className="fixed left-1/2 top-1/2 z-[71] w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-[var(--border)] bg-white p-6 shadow-2xl outline-none"
        >
          <Dialog.Title className="text-xl font-extrabold">Markdown 내보내기</Dialog.Title>
          <Dialog.Description id="export-modal-description" className="mt-2 text-sm leading-6 text-[var(--muted)]">
            &apos;{mindmapTitle}&apos;의 개념 구조와 노드 상세를 UTF-8 Markdown 파일로 생성합니다.
          </Dialog.Description>

          <fieldset className="mt-5 space-y-2" disabled={pending}>
            <legend className="mb-2 text-sm font-extrabold">내보내기 범위</legend>
            <ScopeOption checked={scope === "ALL"} label="전체 마인드맵" onChange={() => setScope("ALL")} />
            <ScopeOption checked={scope === "NODE"} disabled={!node} label="현재 노드만" onChange={() => setScope("NODE")} />
            <ScopeOption checked={scope === "SUBTREE"} disabled={!node} label="현재 노드 + 모든 하위 개념" onChange={() => setScope("SUBTREE")} />
          </fieldset>

          <div className="mt-4 rounded-xl bg-[var(--background)] p-4 text-sm leading-6">
            <p><strong>형식:</strong> Markdown (.md)</p>
            <p><strong>포함:</strong> 제목, 선택 범위, 개념 트리, 노드 경로, 상세 Markdown</p>
            {node ? <p><strong>기준 노드:</strong> {node.title}</p> : null}
          </div>

          {error ? <p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-sm font-bold text-[var(--danger)]">{error}</p> : null}

          <div className="mt-6 flex justify-end gap-2">
            <Dialog.Close asChild>
              <button ref={cancelRef} type="button" disabled={pending} className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm font-bold disabled:opacity-60">
                취소
              </button>
            </Dialog.Close>
            <button
              type="button"
              disabled={pending || (scope !== "ALL" && !node)}
              onClick={() => void generate()}
              className="rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-extrabold text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              {stage === "preparing" ? "저장 확인 중…" : stage === "generating" ? "파일 생성 중…" : "파일 생성"}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function ScopeOption({
  checked,
  disabled = false,
  label,
  onChange,
}: {
  checked: boolean;
  disabled?: boolean;
  label: string;
  onChange: () => void;
}) {
  return (
    <label className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-sm ${disabled ? "cursor-not-allowed opacity-45" : "cursor-pointer hover:border-[var(--primary)]"}`}>
      <input type="radio" name="export-scope" checked={checked} disabled={disabled} onChange={onChange} />
      <span className="font-bold">{label}</span>
    </label>
  );
}
