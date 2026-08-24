"use client";

import type { SaveRecord } from "@/features/mindmap/model/save-state";

const labels: Readonly<Record<SaveRecord["phase"], string>> = {
  idle: "서버와 동기화됨",
  dirty: "저장 대기 중",
  saving: "저장 중…",
  saved: "저장 완료",
  failed: "저장 실패",
};

export function SaveStatus({
  record,
  onRetry,
  compact = false,
}: {
  record: SaveRecord;
  onRetry?: () => void;
  compact?: boolean;
}) {
  const failed = record.phase === "failed";
  const tone = failed
    ? "bg-red-50 text-[var(--danger)]"
    : record.phase === "dirty"
      ? "bg-amber-50 text-amber-800"
      : record.phase === "saving"
        ? "bg-blue-50 text-blue-700"
        : "bg-emerald-50 text-[var(--success)]";
  return (
    <div
      role={failed ? "alert" : "status"}
      className={`flex items-center gap-2 font-bold ${compact ? "text-xs" : "rounded-full px-3 py-1.5 text-xs"} ${tone}`}
    >
      <span>{failed && record.error ? `${labels.failed} · ${record.error}` : labels[record.phase]}</span>
      {failed && record.retryable && onRetry ? (
        <button type="button" onClick={onRetry} className="underline">다시 시도</button>
      ) : null}
    </div>
  );
}
