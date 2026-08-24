import { ApiClientError } from "@/features/mindmap/api/client";
import type { ExportMindmapInput } from "@/features/mindmap/api/contracts";

type ErrorEnvelope = {
  error?: { code?: string; message?: string };
};

export async function downloadMindmapExport(
  mindmapId: string,
  input: ExportMindmapInput,
): Promise<{ filename: string }> {
  const response = await fetch(`/api/mindmaps/${mindmapId}/export`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({})) as ErrorEnvelope;
    throw new ApiClientError(
      body.error?.message ?? "Markdown 파일을 생성하지 못했습니다.",
      body.error?.code,
      response.status,
    );
  }

  const filename = parseDownloadFilename(response.headers.get("Content-Disposition"))
    ?? "mindmap-export.md";
  triggerBlobDownload(await response.blob(), filename);
  return { filename };
}

export function parseDownloadFilename(contentDisposition: string | null): string | null {
  if (!contentDisposition) return null;
  const encoded = contentDisposition.match(/filename\*=UTF-8''([^;]+)/i)?.[1];
  if (encoded) {
    try {
      return decodeURIComponent(encoded);
    } catch {
      return null;
    }
  }
  return contentDisposition.match(/filename="([^"]+)"/i)?.[1] ?? null;
}

export function triggerBlobDownload(blob: Blob, filename: string): void {
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = filename;
  anchor.hidden = true;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
}
