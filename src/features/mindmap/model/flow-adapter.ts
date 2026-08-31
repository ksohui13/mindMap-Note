import type { Edge, Node } from "@xyflow/react";

import type { MindmapDetailResponse } from "@/features/mindmap/api/contracts";

export type MindmapNodeData = {
  title: string;
  isRoot: boolean;
  isCollapsed: boolean;
  revision: number;
  isEditing?: boolean;
  editError?: string | null;
  isSaving?: boolean;
  isCreatingChild?: boolean;
  isInteractionDisabled?: boolean;
  isMutationPending?: boolean;
  hasChildren?: boolean;
  mutationError?: { kind: "position" | "collapse"; message: string } | null;
  childCreateError?: string | null;
  creationError?: string | null;
  onAddChild?: (nodeId: string) => void;
  onOpenDetail?: (nodeId: string) => void;
  onCancelEdit?: () => void;
  onCommitEdit?: (nodeId: string, title: string) => void;
  onStartEdit?: (nodeId: string) => void;
  onToggleCollapse?: (nodeId: string) => void;
  onDelete?: (nodeId: string) => void;
  onExport?: (nodeId: string) => void;
  onRetryMutation?: (nodeId: string) => void;
  onRevertMutation?: (nodeId: string) => void;
  onRetryCreate?: (nodeId: string) => void;
  onDiscardCreate?: (nodeId: string) => void;
};

export type MindmapFlowNode = Node<MindmapNodeData, "mindmap">;
export type MindmapFlowEdge = Edge<Record<string, never>, "mindmap">;

export function toMindmapFlow(
  detail: MindmapDetailResponse,
  selectedNodeId: string | null,
  interaction?: Readonly<{
    editingNodeId: string | null;
    editError: string | null;
    savingNodeIds: ReadonlySet<string>;
    creatingNodeIds: ReadonlySet<string>;
    childCreateError: { parentNodeId: string; message: string } | null;
    creationErrors: Readonly<Record<string, string>>;
    pendingNodeIds: ReadonlySet<string>;
    nodesWithChildren: ReadonlySet<string>;
    mutationErrors: Readonly<Record<string, { kind: "position" | "collapse"; message: string }>>;
    onAddChild: (nodeId: string) => void;
    onOpenDetail: (nodeId: string) => void;
    onCancelEdit: () => void;
    onCommitEdit: (nodeId: string, title: string) => void;
    onStartEdit: (nodeId: string) => void;
    onToggleCollapse: (nodeId: string) => void;
    onDelete: (nodeId: string) => void;
    onExport: (nodeId: string) => void;
    onRetryMutation: (nodeId: string) => void;
    onRevertMutation: (nodeId: string) => void;
    onRetryCreate: (nodeId: string) => void;
    onDiscardCreate: (nodeId: string) => void;
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
          !interaction.savingNodeIds.has(node.id) &&
          !interaction.creatingNodeIds.has(node.id) &&
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
        editError: interaction?.editingNodeId === node.id ? interaction.editError : null,
        isSaving: interaction?.savingNodeIds.has(node.id),
        isCreatingChild: false,
        isMutationPending: interaction?.pendingNodeIds.has(node.id),
        hasChildren: interaction?.nodesWithChildren.has(node.id),
        mutationError: interaction?.mutationErrors[node.id] ?? null,
        isInteractionDisabled: Boolean(
          interaction &&
            (
              interaction.savingNodeIds.has(node.id) ||
              interaction.pendingNodeIds.has(node.id)
            ),
        ),
        childCreateError:
          interaction?.childCreateError?.parentNodeId === node.id
            ? interaction.childCreateError.message
            : null,
        creationError: interaction?.creationErrors[node.id] ?? null,
        onAddChild: interaction?.onAddChild,
        onOpenDetail: interaction?.onOpenDetail,
        onCancelEdit: interaction?.onCancelEdit,
        onCommitEdit: interaction?.onCommitEdit,
        onStartEdit: interaction?.onStartEdit,
        onToggleCollapse: interaction?.onToggleCollapse,
        onDelete: interaction?.onDelete,
        onExport: interaction?.onExport,
        onRetryMutation: interaction?.onRetryMutation,
        onRevertMutation: interaction?.onRevertMutation,
        onRetryCreate: interaction?.onRetryCreate,
        onDiscardCreate: interaction?.onDiscardCreate,
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
