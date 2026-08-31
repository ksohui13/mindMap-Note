"use client";

import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type RefObject,
  type PointerEvent as ReactPointerEvent,
} from "react";

import { MarkdownPreview } from "@/features/mindmap/components/markdown-preview";
import { useNodeContent } from "@/features/mindmap/hooks/use-node-content";
import type { DraftJournalEntry } from "@/features/mindmap/lib/draft-journal";
import type { SaveRecord } from "@/features/mindmap/model/save-state";
import { SaveStatus } from "@/shared/ui/save-status";

type DetailTab = "edit" | "preview";

type NodeDetailProps = {
  nodeId: string;
  title: string;
  content: ReturnType<typeof useNodeContent>;
  draft: string | undefined;
  onChangeDraft: (nodeId: string, value: string) => void;
  onClose: () => void;
  onOpenFullscreen: () => void;
  fullscreenButtonRef: RefObject<HTMLButtonElement | null>;
  saveRecord: SaveRecord;
  onRetrySave: () => void;
  onSave: () => void;
  recovery?: DraftJournalEntry;
  onApplyRecovery: () => void;
  onDiscardRecovery: () => void;
  storageWarning: string | null;
};

export function NodeDetailPanel(props: NodeDetailProps) {
  const [tab, setTab] = useState<DetailTab>("edit");
  const [panelWidth, setPanelWidth] = useState(416);
  const resizeStart = useRef<{ x: number; width: number } | null>(null);
  const content = props.content;
  const effectiveDraft = props.draft ?? content.data?.node.contentMd;

  function startResize(event: ReactPointerEvent<HTMLButtonElement>) {
    resizeStart.current = { x: event.clientX, width: panelWidth };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function resizeBy(delta: number) {
    const maxWidth = Math.max(320, Math.min(720, window.innerWidth - 64));
    setPanelWidth((current) => Math.min(maxWidth, Math.max(320, current + delta)));
  }

  return (
    <aside
      aria-label="노드 상세 패널"
      style={{ "--detail-panel-width": `${panelWidth}px` } as CSSProperties}
      onPointerMove={(event) => {
        if (!resizeStart.current) return;
        const nextWidth = resizeStart.current.width + resizeStart.current.x - event.clientX;
        const maxWidth = Math.max(320, Math.min(720, window.innerWidth - 64));
        setPanelWidth(Math.min(maxWidth, Math.max(320, nextWidth)));
      }}
      onPointerUp={() => { resizeStart.current = null; }}
      className="absolute inset-y-0 right-0 z-20 flex w-full max-w-full flex-col border-l border-[var(--border)] bg-white shadow-2xl sm:w-[var(--detail-panel-width)]"
    >
      <button
        type="button"
        role="separator"
        aria-label="노드 상세 패널 너비 조절"
        aria-orientation="vertical"
        aria-valuemin={320}
        aria-valuemax={720}
        aria-valuenow={panelWidth}
        onPointerDown={startResize}
        onKeyDown={(event) => {
          if (event.key === "ArrowLeft") resizeBy(16);
          if (event.key === "ArrowRight") resizeBy(-16);
        }}
        className="group absolute inset-y-0 left-0 z-10 hidden w-2 -translate-x-1/2 cursor-col-resize touch-none sm:block"
      >
        <span className="absolute inset-y-0 left-1/2 w-px bg-transparent transition group-hover:bg-violet-300" />
      </button>
      <DetailHeader
        title={props.title}
        onClose={props.onClose}
        onOpenFullscreen={props.onOpenFullscreen}
        fullscreenButtonRef={props.fullscreenButtonRef}
      />
      <DetailTabs active={tab} onChange={setTab} />
      <div className="min-h-0 flex-1 overflow-auto p-4">
        {props.recovery ? (
          <RecoveryPrompt
            recovery={props.recovery}
            onApply={props.onApplyRecovery}
            onDiscard={props.onDiscardRecovery}
          />
        ) : (
          <DetailContent
            content={content}
            draft={effectiveDraft}
            nodeId={props.nodeId}
            mode={tab}
            onChangeDraft={props.onChangeDraft}
          />
        )}
      </div>
      <DraftStatus
        record={props.saveRecord}
        onRetry={props.onRetrySave}
        onSave={props.onSave}
        storageWarning={props.storageWarning}
      />
    </aside>
  );
}

export function NodeDetailFullscreen({
  nodeId,
  title,
  draft,
  onChangeDraft,
  onClose,
  content,
  saveRecord,
  onRetrySave,
  onSave,
  recovery,
  onApplyRecovery,
  onDiscardRecovery,
  storageWarning,
}: Omit<NodeDetailProps, "onOpenFullscreen" | "fullscreenButtonRef">) {
  const effectiveDraft = draft ?? content.data?.node.contentMd;
  const [mobileTab, setMobileTab] = useState<DetailTab>("edit");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    textareaRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [content.data, onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${title} 상세 전체화면`}
      className="fixed inset-0 z-50 flex flex-col bg-[var(--background)]"
    >
      <header className="flex min-h-16 items-center gap-4 border-b border-[var(--border)] bg-white px-4 sm:px-6">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold text-[var(--primary)]">노드 상세</p>
          <h2 className="truncate text-lg font-extrabold">{title}</h2>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm font-bold hover:border-[var(--primary)] hover:text-[var(--primary)]"
        >
          전체화면 종료
        </button>
      </header>
      <div className="border-b border-[var(--border)] bg-white p-2 md:hidden">
        <DetailTabs active={mobileTab} onChange={setMobileTab} />
      </div>
      <div className="grid min-h-0 flex-1 md:grid-cols-2">
        {recovery ? (
          <div className="col-span-full grid place-items-center p-6">
            <RecoveryPrompt
              recovery={recovery}
              onApply={onApplyRecovery}
              onDiscard={onDiscardRecovery}
            />
          </div>
        ) : (
          <>
        <section
          aria-label="Markdown 편집기"
          className={`${mobileTab === "edit" ? "flex" : "hidden"} min-h-0 flex-col border-r border-[var(--border)] bg-white p-4 md:flex`}
        >
          <DetailContent
            content={content}
            draft={effectiveDraft}
            nodeId={nodeId}
            mode="edit"
            onChangeDraft={onChangeDraft}
            textareaRef={textareaRef}
          />
        </section>
        <section
          aria-label="Markdown 미리보기"
          className={`${mobileTab === "preview" ? "block" : "hidden"} min-h-0 overflow-auto p-6 md:block`}
        >
          <DetailContent
            content={content}
            draft={effectiveDraft}
            nodeId={nodeId}
            mode="preview"
            onChangeDraft={onChangeDraft}
          />
        </section>
          </>
        )}
      </div>
      <DraftStatus record={saveRecord} onRetry={onRetrySave} onSave={onSave} storageWarning={storageWarning} />
    </div>
  );
}

function DetailHeader({
  title,
  onClose,
  onOpenFullscreen,
  fullscreenButtonRef,
}: Pick<NodeDetailProps, "title" | "onClose" | "onOpenFullscreen" | "fullscreenButtonRef">) {
  return (
    <header className="flex items-center gap-3 border-b border-[var(--border)] p-4">
      <div className="min-w-0 flex-1">
        <p className="text-xs font-bold text-[var(--primary)]">노드 상세</p>
        <h2 className="truncate font-extrabold">{title}</h2>
      </div>
      <button
        ref={fullscreenButtonRef}
        type="button"
        aria-label="상세 전체화면 열기"
        onClick={onOpenFullscreen}
        className="rounded-lg border border-[var(--border)] px-2.5 py-2 text-xs font-bold hover:border-[var(--primary)] hover:text-[var(--primary)]"
      >
        전체화면
      </button>
      <button
        type="button"
        aria-label="상세 패널 닫기"
        onClick={onClose}
        className="grid size-9 place-items-center rounded-lg text-lg font-bold hover:bg-violet-50"
      >
        ×
      </button>
    </header>
  );
}

function DetailTabs({ active, onChange }: { active: DetailTab; onChange: (tab: DetailTab) => void }) {
  return (
    <div role="tablist" aria-label="상세 보기 방식" className="flex gap-1 border-b border-[var(--border)] p-2">
      {(["edit", "preview"] as const).map((tab) => (
        <button
          key={tab}
          type="button"
          role="tab"
          aria-selected={active === tab}
          onClick={() => onChange(tab)}
          className={`flex-1 rounded-lg px-3 py-2 text-sm font-bold ${active === tab ? "bg-violet-100 text-[var(--primary)]" : "text-[var(--muted)] hover:bg-violet-50"}`}
        >
          {tab === "edit" ? "편집" : "미리보기"}
        </button>
      ))}
    </div>
  );
}

function DetailContent({
  content,
  draft,
  nodeId,
  mode,
  onChangeDraft,
  textareaRef,
}: {
  content: ReturnType<typeof useNodeContent>;
  draft: string | undefined;
  nodeId: string;
  mode: DetailTab;
  onChangeDraft: (nodeId: string, value: string) => void;
  textareaRef?: RefObject<HTMLTextAreaElement | null>;
}) {
  if (content.isError) {
    return (
      <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-[var(--danger)]">
        <p className="font-bold">노드 상세를 불러오지 못했습니다.</p>
        <button type="button" onClick={() => void content.refetch()} className="mt-2 underline">다시 시도</button>
      </div>
    );
  }
  if (content.isPending || draft === undefined) {
    return <div aria-label="노드 상세 불러오는 중" className="h-32 animate-pulse rounded-xl bg-violet-50" />;
  }
  if (mode === "preview") return <MarkdownPreview content={draft} />;

  return (
    <textarea
      ref={textareaRef}
      aria-label="Markdown 내용"
      value={draft}
      onChange={(event) => onChangeDraft(nodeId, event.target.value)}
      placeholder="이 노드에 대한 상세 내용을 Markdown으로 작성하세요."
      className="min-h-72 w-full flex-1 resize-none rounded-xl border border-[var(--border)] bg-white p-4 font-mono text-sm leading-6 outline-none focus:border-[var(--primary)] focus:ring-4 focus:ring-violet-100"
    />
  );
}

function DraftStatus({
  record,
  onRetry,
  onSave,
  storageWarning,
}: {
  record: SaveRecord;
  onRetry: () => void;
  onSave: () => void;
  storageWarning: string | null;
}) {
  return (
    <footer className="flex items-center gap-3 border-t border-[var(--border)] bg-white px-4 py-2">
      <div className="min-w-0 flex-1"><SaveStatus record={record} onRetry={onRetry} compact /></div>
      <button
        type="button"
        disabled={record.phase === "saving"}
        onClick={onSave}
        className="rounded-lg bg-[var(--primary)] px-3 py-1.5 text-xs font-extrabold text-white disabled:cursor-wait disabled:opacity-60"
      >
        {record.phase === "saving" ? "저장 중…" : "저장"}
      </button>
      {storageWarning ? <p role="alert" className="mt-1 text-xs font-bold text-[var(--danger)]">{storageWarning}</p> : null}
    </footer>
  );
}

function RecoveryPrompt({
  recovery,
  onApply,
  onDiscard,
}: {
  recovery: DraftJournalEntry;
  onApply: () => void;
  onDiscard: () => void;
}) {
  return (
    <div role="alert" className="w-full max-w-lg rounded-xl border border-amber-300 bg-amber-50 p-5 text-sm text-amber-950">
      <h3 className="font-extrabold">저장되지 않은 로컬 초안이 있습니다</h3>
      <p className="mt-2 text-xs">{new Date(recovery.updatedAt).toLocaleString("ko-KR")}에 작성한 초안을 복구할지 선택해 주세요.</p>
      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" onClick={onApply} className="rounded-lg bg-amber-900 px-3 py-2 font-bold text-white">초안 적용</button>
        <button type="button" onClick={onDiscard} className="rounded-lg border border-amber-400 bg-white px-3 py-2 font-bold">서버본 사용</button>
      </div>
    </div>
  );
}
