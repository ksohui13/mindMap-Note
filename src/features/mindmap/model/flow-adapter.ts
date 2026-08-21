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
  childCreateError?: string | null;
  onAddChild?: (nodeId: string) => void;
  onCancelEdit?: () => void;
  onChangeDraft?: (value: string) => void;
  onCommitEdit?: () => void;
  onStartEdit?: (nodeId: string) => void;
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
    onAddChild: (nodeId: string) => void;
    onCancelEdit: () => void;
    onChangeDraft: (value: string) => void;
    onCommitEdit: () => void;
    onStartEdit: (nodeId: string) => void;
  }>,
): { nodes: MindmapFlowNode[]; edges: MindmapFlowEdge[] } {
  return {
    nodes: detail.nodes.map((node) => ({
      id: node.id,
      type: "mindmap",
      position: { x: node.x, y: node.y },
      selected: node.id === selectedNodeId,
      draggable: false,
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
        isInteractionDisabled: Boolean(
          interaction &&
            (interaction.savingNodeId !== null || interaction.creatingParentId !== null),
        ),
        childCreateError:
          interaction?.childCreateError?.parentNodeId === node.id
            ? interaction.childCreateError.message
            : null,
        onAddChild: interaction?.onAddChild,
        onCancelEdit: interaction?.onCancelEdit,
        onChangeDraft: interaction?.onChangeDraft,
        onCommitEdit: interaction?.onCommitEdit,
        onStartEdit: interaction?.onStartEdit,
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
