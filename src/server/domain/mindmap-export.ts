import type { ExportScope } from "@/features/mindmap/api/contracts";

export type ExportDocumentNode = Readonly<{
  id: string;
  parentNodeId: string | null;
  title: string;
  contentMd: string;
  path: readonly string[];
  depth: number;
}>;

const SCOPE_LABELS: Readonly<Record<ExportScope, string>> = {
  ALL: "전체 마인드맵",
  NODE: "현재 노드",
  SUBTREE: "현재 노드 + 모든 하위 개념",
};

export function renderMindmapMarkdown({
  mindmapTitle,
  scope,
  targetNodeTitle,
  nodes,
}: {
  mindmapTitle: string;
  scope: ExportScope;
  targetNodeTitle?: string;
  nodes: readonly ExportDocumentNode[];
}): string {
  const header = [
    `# ${escapeMarkdownText(mindmapTitle)}`,
    "",
    `> 내보내기 범위: ${SCOPE_LABELS[scope]}`,
    ...(targetNodeTitle === undefined
      ? []
      : [`> 기준 노드: ${escapeMarkdownText(targetNodeTitle)}`]),
    "",
    "## 개념 트리",
    "",
    ...nodes.map((node) => `${"  ".repeat(node.depth)}- ${escapeMarkdownText(node.title)}`),
    "",
    "## 노드 상세",
    "",
  ].join("\n");

  const details = nodes.map((node, index) => [
    `### ${index + 1}. ${escapeMarkdownText(node.title)}`,
    `> 경로: ${node.path.map(escapeMarkdownText).join(" › ")}`,
    node.contentMd.length > 0 ? node.contentMd : "_(상세 Markdown 없음)_",
  ].join("\n\n"));

  const body = `${header}${details.join("\n\n---\n\n")}`;
  return body.endsWith("\n") ? body : `${body}\n`;
}

export function buildExportFilename(mindmapTitle: string, scope: ExportScope): string {
  return `${sanitizeFilenamePart(mindmapTitle)}-${scope.toLowerCase()}.md`;
}

export function buildContentDisposition(filename: string): string {
  const encoded = encodeURIComponent(filename).replace(/[!'()*]/g, (character) =>
    `%${character.charCodeAt(0).toString(16).toUpperCase()}`);
  return `attachment; filename="mindmap-export.md"; filename*=UTF-8''${encoded}`;
}

export function sanitizeFilenamePart(value: string): string {
  const normalized = value
    .normalize("NFKC")
    .replace(/[\u0000-\u001f\u007f<>:"/\\|?*]/g, "-")
    .replace(/\s+/g, " ")
    .replace(/-+/g, "-")
    .replace(/^[ .-]+|[ .-]+$/g, "");
  const truncated = [...normalized].slice(0, 96).join("").replace(/[ .-]+$/g, "");
  if (!truncated) return "mindmap";
  if (/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(truncated)) {
    return `_${truncated}`;
  }
  return truncated;
}

function escapeMarkdownText(value: string): string {
  return value
    .replace(/[\r\n\t]+/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim()
    .replace(/([\\`*_[\]{}()#+\-.!|>])/g, "\\$1");
}
