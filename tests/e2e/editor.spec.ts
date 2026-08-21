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
});
