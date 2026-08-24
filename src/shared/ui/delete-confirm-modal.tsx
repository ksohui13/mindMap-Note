"use client";

import * as AlertDialog from "@radix-ui/react-alert-dialog";
import { useRef } from "react";

export function DeleteConfirmModal({
  open,
  title,
  description,
  pending,
  confirmDisabled = false,
  error,
  onRetry,
  onOpenChange,
  onConfirm,
}: {
  open: boolean;
  title: string;
  description: string;
  pending: boolean;
  confirmDisabled?: boolean;
  error?: string | null;
  onRetry?: () => void;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);

  return (
    <AlertDialog.Root
      open={open}
      onOpenChange={(nextOpen) => {
        if (!pending) onOpenChange(nextOpen);
      }}
    >
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="fixed inset-0 z-[70] bg-slate-950/45 backdrop-blur-[1px]" />
        <AlertDialog.Content
          aria-describedby="delete-confirm-description"
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
          className="fixed left-1/2 top-1/2 z-[71] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-[var(--border)] bg-white p-6 shadow-2xl outline-none"
        >
          <div aria-hidden="true" className="grid size-11 place-items-center rounded-full bg-red-100 text-xl text-[var(--danger)]">!</div>
          <AlertDialog.Title className="mt-4 text-lg font-extrabold">
            {title}
          </AlertDialog.Title>
          <AlertDialog.Description
            id="delete-confirm-description"
            className="mt-2 whitespace-pre-line text-sm leading-6 text-[var(--muted)]"
          >
            {description}
          </AlertDialog.Description>
          {error ? (
            <div role="alert" className="mt-3 rounded-lg bg-red-50 p-3 text-sm font-bold text-[var(--danger)]">
              <span>{error}</span>
              {onRetry ? (
                <button type="button" onClick={onRetry} className="ml-2 underline">
                  다시 조회
                </button>
              ) : null}
            </div>
          ) : null}
          <div className="mt-6 flex justify-end gap-2">
            <AlertDialog.Cancel asChild>
              <button
                ref={cancelRef}
                type="button"
                disabled={pending}
                className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm font-bold hover:border-[var(--primary)] disabled:cursor-not-allowed disabled:opacity-60"
              >
                취소
              </button>
            </AlertDialog.Cancel>
            <AlertDialog.Action asChild>
              <button
                type="button"
                disabled={pending || confirmDisabled}
                onClick={(event) => {
                  event.preventDefault();
                  onConfirm();
                }}
                className="rounded-lg bg-[var(--danger)] px-4 py-2 text-sm font-extrabold text-white hover:brightness-90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {pending ? "삭제 중…" : "삭제"}
              </button>
            </AlertDialog.Action>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}
