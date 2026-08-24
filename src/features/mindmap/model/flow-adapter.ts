import type { Edge, Node } from "@xyflow/react";

import type { MindmapDetailResponse } from "@/features/mindmap/api/contracts";

export type MindmapNodeData = {
  title: string;
  isRoot: boolean;
  isCollapsed: boolean;
  revision: number;
  isEditing?: boolean;
  editDraft?: string;
  editError?: string | null;
  isSaving?: boolean;
  isCreatingChild?: boolean;
  isInteractionDisabled?: boolean;
  isMutationPending?: boolean;
  hasChildren?: boolean;
  mutationError?: { kind: "position" | "collapse"; message: string } | null;
  childCreateError?: string | null;
  onAddChild?: (nodeId: string) => void;
  onOpenDetail?: (nodeId: string) => void;
  onCancelEdit?: () => void;
  onChangeDraft?: (value: string) => void;
  onCommitEdit?: () => void;
  onStartEdit?: (nodeId: string) => void;
  onToggleCollapse?: (nodeId: string) => void;
  onDelete?: (nodeId: string) => void;
  onExport?: (nodeId: string) => void;
  onRetryMutation?: (nodeId: string) => void;
  onRevertMutation?: (nodeId: string) => void;
};

export type MindmapFlowNode = Node<MindmapNodeData, "mindmap">;
export type MindmapFlowEdge = Edge<Record<string, never>, "mindmap">;

export function toMindmapFlow(
  detail: MindmapDetailResponse,
  selectedNodeId: string | null,
  interaction?: Readonly<{
    editingNodeId: string | null;
    editDraft: string;
    editError: string | null;
    savingNodeId: string | null;
    creatingParentId: string | null;
    childCreateError: { parentNodeId: string; message: string } | null;
    pendingNodeIds: ReadonlySet<string>;
    nodesWithChildren: ReadonlySet<string>;
    mutationErrors: Readonly<Record<string, { kind: "position" | "collapse"; message: string }>>;
    onAddChild: (nodeId: string) => void;
    onOpenDetail: (nodeId: string) => void;
    onCancelEdit: () => void;
    onChangeDraft: (value: string) => void;
    onCommitEdit: () => void;
    onStartEdit: (nodeId: string) => void;
    onToggleCollapse: (nodeId: string) => void;
    onDelete: (nodeId: string) => void;
    onExport: (nodeId: string) => void;
    onRetryMutation: (nodeId: string) => void;
    onRevertMutation: (nodeId: string) => void;
  }>,
): { nodes: MindmapFlowNode[]; edges: MindmapFlowEdge[] } {
  return {
    nodes: detail.nodes.map((node) => ({
      id: node.id,
      type: "mindmap",
      position: { x: node.x, y: node.y },
      selected: node.id === selectedNodeId,
      draggable: Boolean(
        interaction &&
          interaction.editingNodeId !== node.id &&
          interaction.savingNodeId !== node.id &&
          interaction.creatingParentId === null &&
          !interaction.pendingNodeIds.has(node.id),
      ),
      connectable: false,
      deletable: false,
      ariaLabel: `${node.id === detail.rootNodeId ? "루트 노드" : "노드"}: ${node.title}`,
      data: {
        title: node.title,
        isRoot: node.id === detail.rootNodeId,
        isCollapsed: node.isCollapsed,
        revision: node.revision,
        isEditing: interaction?.editingNodeId === node.id,
        editDraft: interaction?.editingNodeId === node.id ? interaction.editDraft : undefined,
        editError: interaction?.editingNodeId === node.id ? interaction.editError : null,
        isSaving: interaction?.savingNodeId === node.id,
        isCreatingChild: interaction?.creatingParentId === node.id,
        isMutationPending: interaction?.pendingNodeIds.has(node.id),
        hasChildren: interaction?.nodesWithChildren.has(node.id),
        mutationError: interaction?.mutationErrors[node.id] ?? null,
        isInteractionDisabled: Boolean(
          interaction &&
            (
              interaction.savingNodeId !== null ||
              interaction.creatingParentId !== null ||
              interaction.pendingNodeIds.has(node.id)
            ),
        ),
        childCreateError:
          interaction?.childCreateError?.parentNodeId === node.id
            ? interaction.childCreateError.message
            : null,
        onAddChild: interaction?.onAddChild,
        onOpenDetail: interaction?.onOpenDetail,
        onCancelEdit: interaction?.onCancelEdit,
        onChangeDraft: interaction?.onChangeDraft,
        onCommitEdit: interaction?.onCommitEdit,
        onStartEdit: interaction?.onStartEdit,
        onToggleCollapse: interaction?.onToggleCollapse,
        onDelete: interaction?.onDelete,
        onExport: interaction?.onExport,
        onRetryMutation: interaction?.onRetryMutation,
        onRevertMutation: interaction?.onRevertMutation,
      },
    })),
    edges: detail.nodes.flatMap((node) =>
      node.parentNodeId === null
        ? []
        : [{
            id: `edge:${node.parentNodeId}:${node.id}`,
            type: "mindmap" as const,
            source: node.parentNodeId,
            target: node.id,
            selectable: false,
            focusable: false,
            deletable: false,
            data: {},
          }],
    ),
  };
}
