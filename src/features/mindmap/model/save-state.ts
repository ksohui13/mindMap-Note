import { ApiClientError } from "@/features/mindmap/api/client";

export type SaveKind = "title" | "position" | "collapse" | "content";
export type SavePhase = "idle" | "dirty" | "saving" | "saved" | "failed";

export type SaveRecord = Readonly<{
  phase: SavePhase;
  error?: string;
  retryable?: boolean;
}>;

export const idleSaveRecord: SaveRecord = { phase: "idle" };

const phasePriority: Readonly<Record<SavePhase, number>> = {
  idle: 0,
  saved: 1,
  dirty: 2,
  saving: 3,
  failed: 4,
};

export function aggregateSaveRecords(records: readonly SaveRecord[]): SaveRecord {
  return records.reduce<SaveRecord>(
    (current, candidate) => {
      const priority = phasePriority[candidate.phase] - phasePriority[current.phase];
      if (priority > 0) return candidate;
      if (
        priority === 0 &&
        candidate.phase === "failed" &&
        candidate.retryable &&
        !current.retryable
      ) return candidate;
      return current;
    },
    idleSaveRecord,
  );
}

export function isRetryableSaveError(error: unknown): boolean {
  if (!(error instanceof ApiClientError)) return true;
  return error.status === 0 || error.status === 408 || error.status === 429 || error.status >= 500;
}

export function saveRecordKey(nodeId: string, kind: SaveKind): string {
  return `${nodeId}:${kind}`;
}
