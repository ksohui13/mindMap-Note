"use client";

import { Handle, Position, type NodeProps } from "@xyflow/react";
import { memo } from "react";

import type { MindmapFlowNode } from "@/features/mindmap/model/flow-adapter";

export const MindmapNode = memo(function MindmapNode({ data, selected }: NodeProps<MindmapFlowNode>) {
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
      <p className={`truncate text-sm font-extrabold ${data.isRoot ? "text-white" : "text-[var(--foreground)]"}`}>{data.title}</p>
      {data.isRoot ? <p className="mt-1 text-[10px] font-bold uppercase tracking-widest text-violet-100">Root</p> : null}
      <Handle type="source" position={Position.Right} className="!size-2 !border-0 !bg-violet-400 !opacity-0" />
    </div>
  );
});
