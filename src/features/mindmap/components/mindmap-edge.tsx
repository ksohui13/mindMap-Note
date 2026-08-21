"use client";

import { BaseEdge, getBezierPath, type EdgeProps } from "@xyflow/react";
import { memo } from "react";

import type { MindmapFlowEdge } from "@/features/mindmap/model/flow-adapter";

export const MindmapEdge = memo(function MindmapEdge(props: EdgeProps<MindmapFlowEdge>) {
  const [path] = getBezierPath(props);
  return <BaseEdge id={props.id} path={path} style={{ stroke: "#9b87e8", strokeWidth: 2 }} />;
});
