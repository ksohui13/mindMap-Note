import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { MarkdownPreview } from "@/features/mindmap/components/markdown-preview";

describe("MarkdownPreview", () => {
  it("renders common Markdown and GFM features", () => {
    const { container } = render(
      <MarkdownPreview content={[
        "# 제목",
        "",
        "- 목록",
        "",
        "~~취소~~",
        "",
        "| 열 | 값 |",
        "| --- | --- |",
        "| A | B |",
        "",
        "```ts",
        "const value = 1;",
        "```",
        "",
        "[링크](https://example.com)",
      ].join("\n")} />,
    );

    expect(screen.getByRole("heading", { name: "제목" })).toBeInTheDocument();
    expect(screen.getByRole("list")).toBeInTheDocument();
    expect(container.querySelector("del")).toHaveTextContent("취소");
    expect(screen.getByRole("table")).toBeInTheDocument();
    expect(container.querySelector("pre code")).toHaveTextContent("const value = 1;");
    expect(screen.getByRole("link", { name: "링크" })).toHaveAttribute("href", "https://example.com");
  });

  it("does not execute or mount raw HTML", () => {
    const { container } = render(
      <MarkdownPreview content={'<script>window.__unsafe = true</script><img src="x" onerror="alert(1)">'} />,
    );

    expect(container.querySelector("script")).toBeNull();
    expect(container.querySelector("img")).toBeNull();
  });
});
