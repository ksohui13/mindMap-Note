import { expect, test } from "@playwright/test";

test.describe("mindmap editor canvas", () => {
  test.skip(process.env.E2E_DATABASE_READY !== "true", "Requires migrated PostgreSQL test data.");

  test("renders a persisted tree and supports selection, pan, zoom, and fit view", async ({ page }) => {
    const email = `editor-${Date.now()}@example.test`;
    await page.goto("/login");
    await page.getByRole("button", { name: "회원가입" }).click();
    await page.getByLabel("이메일").fill(email);
    await page.getByLabel("비밀번호", { exact: true }).fill("password123");
    await page.getByLabel("비밀번호 확인").fill("password123");
    await page.getByRole("button", { name: "계정 만들기" }).click();
    await page.getByRole("button", { name: "+ 새 마인드맵" }).click();

    const match = page.url().match(/\/mindmaps\/([0-9a-f-]+)/);
    expect(match?.[1]).toBeTruthy();
    const mindmapId = match?.[1] ?? "";
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) throw new Error("DATABASE_URL is required for editor E2E.");
    const { createPrismaClient } = await import("../../src/server/db/client");
    const client = createPrismaClient(databaseUrl);
    try {
      const root = await client.node.findFirstOrThrow({ where: { mindmapId, parentNodeId: null } });
      await client.node.create({
        data: { mindmapId, parentNodeId: root.id, title: "E2E Child", x: 260, y: 100 },
      });
    } finally {
      await client.$disconnect();
    }

    await page.reload();
    await expect(page.getByText("시작", { exact: true })).toBeVisible();
    await expect(page.getByText("E2E Child", { exact: true })).toBeVisible();
    await expect(page.locator(".react-flow__edge")).toHaveCount(1);

    await page.getByText("E2E Child", { exact: true }).click();
    await expect(page.getByTestId("mindmap-node")).toHaveClass(/ring-4/);
    const viewport = page.locator(".react-flow__viewport");
    const beforeZoom = await viewport.getAttribute("style");
    await page.getByRole("button", { name: "확대" }).click();
    await expect(viewport).not.toHaveAttribute("style", beforeZoom ?? "");

    const pane = page.locator(".react-flow__pane");
    const box = await pane.boundingBox();
    if (!box) throw new Error("React Flow pane was not measurable.");
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + 80, box.y + box.height / 2 + 50);
    await page.mouse.up();
    await page.getByRole("button", { name: "화면 맞춤" }).click();

    await page.getByRole("link", { name: "← Dashboard" }).click();
    await expect(page).toHaveURL("/");
    await page.goto(`/mindmaps/${mindmapId}`);
    await expect(page.getByText("E2E Child", { exact: true })).toBeVisible();
  });

  test("edits the root, creates nested children, and restores titles after reload", async ({ page }) => {
    const email = `node-edit-${Date.now()}@example.test`;
    await page.goto("/login");
    await page.getByRole("button", { name: "회원가입" }).click();
    await page.getByLabel("이메일").fill(email);
    await page.getByLabel("비밀번호", { exact: true }).fill("password123");
    await page.getByLabel("비밀번호 확인").fill("password123");
    await page.getByRole("button", { name: "계정 만들기" }).click();
    await page.getByRole("button", { name: "+ 새 마인드맵" }).click();

    const rootInput = page.getByLabel("노드 제목");
    await expect(rootInput).toBeFocused();
    await rootInput.fill("루트 개념");
    await rootInput.press("Enter");
    await expect(page.getByText("루트 개념", { exact: true })).toBeVisible();

    await page.getByLabel("루트 개념에 자식 노드 추가").click();
    const childInput = page.getByLabel("노드 제목");
    await expect(childInput).toBeFocused();
    await childInput.fill("첫 번째 자식");
    await childInput.press("Enter");
    await page.getByLabel("첫 번째 자식에 자식 노드 추가").click();
    const grandchildInput = page.getByLabel("노드 제목");
    await grandchildInput.fill("손자 노드");
    await grandchildInput.press("Enter");

    const mindmapId = page.url().match(/\/mindmaps\/([0-9a-f-]+)/)?.[1] ?? "";
    expect(mindmapId).toBeTruthy();
    const childNode = page.locator('.react-flow__node').filter({ hasText: "첫 번째 자식" });
    const childBox = await childNode.boundingBox();
    if (!childBox) throw new Error("Child node was not measurable.");
    const positionSaved = page.waitForResponse((response) =>
      response.url().includes("/position") && response.request().method() === "PATCH",
    );
    await page.mouse.move(childBox.x + childBox.width / 2, childBox.y + childBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(
      childBox.x + childBox.width / 2 + 120,
      childBox.y + childBox.height / 2 + 80,
    );
    await page.mouse.up();
    const positionResponse = await positionSaved;
    expect(positionResponse.ok()).toBe(true);

    await page.reload();
    await expect(page.getByText("루트 개념", { exact: true })).toBeVisible();
    await expect(page.getByText("첫 번째 자식", { exact: true })).toBeVisible();
    await expect(page.getByText("손자 노드", { exact: true })).toBeVisible();
    await expect(page.locator(".react-flow__edge")).toHaveCount(2);

    const collapseSaved = page.waitForResponse((response) =>
      response.url().includes("/collapse") && response.request().method() === "PATCH",
    );
    await page.getByLabel("루트 개념 하위 트리 접기").click();
    await collapseSaved;
    await expect(page.getByText("첫 번째 자식", { exact: true })).not.toBeVisible();
    await page.reload();
    await expect(page.getByLabel("루트 개념 하위 트리 펼치기")).toBeVisible();
    await expect(page.getByText("첫 번째 자식", { exact: true })).not.toBeVisible();

    const expandSaved = page.waitForResponse((response) =>
      response.url().includes("/collapse") && response.request().method() === "PATCH",
    );
    await page.getByLabel("루트 개념 하위 트리 펼치기").click();
    await expandSaved;
    await expect(page.getByText("첫 번째 자식", { exact: true })).toBeVisible();

    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) throw new Error("DATABASE_URL is required for editor E2E.");
    const { createPrismaClient } = await import("../../src/server/db/client");
    const client = createPrismaClient(databaseUrl);
    try {
      const [root, child] = await Promise.all([
        client.node.findFirstOrThrow({ where: { mindmapId, parentNodeId: null } }),
        client.node.findFirstOrThrow({ where: { mindmapId, title: "첫 번째 자식" } }),
      ]);
      expect(child.parentNodeId).toBe(root.id);
      expect({ x: child.x, y: child.y }).not.toEqual({ x: 240, y: 0 });
    } finally {
      await client.$disconnect();
    }
  });
});
