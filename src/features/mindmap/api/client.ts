import type {
  CreateNodeInput,
  CreateNodeResponse,
  CreateMindmapResponse,
  MindmapDetailResponse,
  MindmapListResponse,
  NodeContentResponse,
  UpdateMindmapInput,
  UpdateMindmapResponse,
  UpdateNodeResponse,
  UpdateNodeCollapseInput,
  UpdateNodeContentInput,
  UpdateNodePositionInput,
  UpdateNodeTitleInput,
} from "./contracts";

export class ApiClientError extends Error {
  constructor(
    message: string,
    public readonly code = "UNKNOWN_ERROR",
    public readonly status = 0,
  ) {
    super(message);
    this.name = "ApiClientError";
  }
}

type ErrorEnvelope = { error?: { code?: string; message?: string } };

async function parseResponse<T>(response: Response): Promise<T> {
  const body = (await response.json().catch(() => ({}))) as T & ErrorEnvelope;
  if (!response.ok) {
    throw new ApiClientError(
      body.error?.message ?? "요청을 처리하지 못했습니다.",
      body.error?.code,
      response.status,
    );
  }
  return body;
}

export async function fetchMindmaps(): Promise<MindmapListResponse> {
  return parseResponse(await fetch("/api/mindmaps", { cache: "no-store" }));
}

export async function createMindmap(): Promise<CreateMindmapResponse> {
  return parseResponse(
    await fetch("/api/mindmaps", { method: "POST" }),
  );
}

export async function updateMindmap(
  mindmapId: string,
  input: UpdateMindmapInput,
): Promise<UpdateMindmapResponse> {
  return parseResponse(
    await fetch(`/api/mindmaps/${mindmapId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    }),
  );
}

export async function fetchMindmapDetail(
  mindmapId: string,
): Promise<MindmapDetailResponse> {
  return parseResponse(
    await fetch(`/api/mindmaps/${mindmapId}`, { cache: "no-store" }),
  );
}

export async function createNode(
  mindmapId: string,
  input: CreateNodeInput,
): Promise<CreateNodeResponse> {
  return parseResponse(
    await fetch(`/api/mindmaps/${mindmapId}/nodes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    }),
  );
}

export async function updateNodeTitle(
  nodeId: string,
  input: UpdateNodeTitleInput,
): Promise<UpdateNodeResponse> {
  return parseResponse(
    await fetch(`/api/nodes/${nodeId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    }),
  );
}

export async function updateNodePosition(
  nodeId: string,
  input: UpdateNodePositionInput,
): Promise<UpdateNodeResponse> {
  return parseResponse(
    await fetch(`/api/nodes/${nodeId}/position`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    }),
  );
}

export async function updateNodeCollapse(
  nodeId: string,
  input: UpdateNodeCollapseInput,
): Promise<UpdateNodeResponse> {
  return parseResponse(
    await fetch(`/api/nodes/${nodeId}/collapse`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    }),
  );
}

export async function fetchNodeContent(nodeId: string): Promise<NodeContentResponse> {
  return parseResponse(
    await fetch(`/api/nodes/${nodeId}/content`, { cache: "no-store" }),
  );
}

export async function updateNodeContent(
  nodeId: string,
  input: UpdateNodeContentInput,
): Promise<NodeContentResponse> {
  return parseResponse(
    await fetch(`/api/nodes/${nodeId}/content`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    }),
  );
}
