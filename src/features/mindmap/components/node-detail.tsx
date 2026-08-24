"use client";

import {
  useEffect,
  useRef,
  useState,
  type RefObject,
} from "react";

import { MarkdownPreview } from "@/features/mindmap/components/markdown-preview";
import { useNodeContent } from "@/features/mindmap/hooks/use-node-content";

type DetailTab = "edit" | "preview";

type NodeDetailProps = {
  nodeId: string;
  title: string;
  draft: string | undefined;
  onChangeDraft: (nodeId: string, value: string) => void;
  onClose: () => void;
  onOpenFullscreen: () => void;
  fullscreenButtonRef: RefObject<HTMLButtonElement | null>;
};

export function NodeDetailPanel(props: NodeDetailProps) {
  const [tab, setTab] = useState<DetailTab>("edit");
  const content = useNodeContent(props.nodeId);
  const effectiveDraft = props.draft ?? content.data?.node.contentMd;

  return (
    <aside
      aria-label="노드 상세 패널"
      className="absolute inset-y-0 right-0 z-20 flex w-full max-w-md flex-col border-l border-[var(--border)] bg-white shadow-2xl sm:w-[26rem]"
    >
      <DetailHeader
        title={props.title}
        onClose={props.onClose}
        onOpenFullscreen={props.onOpenFullscreen}
        fullscreenButtonRef={props.fullscreenButtonRef}
      />
      <DetailTabs active={tab} onChange={setTab} />
      <div className="min-h-0 flex-1 overflow-auto p-4">
        <DetailContent
          content={content}
          draft={effectiveDraft}
          nodeId={props.nodeId}
          mode={tab}
          onChangeDraft={props.onChangeDraft}
        />
      </div>
      <DraftStatus draft={effectiveDraft} serverContent={content.data?.node.contentMd} />
    </aside>
  );
}

export function NodeDetailFullscreen({
  nodeId,
  title,
  draft,
  onChangeDraft,
  onClose,
}: Omit<NodeDetailProps, "onOpenFullscreen" | "fullscreenButtonRef">) {
  const content = useNodeContent(nodeId);
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
      </div>
      <DraftStatus draft={effectiveDraft} serverContent={content.data?.node.contentMd} />
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

function DraftStatus({ draft, serverContent }: { draft: string | undefined; serverContent: string | undefined }) {
  const dirty = draft !== undefined && serverContent !== undefined && draft !== serverContent;
  return (
    <footer role="status" className="border-t border-[var(--border)] bg-white px-4 py-2 text-xs font-bold text-[var(--muted)]">
      {dirty ? "임시 초안 · 자동저장은 09단계에서 연결됩니다." : "서버에서 불러온 내용"}
    </footer>
  );
}
