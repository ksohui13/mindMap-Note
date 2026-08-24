export const DRAFT_JOURNAL_VERSION = 1 as const;
const DRAFT_KEY_PREFIX = "mindmap:draft:v1:";

export type DraftJournalEntry = Readonly<{
  version: typeof DRAFT_JOURNAL_VERSION;
  mindmapId: string;
  nodeId: string;
  contentMd: string;
  baseRevision: number;
  updatedAt: string;
}>;

type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;
export type JournalWriteResult = { ok: true } | { ok: false; error: string };

export function draftJournalKey(mindmapId: string, nodeId: string): string {
  return `${DRAFT_KEY_PREFIX}${mindmapId}:${nodeId}`;
}

export function createDraftJournalEntry(
  mindmapId: string,
  nodeId: string,
  contentMd: string,
  baseRevision: number,
  now = new Date(),
): DraftJournalEntry {
  return {
    version: DRAFT_JOURNAL_VERSION,
    mindmapId,
    nodeId,
    contentMd,
    baseRevision,
    updatedAt: now.toISOString(),
  };
}

export function readDraftJournal(
  storage: StorageLike | null,
  mindmapId: string,
  nodeId: string,
): DraftJournalEntry | null {
  if (!storage) return null;
  const key = draftJournalKey(mindmapId, nodeId);
  try {
    const raw = storage.getItem(key);
    if (raw === null) return null;
    const value = JSON.parse(raw) as Partial<DraftJournalEntry>;
    if (
      value.version !== DRAFT_JOURNAL_VERSION ||
      value.mindmapId !== mindmapId ||
      value.nodeId !== nodeId ||
      typeof value.contentMd !== "string" ||
      !Number.isInteger(value.baseRevision) ||
      (value.baseRevision ?? -1) < 0 ||
      typeof value.updatedAt !== "string" ||
      !Number.isFinite(Date.parse(value.updatedAt))
    ) {
      tryRemove(storage, key);
      return null;
    }
    return value as DraftJournalEntry;
  } catch {
    tryRemove(storage, key);
    return null;
  }
}

export function writeDraftJournal(
  storage: StorageLike | null,
  entry: DraftJournalEntry,
): JournalWriteResult {
  if (!storage) return { ok: false, error: "로컬 초안 보호에 실패했습니다." };
  try {
    storage.setItem(draftJournalKey(entry.mindmapId, entry.nodeId), JSON.stringify(entry));
    return { ok: true };
  } catch {
    return { ok: false, error: "로컬 초안 보호에 실패했습니다." };
  }
}

export function removeDraftJournal(
  storage: StorageLike | null,
  mindmapId: string,
  nodeId: string,
): void {
  if (!storage) return;
  try {
    storage.removeItem(draftJournalKey(mindmapId, nodeId));
  } catch {
    // Network autosave remains available even when storage is unavailable.
  }
}

export function removeMindmapDraftJournals(
  storage: Storage | null,
  mindmapId: string,
): void {
  if (!storage) return;
  const prefix = `${DRAFT_KEY_PREFIX}${mindmapId}:`;
  try {
    const keys: string[] = [];
    for (let index = 0; index < storage.length; index += 1) {
      const key = storage.key(index);
      if (key?.startsWith(prefix)) keys.push(key);
    }
    for (const key of keys) tryRemove(storage, key);
  } catch {
    // Server deletion must not fail because browser storage is unavailable.
  }
}

export function listMindmapDraftJournals(
  storage: Storage | null,
  mindmapId: string,
): DraftJournalEntry[] {
  if (!storage) return [];
  const prefix = `${DRAFT_KEY_PREFIX}${mindmapId}:`;
  try {
    const nodeIds: string[] = [];
    for (let index = 0; index < storage.length; index += 1) {
      const key = storage.key(index);
      if (key?.startsWith(prefix)) nodeIds.push(key.slice(prefix.length));
    }
    return nodeIds.flatMap((nodeId) => {
      const entry = readDraftJournal(storage, mindmapId, nodeId);
      return entry ? [entry] : [];
    });
  } catch {
    return [];
  }
}

function tryRemove(storage: StorageLike, key: string): void {
  try {
    storage.removeItem(key);
  } catch {
    // Invalid records remain harmless when storage cannot be changed.
  }
}
