"use client";

import { Handle, Position, type NodeProps } from "@xyflow/react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { memo, useEffect, useRef } from "react";

import type { MindmapFlowNode } from "@/features/mindmap/model/flow-adapter";

export const MindmapNode = memo(function MindmapNode({ id, data, selected }: NodeProps<MindmapFlowNode>) {
  const inputRef = useRef<HTMLInputElement>(null);
  const cancelOnBlurRef = useRef(false);

  useEffect(() => {
    if (!data.isEditing) return;
    cancelOnBlurRef.current = false;
    inputRef.current?.focus();
    inputRef.current?.select();
  }, [data.isEditing]);

  return (
    <div
      data-testid={data.isRoot ? "root-node" : "mindmap-node"}
      className={`min-w-40 max-w-64 rounded-2xl border px-5 py-3 text-center shadow-md transition ${
        data.isRoot
          ? "border-violet-700 bg-[var(--primary)] text-white"
          : "border-[var(--border)] bg-white text-[var(--foreground)]"
      } ${selected ? "ring-4 ring-violet-300 ring-offset-2" : ""}`}
    >
      <Handle type="target" position={Position.Left} className="!size-2 !border-0 !bg-violet-400 !opacity-0" />
      {data.isEditing ? (
        <div>
          <input
            ref={inputRef}
            aria-label="노드 제목"
            defaultValue={data.title}
            readOnly={data.isSaving}
            aria-disabled={data.isSaving}
            onBlur={() => {
              if (cancelOnBlurRef.current) {
                cancelOnBlurRef.current = false;
                return;
              }
              if (!data.isSaving) data.onCommitEdit?.(id, inputRef.current?.value ?? "");
            }}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                event.preventDefault();
                cancelOnBlurRef.current = true;
                data.onCancelEdit?.();
                return;
              }
              if (
                event.key === "Enter" &&
                !event.nativeEvent.isComposing &&
                event.nativeEvent.keyCode !== 229
              ) {
                event.preventDefault();
                data.onCommitEdit?.(id, event.currentTarget.value);
              }
            }}
            className={`nodrag nowheel w-full rounded-md border px-2 py-1 text-center text-sm font-extrabold outline-none focus:ring-2 ${
              data.isRoot
                ? "border-violet-300 bg-white text-[var(--foreground)] focus:ring-violet-200"
                : "border-[var(--border)] bg-white text-[var(--foreground)] focus:ring-violet-300"
            }`}
          />
          {data.editError ? (
            <div role="alert" className={`mt-2 text-[10px] font-bold ${data.isRoot ? "text-red-100" : "text-[var(--danger)]"}`}>
              <span>{data.editError}</span>
              <button
                type="button"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => data.onCommitEdit?.(id, inputRef.current?.value ?? "")}
                className="ml-1 underline"
              >
                다시 시도
              </button>
            </div>
          ) : null}
        </div>
      ) : (
        <p
          onClick={(event) => event.stopPropagation()}
          onDoubleClick={(event) => {
            event.stopPropagation();
            if (data.isInteractionDisabled) return;
            data.onStartEdit?.(id);
          }}
          className={`nodrag truncate text-sm font-extrabold ${data.isRoot ? "text-white" : "text-[var(--foreground)]"}`}
        >
          {data.title}
        </p>
      )}
      {data.isRoot ? <p className="mt-1 text-[10px] font-bold uppercase tracking-widest text-violet-100">Root</p> : null}
      <div className="nodrag mt-2 flex items-center justify-center gap-1.5">
        <button
          type="button"
          aria-label={`${data.title} 상세 열기`}
          onClick={(event) => {
            event.stopPropagation();
            data.onOpenDetail?.(id);
          }}
          className={`rounded-full px-2.5 py-1 text-[10px] font-extrabold transition ${
            data.isRoot ? "bg-white/20 text-white hover:bg-white/30" : "bg-violet-100 text-[var(--primary)] hover:bg-violet-200"
          }`}
        >
          상세
        </button>
        {data.hasChildren ? (
          <button
            type="button"
            aria-label={`${data.title} 하위 트리 ${data.isCollapsed ? "펼치기" : "접기"}`}
            disabled={data.isInteractionDisabled}
            onClick={(event) => {
              event.stopPropagation();
              data.onToggleCollapse?.(id);
            }}
            className={`inline-grid size-7 place-items-center rounded-full text-xs font-black transition disabled:cursor-wait disabled:opacity-60 ${
              data.isRoot ? "bg-white/20 text-white hover:bg-white/30" : "bg-violet-100 text-[var(--primary)] hover:bg-violet-200"
            }`}
          >
            {data.isCollapsed ? "▸" : "▾"}
          </button>
        ) : null}
        <button
          type="button"
          aria-label={`${data.title}에 자식 노드 추가`}
          title={data.isCollapsed ? "하위 트리를 펼친 뒤 자식 노드를 추가해 주세요." : undefined}
          disabled={data.isInteractionDisabled || data.isCollapsed}
          onClick={(event) => {
            event.stopPropagation();
            data.onAddChild?.(id);
          }}
          className={`inline-grid size-7 place-items-center rounded-full text-base font-black transition disabled:cursor-not-allowed disabled:opacity-60 ${
            data.isRoot ? "bg-white/20 text-white hover:bg-white/30" : "bg-violet-100 text-[var(--primary)] hover:bg-violet-200"
          }`}
        >
          {data.isCreatingChild ? "…" : "+"}
        </button>
        {data.onExport || !data.isRoot ? (
          <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
            <button
              type="button"
              aria-label={`${data.title} 메뉴`}
              onClick={(event) => event.stopPropagation()}
              className="grid size-7 cursor-pointer list-none place-items-center rounded-full bg-violet-100 text-sm font-black text-[var(--primary)] transition hover:bg-violet-200"
            >
              ⋯
            </button>
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
            <DropdownMenu.Content
              align="end"
              sideOffset={4}
              collisionPadding={8}
              className="z-[80] w-40 rounded-lg border border-[var(--border)] bg-white p-1 text-left shadow-xl"
            >
              {data.onExport ? (
                <DropdownMenu.Item
                  onSelect={() => data.onExport?.(id)}
                  className="w-full rounded-md px-3 py-2 text-left text-xs font-bold hover:bg-[var(--background)]"
                >
                  이 노드부터 내보내기
                </DropdownMenu.Item>
              ) : null}
              {!data.isRoot ? (
                <DropdownMenu.Item
                  onSelect={() => data.onDelete?.(id)}
                  className="w-full rounded-md px-3 py-2 text-left text-xs font-bold text-[var(--danger)] hover:bg-red-50"
                >
                  삭제
                </DropdownMenu.Item>
              ) : null}
            </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>
        ) : null}
      </div>
      {data.childCreateError ? (
        <div role="alert" className={`mt-1 text-[10px] font-bold ${data.isRoot ? "text-red-100" : "text-[var(--danger)]"}`}>
          <span>{data.childCreateError}</span>
          <button type="button" onClick={() => data.onAddChild?.(id)} className="ml-1 underline">다시 시도</button>
        </div>
      ) : null}
      {data.mutationError ? (
        <div role="alert" className={`nodrag mt-1 text-[10px] font-bold ${data.isRoot ? "text-red-100" : "text-[var(--danger)]"}`}>
          <span>{data.mutationError.message}</span>
          <div className="mt-1 flex justify-center gap-2">
            <button
              type="button"
              onClick={() => data.onRetryMutation?.(id)}
              className="underline"
            >
              다시 시도
            </button>
            <button
              type="button"
              onClick={() => data.onRevertMutation?.(id)}
              className="underline"
            >
              서버 상태로 되돌리기
            </button>
          </div>
        </div>
      ) : null}
      {data.creationError ? (
        <div role="alert" className="nodrag mt-1 text-[10px] font-bold text-[var(--danger)]">
          <span>{data.creationError}</span>
          <div className="mt-1 flex justify-center gap-2">
            <button type="button" onClick={() => data.onRetryCreate?.(id)} className="underline">다시 시도</button>
            <button type="button" onClick={() => data.onDiscardCreate?.(id)} className="underline">임시 노드 제거</button>
          </div>
        </div>
      ) : null}
      <Handle type="source" position={Position.Right} className="!size-2 !border-0 !bg-violet-400 !opacity-0" />
    </div>
  );
});
