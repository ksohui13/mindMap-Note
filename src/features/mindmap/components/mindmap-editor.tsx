"use client";

import {
  Background,
  BackgroundVariant,
  Panel,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  type EdgeTypes,
  type NodeChange,
  type NodeTypes,
} from "@xyflow/react";
import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo, useRef, useState } from "react";

import { ApiClientError } from "@/features/mindmap/api/client";
import { MindmapEdge } from "@/features/mindmap/components/mindmap-edge";
import { MindmapNode } from "@/features/mindmap/components/mindmap-node";
import type { MindmapDetailResponse } from "@/features/mindmap/api/contracts";
import {
  useCreateNode,
  useUpdateNodeCollapse,
  useUpdateNodePosition,
  useUpdateNodeTitle,
} from "@/features/mindmap/hooks/use-node-mutations";
import { mindmapDetailQueryKey, useMindmapDetail } from "@/features/mindmap/hooks/use-mindmap-detail";
import {
  toMindmapFlow,
  type MindmapFlowEdge,
  type MindmapFlowNode,
} from "@/features/mindmap/model/flow-adapter";
import { calculateChildPosition } from "@/features/mindmap/model/node-position";
import {
  applyNodeViewOverrides,
  getDescendantIds,
  nodesWithChildren,
  selectVisibleNodes,
  type CollapseOverrides,
  type NodePosition,
  type PositionOverrides,
} from "@/features/mindmap/model/visible-tree";

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
  const updatePositionMutation = useUpdateNodePosition();
  const updateCollapseMutation = useUpdateNodeCollapse();
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
  const [positionOverrides, setPositionOverrides] = useState<PositionOverrides>({});
  const [collapseOverrides, setCollapseOverrides] = useState<CollapseOverrides>({});
  const [pendingNodeIds, setPendingNodeIds] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  const [mutationErrors, setMutationErrors] = useState<Readonly<Record<
    string,
    { kind: "position" | "collapse"; message: string }
  >>>({});
  const createLocks = useRef(new Set<string>());
  const updateLocks = useRef(new Set<string>());
  const updateSequences = useRef(new Map<string, number>());
  const nodeMutationLocks = useRef(new Set<string>());
  const nodeMutationSequences = useRef(new Map<string, number>());

  const effectiveNodes = useMemo(
    () => applyNodeViewOverrides(
      detail.data?.nodes ?? [],
      positionOverrides,
      collapseOverrides,
    ),
    [collapseOverrides, detail.data?.nodes, positionOverrides],
  );
  const visibleNodes = useMemo(
    () => detail.data
      ? selectVisibleNodes(effectiveNodes, detail.data.rootNodeId)
      : [],
    [detail.data, effectiveNodes],
  );
  const parentNodeIds = useMemo(
    () => nodesWithChildren(detail.data?.nodes ?? []),
    [detail.data?.nodes],
  );

  const setNodePending = useCallback((nodeId: string, pending: boolean) => {
    setPendingNodeIds((current) => {
      const next = new Set(current);
      if (pending) next.add(nodeId);
      else next.delete(nodeId);
      return next;
    });
  }, []);

  const replaceCachedNode = useCallback((node: MindmapDetailResponse["nodes"][number]) => {
    queryClient.setQueryData<MindmapDetailResponse>(
      mindmapDetailQueryKey(mindmapId),
      (current) => current
        ? {
            ...current,
            nodes: current.nodes.map((candidate) =>
              candidate.id === node.id ? node : candidate,
            ),
          }
        : current,
    );
  }, [mindmapId, queryClient]);

  const clearMutationError = useCallback((nodeId: string) => {
    setMutationErrors((current) => {
      if (!current[nodeId]) return current;
      const next = { ...current };
      delete next[nodeId];
      return next;
    });
  }, []);

  const startEdit = useCallback((nodeId: string) => {
    if (savingNodeId || creatingParentId || nodeMutationLocks.current.has(nodeId)) return;
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
    if (
      !editingNodeId ||
      updateLocks.current.has(editingNodeId) ||
      nodeMutationLocks.current.has(editingNodeId)
    ) return;
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
    if (
      savingNodeId ||
      creatingParentId ||
      createLocks.current.has(parentNodeId) ||
      nodeMutationLocks.current.has(parentNodeId)
    ) return;
    const current = detail.data;
    const parent = effectiveNodes.find((node) => node.id === parentNodeId);
    if (!current || !parent || parent.isCollapsed) return;

    createLocks.current.add(parentNodeId);
    setCreatingParentId(parentNodeId);
    setChildCreateError(null);
    const position = calculateChildPosition(parent, effectiveNodes);

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
  }, [createNodeMutation, creatingParentId, detail.data, effectiveNodes, mindmapId, queryClient, savingNodeId]);

  const persistPosition = useCallback(async (nodeId: string, position: NodePosition) => {
    if (nodeMutationLocks.current.has(nodeId)) return;
    const node = detail.data?.nodes.find((candidate) => candidate.id === nodeId);
    if (!node) return;

    nodeMutationLocks.current.add(nodeId);
    const sequence = (nodeMutationSequences.current.get(nodeId) ?? 0) + 1;
    nodeMutationSequences.current.set(nodeId, sequence);
    setNodePending(nodeId, true);
    clearMutationError(nodeId);

    try {
      const response = await updatePositionMutation.mutateAsync({
        nodeId,
        input: { ...position, revision: node.revision },
      });
      if (nodeMutationSequences.current.get(nodeId) !== sequence) return;
      replaceCachedNode(response.node);
      setPositionOverrides((current) => {
        const next = { ...current };
        delete next[nodeId];
        return next;
      });
    } catch (error) {
      if (nodeMutationSequences.current.get(nodeId) !== sequence) return;
      if (error instanceof ApiClientError && error.status === 409) {
        await detail.refetch();
        setMutationErrors((current) => ({
          ...current,
          [nodeId]: {
            kind: "position",
            message: "다른 변경사항을 반영했습니다. 위치 저장을 다시 시도해 주세요.",
          },
        }));
      } else {
        setMutationErrors((current) => ({
          ...current,
          [nodeId]: {
            kind: "position",
            message: error instanceof Error ? error.message : "위치를 저장하지 못했습니다.",
          },
        }));
      }
    } finally {
      nodeMutationLocks.current.delete(nodeId);
      if (nodeMutationSequences.current.get(nodeId) === sequence) {
        setNodePending(nodeId, false);
      }
    }
  }, [clearMutationError, detail, replaceCachedNode, setNodePending, updatePositionMutation]);

  const persistCollapse = useCallback(async (nodeId: string, isCollapsed: boolean) => {
    if (nodeMutationLocks.current.has(nodeId)) return;
    const node = detail.data?.nodes.find((candidate) => candidate.id === nodeId);
    if (!node) return;

    nodeMutationLocks.current.add(nodeId);
    const sequence = (nodeMutationSequences.current.get(nodeId) ?? 0) + 1;
    nodeMutationSequences.current.set(nodeId, sequence);
    setNodePending(nodeId, true);
    clearMutationError(nodeId);

    try {
      const response = await updateCollapseMutation.mutateAsync({
        nodeId,
        input: { isCollapsed, revision: node.revision },
      });
      if (nodeMutationSequences.current.get(nodeId) !== sequence) return;
      replaceCachedNode(response.node);
      setCollapseOverrides((current) => {
        const next = { ...current };
        delete next[nodeId];
        return next;
      });
    } catch (error) {
      if (nodeMutationSequences.current.get(nodeId) !== sequence) return;
      if (error instanceof ApiClientError && error.status === 409) {
        await detail.refetch();
        setMutationErrors((current) => ({
          ...current,
          [nodeId]: {
            kind: "collapse",
            message: "다른 변경사항을 반영했습니다. 접기 상태 저장을 다시 시도해 주세요.",
          },
        }));
      } else {
        setMutationErrors((current) => ({
          ...current,
          [nodeId]: {
            kind: "collapse",
            message: error instanceof Error ? error.message : "접기 상태를 저장하지 못했습니다.",
          },
        }));
      }
    } finally {
      nodeMutationLocks.current.delete(nodeId);
      if (nodeMutationSequences.current.get(nodeId) === sequence) {
        setNodePending(nodeId, false);
      }
    }
  }, [clearMutationError, detail, replaceCachedNode, setNodePending, updateCollapseMutation]);

  const changeNodePositions = useCallback((changes: NodeChange<MindmapFlowNode>[]) => {
    if (!changes.some((change) => change.type === "position" && change.position)) return;
    setPositionOverrides((current) => {
      const next = { ...current };
      for (const change of changes) {
        if (change.type === "position" && change.position) {
          next[change.id] = change.position;
        }
      }
      return next;
    });
  }, []);

  const toggleCollapse = useCallback((nodeId: string) => {
    if (nodeMutationLocks.current.has(nodeId) || !parentNodeIds.has(nodeId)) return;
    const node = effectiveNodes.find((candidate) => candidate.id === nodeId);
    if (!node) return;
    const nextCollapsed = !node.isCollapsed;
    setCollapseOverrides((current) => ({ ...current, [nodeId]: nextCollapsed }));
    clearMutationError(nodeId);

    if (nextCollapsed && detail.data) {
      const descendants = getDescendantIds(detail.data.nodes, nodeId);
      if (selectedNodeId && descendants.has(selectedNodeId)) setSelectedNodeId(nodeId);
      if (editingNodeId && descendants.has(editingNodeId)) {
        setEditingNodeId(null);
        setEditDraft("");
        setEditError(null);
      }
    }
    void persistCollapse(nodeId, nextCollapsed);
  }, [clearMutationError, detail.data, editingNodeId, effectiveNodes, parentNodeIds, persistCollapse, selectedNodeId]);

  const retryNodeMutation = useCallback((nodeId: string) => {
    const error = mutationErrors[nodeId];
    if (!error) return;
    if (error.kind === "position") {
      const position = positionOverrides[nodeId];
      if (position) void persistPosition(nodeId, position);
      return;
    }
    const isCollapsed = collapseOverrides[nodeId];
    if (isCollapsed !== undefined) void persistCollapse(nodeId, isCollapsed);
  }, [collapseOverrides, mutationErrors, persistCollapse, persistPosition, positionOverrides]);

  const revertNodeMutation = useCallback((nodeId: string) => {
    const error = mutationErrors[nodeId];
    if (!error) return;
    if (error.kind === "position") {
      setPositionOverrides((current) => {
        const next = { ...current };
        delete next[nodeId];
        return next;
      });
    } else {
      setCollapseOverrides((current) => {
        const next = { ...current };
        delete next[nodeId];
        return next;
      });
    }
    clearMutationError(nodeId);
  }, [clearMutationError, mutationErrors]);

  if (detail.isPending && !detail.data) return <EditorLoadingState />;
  if (!detail.data) {
    return <EditorQueryError onRetry={() => void detail.refetch()} />;
  }

  return (
    <main className="flex h-screen min-h-[32rem] flex-col overflow-hidden bg-[var(--background)]">
      <EditorHeader title={detail.data.mindmap.title} refreshFailed={detail.isError} onRetry={() => void detail.refetch()} />
      <MindmapCanvas
        detail={{ ...detail.data, nodes: visibleNodes }}
        selectedNodeId={selectedNodeId}
        onSelectNode={setSelectedNodeId}
        editingNodeId={editingNodeId}
        editDraft={editDraft}
        editError={editError}
        savingNodeId={savingNodeId}
        creatingParentId={creatingParentId}
        childCreateError={childCreateError}
        pendingNodeIds={pendingNodeIds}
        parentNodeIds={parentNodeIds}
        mutationErrors={mutationErrors}
        onAddChild={(nodeId) => void addChild(nodeId)}
        onCancelEdit={cancelEdit}
        onChangeDraft={(value) => {
          setEditDraft(value);
          setEditError(null);
        }}
        onCommitEdit={() => void commitEdit()}
        onStartEdit={startEdit}
        onToggleCollapse={toggleCollapse}
        onRetryMutation={retryNodeMutation}
        onRevertMutation={revertNodeMutation}
        onNodesChange={changeNodePositions}
        onNodeDragStop={(nodeId, position) => void persistPosition(nodeId, position)}
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
  pendingNodeIds,
  parentNodeIds,
  mutationErrors,
  onAddChild,
  onCancelEdit,
  onChangeDraft,
  onCommitEdit,
  onStartEdit,
  onToggleCollapse,
  onRetryMutation,
  onRevertMutation,
  onNodesChange,
  onNodeDragStop,
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
  pendingNodeIds: ReadonlySet<string>;
  parentNodeIds: ReadonlySet<string>;
  mutationErrors: Readonly<Record<string, { kind: "position" | "collapse"; message: string }>>;
  onAddChild: (nodeId: string) => void;
  onCancelEdit: () => void;
  onChangeDraft: (value: string) => void;
  onCommitEdit: () => void;
  onStartEdit: (nodeId: string) => void;
  onToggleCollapse: (nodeId: string) => void;
  onRetryMutation: (nodeId: string) => void;
  onRevertMutation: (nodeId: string) => void;
  onNodesChange: (changes: NodeChange<MindmapFlowNode>[]) => void;
  onNodeDragStop: (nodeId: string, position: NodePosition) => void;
}) {
  const flow = useMemo(
    () => toMindmapFlow(detail, selectedNodeId, {
      editingNodeId,
      editDraft,
      editError,
      savingNodeId,
      creatingParentId,
      childCreateError,
      pendingNodeIds,
      nodesWithChildren: parentNodeIds,
      mutationErrors,
      onAddChild,
      onCancelEdit,
      onChangeDraft,
      onCommitEdit,
      onStartEdit,
      onToggleCollapse,
      onRetryMutation,
      onRevertMutation,
    }),
    [
      childCreateError,
      mutationErrors,
      onRetryMutation,
      onRevertMutation,
      onToggleCollapse,
      parentNodeIds,
      pendingNodeIds,
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
      data-nodes-draggable="true"
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
        onNodesChange={onNodesChange}
        onNodeDragStop={(_event, node) => onNodeDragStop(node.id, node.position)}
        onPaneClick={clearSelection}
        fitView
        fitViewOptions={fitViewOptions}
        minZoom={0.2}
        maxZoom={2}
        nodesDraggable
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
