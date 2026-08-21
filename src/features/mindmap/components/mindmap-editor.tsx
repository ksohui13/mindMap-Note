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
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo, useRef, useState } from "react";

import { ApiClientError } from "@/features/mindmap/api/client";
import { MindmapEdge } from "@/features/mindmap/components/mindmap-edge";
import { MindmapNode } from "@/features/mindmap/components/mindmap-node";
import type { MindmapDetailResponse } from "@/features/mindmap/api/contracts";
import { useCreateNode, useUpdateNodeTitle } from "@/features/mindmap/hooks/use-node-mutations";
import { mindmapDetailQueryKey, useMindmapDetail } from "@/features/mindmap/hooks/use-mindmap-detail";
import {
  toMindmapFlow,
  type MindmapFlowEdge,
  type MindmapFlowNode,
} from "@/features/mindmap/model/flow-adapter";
import { calculateChildPosition } from "@/features/mindmap/model/node-position";

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
  const queryClient = useQueryClient();
  const createNodeMutation = useCreateNode();
  const updateTitleMutation = useUpdateNodeTitle();
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(
    initialRootSelection && initialData ? initialData.rootNodeId : null,
  );
  const [editingNodeId, setEditingNodeId] = useState<string | null>(
    initialRootSelection && initialData ? initialData.rootNodeId : null,
  );
  const [editDraft, setEditDraft] = useState(
    initialRootSelection && initialData
      ? initialData.nodes.find((node) => node.id === initialData.rootNodeId)?.title ?? ""
      : "",
  );
  const [editError, setEditError] = useState<string | null>(null);
  const [savingNodeId, setSavingNodeId] = useState<string | null>(null);
  const [creatingParentId, setCreatingParentId] = useState<string | null>(null);
  const [childCreateError, setChildCreateError] = useState<{
    parentNodeId: string;
    message: string;
  } | null>(null);
  const createLocks = useRef(new Set<string>());
  const updateLocks = useRef(new Set<string>());
  const updateSequences = useRef(new Map<string, number>());

  const startEdit = useCallback((nodeId: string) => {
    if (savingNodeId || creatingParentId) return;
    const node = detail.data?.nodes.find((candidate) => candidate.id === nodeId);
    if (!node) return;
    setSelectedNodeId(nodeId);
    setEditingNodeId(nodeId);
    setEditDraft(node.title);
    setEditError(null);
  }, [creatingParentId, detail.data, savingNodeId]);

  const cancelEdit = useCallback(() => {
    if (savingNodeId === editingNodeId) return;
    setEditingNodeId(null);
    setEditDraft("");
    setEditError(null);
  }, [editingNodeId, savingNodeId]);

  const commitEdit = useCallback(async () => {
    if (!editingNodeId || updateLocks.current.has(editingNodeId)) return;
    const node = detail.data?.nodes.find((candidate) => candidate.id === editingNodeId);
    if (!node) return;
    const title = editDraft.trim();
    if (!title) {
      setEditDraft(node.title);
      setEditError("노드 제목을 입력해 주세요.");
      return;
    }
    if (title === node.title) {
      setEditingNodeId(null);
      setEditDraft("");
      setEditError(null);
      return;
    }

    updateLocks.current.add(node.id);
    const sequence = (updateSequences.current.get(node.id) ?? 0) + 1;
    updateSequences.current.set(node.id, sequence);
    setSavingNodeId(node.id);
    setEditError(null);

    try {
      const response = await updateTitleMutation.mutateAsync({
        nodeId: node.id,
        input: { title, revision: node.revision },
      });
      if (updateSequences.current.get(node.id) !== sequence) return;
      queryClient.setQueryData<MindmapDetailResponse>(
        mindmapDetailQueryKey(mindmapId),
        (current) => current
          ? {
              ...current,
              nodes: current.nodes.map((candidate) =>
                candidate.id === response.node.id ? response.node : candidate,
              ),
            }
          : current,
      );
      setEditingNodeId(null);
      setEditDraft("");
    } catch (error) {
      if (updateSequences.current.get(node.id) !== sequence) return;
      if (error instanceof ApiClientError && error.status === 409) {
        await detail.refetch();
        setEditError("다른 변경사항을 반영했습니다. 다시 시도해 주세요.");
      } else {
        setEditError(error instanceof Error ? error.message : "제목을 저장하지 못했습니다.");
      }
    } finally {
      updateLocks.current.delete(node.id);
      if (updateSequences.current.get(node.id) === sequence) setSavingNodeId(null);
    }
  }, [detail, editDraft, editingNodeId, mindmapId, queryClient, updateTitleMutation]);

  const addChild = useCallback(async (parentNodeId: string) => {
    if (savingNodeId || creatingParentId || createLocks.current.has(parentNodeId)) return;
    const current = detail.data;
    const parent = current?.nodes.find((node) => node.id === parentNodeId);
    if (!current || !parent) return;

    createLocks.current.add(parentNodeId);
    setCreatingParentId(parentNodeId);
    setChildCreateError(null);
    const position = calculateChildPosition(parent, current.nodes);

    try {
      const response = await createNodeMutation.mutateAsync({
        mindmapId,
        input: {
          parentNodeId,
          title: "새 노드",
          ...position,
        },
      });
      queryClient.setQueryData<MindmapDetailResponse>(
        mindmapDetailQueryKey(mindmapId),
        (cached) => cached
          ? {
              ...cached,
              mindmap: { ...cached.mindmap, updatedAt: response.mindmapUpdatedAt },
              nodes: [...cached.nodes, response.node],
            }
          : cached,
      );
      setSelectedNodeId(response.node.id);
      setEditingNodeId(response.node.id);
      setEditDraft(response.node.title);
      setEditError(null);
    } catch (error) {
      setChildCreateError({
        parentNodeId,
        message: error instanceof Error ? error.message : "자식 노드를 만들지 못했습니다.",
      });
    } finally {
      createLocks.current.delete(parentNodeId);
      setCreatingParentId((currentParentId) =>
        currentParentId === parentNodeId ? null : currentParentId,
      );
    }
  }, [createNodeMutation, creatingParentId, detail.data, mindmapId, queryClient, savingNodeId]);

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
        editingNodeId={editingNodeId}
        editDraft={editDraft}
        editError={editError}
        savingNodeId={savingNodeId}
        creatingParentId={creatingParentId}
        childCreateError={childCreateError}
        onAddChild={(nodeId) => void addChild(nodeId)}
        onCancelEdit={cancelEdit}
        onChangeDraft={(value) => {
          setEditDraft(value);
          setEditError(null);
        }}
        onCommitEdit={() => void commitEdit()}
        onStartEdit={startEdit}
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

function MindmapCanvas({
  detail,
  selectedNodeId,
  onSelectNode,
  editingNodeId,
  editDraft,
  editError,
  savingNodeId,
  creatingParentId,
  childCreateError,
  onAddChild,
  onCancelEdit,
  onChangeDraft,
  onCommitEdit,
  onStartEdit,
}: {
  detail: MindmapDetailResponse;
  selectedNodeId: string | null;
  onSelectNode: (nodeId: string | null) => void;
  editingNodeId: string | null;
  editDraft: string;
  editError: string | null;
  savingNodeId: string | null;
  creatingParentId: string | null;
  childCreateError: { parentNodeId: string; message: string } | null;
  onAddChild: (nodeId: string) => void;
  onCancelEdit: () => void;
  onChangeDraft: (value: string) => void;
  onCommitEdit: () => void;
  onStartEdit: (nodeId: string) => void;
}) {
  const flow = useMemo(
    () => toMindmapFlow(detail, selectedNodeId, {
      editingNodeId,
      editDraft,
      editError,
      savingNodeId,
      creatingParentId,
      childCreateError,
      onAddChild,
      onCancelEdit,
      onChangeDraft,
      onCommitEdit,
      onStartEdit,
    }),
    [
      childCreateError,
      creatingParentId,
      detail,
      editDraft,
      editError,
      editingNodeId,
      onAddChild,
      onCancelEdit,
      onChangeDraft,
      onCommitEdit,
      onStartEdit,
      savingNodeId,
      selectedNodeId,
    ],
  );
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
