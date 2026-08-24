import { describe, expect, it } from "vitest";

import {
  buildContentDisposition,
  buildExportFilename,
  renderMindmapMarkdown,
  sanitizeFilenamePart,
} from "@/server/domain/mindmap-export";

describe("mindmap Markdown exporter", () => {
  it("renders a stable tree and detailed paths while preserving original Markdown", () => {
    const markdown = renderMindmapMarkdown({
      mindmapTitle: "제품 *계획*",
      scope: "SUBTREE",
      targetNodeTitle: "기능 [A]",
      nodes: [
        {
          id: "a",
          parentNodeId: "root",
          title: "기능 [A]",
          contentMd: "## 원본 제목\n\n- 그대로",
          path: ["시작", "기능 [A]"],
          depth: 0,
        },
        {
          id: "b",
          parentNodeId: "a",
          title: "하위 > 개념",
          contentMd: "",
          path: ["시작", "기능 [A]", "하위 > 개념"],
          depth: 1,
        },
      ],
    });

    expect(markdown).toMatchInlineSnapshot(`
      "# 제품 \\*계획\\*

      > 내보내기 범위: 현재 노드 + 모든 하위 개념
      > 기준 노드: 기능 \\[A\\]

      ## 개념 트리

      - 기능 \\[A\\]
        - 하위 \\> 개념

      ## 노드 상세
      ### 1. 기능 \\[A\\]

      > 경로: 시작 › 기능 \\[A\\]

      ## 원본 제목

      - 그대로

      ---

      ### 2. 하위 \\> 개념

      > 경로: 시작 › 기능 \\[A\\] › 하위 \\> 개념

      _(상세 Markdown 없음)_
      "
    `);
  });

  it("creates safe deterministic Unicode filenames and an RFC 5987 header", () => {
    expect(buildExportFilename(" 고객/인터뷰:* ", "ALL")).toBe("고객-인터뷰-all.md");
    expect(sanitizeFilenamePart("CON")).toBe("_CON");
    expect(sanitizeFilenamePart("<>... ")).toBe("mindmap");
    expect(buildContentDisposition("한글 계획-all.md")).toBe(
      "attachment; filename=\"mindmap-export.md\"; filename*=UTF-8''%ED%95%9C%EA%B8%80%20%EA%B3%84%ED%9A%8D-all.md",
    );
  });
});
