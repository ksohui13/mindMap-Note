"use client";

import { Handle, Position, type NodeProps } from "@xyflow/react";
import { memo, useEffect, useRef } from "react";

import type { MindmapFlowNode } from "@/features/mindmap/model/flow-adapter";

export const MindmapNode = memo(function MindmapNode({ id, data, selected }: NodeProps<MindmapFlowNode>) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!data.isEditing) return;
    inputRef.current?.focus();
    inputRef.current?.select();
  }, [data.isEditing]);

  return (
    <div
      data-testid={data.isRoot ? "root-node" : "mindmap-node"}
      onDoubleClick={(event) => {
        event.stopPropagation();
        if (data.isInteractionDisabled) return;
        data.onStartEdit?.(id);
      }}
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
            value={data.editDraft ?? ""}
            readOnly={data.isSaving}
            aria-disabled={data.isSaving}
            onChange={(event) => data.onChangeDraft?.(event.target.value)}
            onBlur={() => {
              if (!data.isSaving) data.onCancelEdit?.();
            }}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                event.preventDefault();
                data.onCancelEdit?.();
                return;
              }
              if (
                event.key === "Enter" &&
                !event.nativeEvent.isComposing &&
                event.nativeEvent.keyCode !== 229
              ) {
                event.preventDefault();
                data.onCommitEdit?.();
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
                onClick={() => data.onCommitEdit?.()}
                className="ml-1 underline"
              >
                다시 시도
              </button>
            </div>
          ) : null}
        </div>
      ) : (
        <p className={`truncate text-sm font-extrabold ${data.isRoot ? "text-white" : "text-[var(--foreground)]"}`}>{data.title}</p>
      )}
      {data.isRoot ? <p className="mt-1 text-[10px] font-bold uppercase tracking-widest text-violet-100">Root</p> : null}
      <button
        type="button"
        aria-label={`${data.title}에 자식 노드 추가`}
        disabled={data.isInteractionDisabled}
        onClick={(event) => {
          event.stopPropagation();
          data.onAddChild?.(id);
        }}
        className={`nodrag mt-2 inline-grid size-7 place-items-center rounded-full text-base font-black transition disabled:cursor-wait disabled:opacity-60 ${
          data.isRoot ? "bg-white/20 text-white hover:bg-white/30" : "bg-violet-100 text-[var(--primary)] hover:bg-violet-200"
        }`}
      >
        {data.isCreatingChild ? "…" : "+"}
      </button>
      {data.childCreateError ? (
        <div role="alert" className={`mt-1 text-[10px] font-bold ${data.isRoot ? "text-red-100" : "text-[var(--danger)]"}`}>
          <span>{data.childCreateError}</span>
          <button type="button" onClick={() => data.onAddChild?.(id)} className="ml-1 underline">다시 시도</button>
        </div>
      ) : null}
      <Handle type="source" position={Position.Right} className="!size-2 !border-0 !bg-violet-400 !opacity-0" />
    </div>
  );
});
