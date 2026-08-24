"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export function MarkdownPreview({ content }: { content: string }) {
  if (!content.trim()) {
    return (
      <p className="text-sm text-[var(--muted)]">
        미리보기할 Markdown 내용이 없습니다.
      </p>
    );
  }

  return (
    <div className="markdown-preview break-words text-sm leading-7">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
    </div>
  );
}
