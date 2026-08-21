"use client";

import {
  Background,
  BackgroundVariant,
  Panel,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  type EdgeTypes,
  type NodeTypes,
} from "@xyflow/react";
import Link from "next/link";
import { useCallback, useMemo, useState } from "react";

import { MindmapEdge } from "@/features/mindmap/components/mindmap-edge";
import { MindmapNode } from "@/features/mindmap/components/mindmap-node";
import type { MindmapDetailResponse } from "@/features/mindmap/api/contracts";
import { useMindmapDetail } from "@/features/mindmap/hooks/use-mindmap-detail";
import {
  toMindmapFlow,
  type MindmapFlowEdge,
  type MindmapFlowNode,
} from "@/features/mindmap/model/flow-adapter";

const nodeTypes: NodeTypes = { mindmap: MindmapNode };
const edgeTypes: EdgeTypes = { mindmap: MindmapEdge };
const fitViewOptions = { padding: 0.25, minZoom: 0.25, maxZoom: 1.25 } as const;

type MindmapEditorProps = {
  mindmapId: string;
  initialData?: MindmapDetailResponse;
  initialRootSelection?: boolean;
};

export function MindmapEditor(props: MindmapEditorProps) {
  return (
    <ReactFlowProvider>
      <MindmapEditorContent {...props} />
    </ReactFlowProvider>
  );
}

function MindmapEditorContent({ mindmapId, initialData, initialRootSelection = false }: MindmapEditorProps) {
  const detail = useMindmapDetail(mindmapId, initialData);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(
    initialRootSelection && initialData ? initialData.rootNodeId : null,
  );

  if (detail.isPending && !detail.data) return <EditorLoadingState />;
  if (!detail.data) {
    return <EditorQueryError onRetry={() => void detail.refetch()} />;
  }

  return (
    <main className="flex h-screen min-h-[32rem] flex-col overflow-hidden bg-[var(--background)]">
      <EditorHeader title={detail.data.mindmap.title} refreshFailed={detail.isError} onRetry={() => void detail.refetch()} />
      <MindmapCanvas
        detail={detail.data}
        selectedNodeId={selectedNodeId}
        onSelectNode={setSelectedNodeId}
      />
    </main>
  );
}

function EditorHeader({ title, refreshFailed, onRetry }: { title: string; refreshFailed: boolean; onRetry: () => void }) {
  return (
    <header className="z-10 border-b border-[var(--border)] bg-white">
      <div className="flex min-h-[4.5rem] items-center gap-4 px-4 sm:px-6">
        <Link href="/" className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm font-bold hover:border-[var(--primary)] hover:text-[var(--primary)]">← Dashboard</Link>
        <h1 className="min-w-0 flex-1 truncate text-lg font-extrabold">{title}</h1>
        {refreshFailed ? (
          <button type="button" onClick={onRetry} className="rounded-lg bg-red-50 px-3 py-2 text-xs font-bold text-[var(--danger)]">새로고침 실패 · 다시 시도</button>
        ) : (
          <span role="status" className="rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-bold text-[var(--success)]">서버에서 불러옴</span>
        )}
      </div>
    </header>
  );
}

function MindmapCanvas({ detail, selectedNodeId, onSelectNode }: {
  detail: MindmapDetailResponse;
  selectedNodeId: string | null;
  onSelectNode: (nodeId: string | null) => void;
}) {
  const flow = useMemo(() => toMindmapFlow(detail, selectedNodeId), [detail, selectedNodeId]);
  const selectNode = useCallback((_event: React.MouseEvent, node: MindmapFlowNode) => onSelectNode(node.id), [onSelectNode]);
  const clearSelection = useCallback(() => onSelectNode(null), [onSelectNode]);

  return (
    <section
      aria-label="마인드맵 캔버스"
      data-nodes-draggable="false"
      data-nodes-connectable="false"
      data-delete-enabled="false"
      className="relative min-h-0 flex-1"
    >
      <ReactFlow<MindmapFlowNode, MindmapFlowEdge>
        nodes={flow.nodes}
        edges={flow.edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodeClick={selectNode}
        onPaneClick={clearSelection}
        fitView
        fitViewOptions={fitViewOptions}
        minZoom={0.2}
        maxZoom={2}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable
        edgesFocusable={false}
        deleteKeyCode={null}
        panOnDrag
        zoomOnScroll
        zoomOnPinch
        zoomOnDoubleClick={false}
        proOptions={{ hideAttribution: true }}
      >
        <Background variant={BackgroundVariant.Dots} gap={24} size={1.5} color="#cbc7df" />
        <CanvasToolbar />
      </ReactFlow>
    </section>
  );
}

function CanvasToolbar() {
  const { zoomIn, zoomOut, fitView } = useReactFlow<MindmapFlowNode, MindmapFlowEdge>();
  return (
    <Panel position="bottom-left" className="!m-4 flex overflow-hidden rounded-xl border border-[var(--border)] bg-white shadow-lg">
      <button type="button" aria-label="확대" onClick={() => void zoomIn({ duration: 160 })} className="grid size-10 place-items-center border-r border-[var(--border)] text-lg font-bold hover:bg-violet-50">+</button>
      <button type="button" aria-label="축소" onClick={() => void zoomOut({ duration: 160 })} className="grid size-10 place-items-center border-r border-[var(--border)] text-lg font-bold hover:bg-violet-50">−</button>
      <button type="button" aria-label="화면 맞춤" onClick={() => void fitView({ ...fitViewOptions, duration: 240 })} className="px-3 text-xs font-bold hover:bg-violet-50">맞춤</button>
    </Panel>
  );
}

function EditorLoadingState() {
  return <div aria-label="마인드맵 불러오는 중" className="h-screen animate-pulse bg-gradient-to-br from-violet-50 to-[var(--background)]" />;
}

function EditorQueryError({ onRetry }: { onRetry: () => void }) {
  return (
    <main className="grid min-h-screen place-items-center p-6">
      <div role="alert" className="max-w-md rounded-2xl border border-red-200 bg-white p-8 text-center shadow-[var(--shadow-card)]">
        <h1 className="text-xl font-extrabold">마인드맵을 불러오지 못했습니다</h1>
        <p className="mt-2 text-sm text-[var(--muted)]">잠시 후 다시 시도하거나 Dashboard로 돌아가세요.</p>
        <div className="mt-6 flex justify-center gap-3">
          <Link href="/" className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm font-bold">Dashboard</Link>
          <button type="button" onClick={onRetry} className="rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-bold text-white">다시 시도</button>
        </div>
      </div>
    </main>
  );
}
