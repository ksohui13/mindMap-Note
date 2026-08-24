import { expect, test, type APIResponse, type Page } from "@playwright/test";

test.describe("production API security regression", () => {
  test.skip(process.env.E2E_DATABASE_READY !== "true", "Requires the step 12 acceptance database.");

  test("hides another user's Mindmap and Node across every resource endpoint", async ({ page }) => {
    const pageErrors: string[] = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));

    await signup(page, `owner-${Date.now()}@example.test`);
    await page.getByRole("button", { name: "+ 새 마인드맵" }).click();
    const currentUrl = new URL(page.url());
    const mindmapId = currentUrl.pathname.split("/").at(-1) ?? "";
    const nodeId = currentUrl.searchParams.get("rootNodeId") ?? "";
    expect(mindmapId).toMatch(/^[0-9a-f-]{36}$/);
    expect(nodeId).toMatch(/^[0-9a-f-]{36}$/);

    await page.getByRole("link", { name: "← Dashboard" }).click();
    await page.getByRole("button", { name: "로그아웃" }).click();
    await signup(page, `stranger-${Date.now()}@example.test`);

    const origin = { origin: "http://127.0.0.1:3000" };
    const requests: Promise<APIResponse>[] = [
      page.request.get(`/api/mindmaps/${mindmapId}`),
      page.request.patch(`/api/mindmaps/${mindmapId}`, { headers: origin, data: { title: "stolen" } }),
      page.request.delete(`/api/mindmaps/${mindmapId}`, { headers: origin, data: { expectedNodeCount: 1 } }),
      page.request.post(`/api/mindmaps/${mindmapId}/nodes`, {
        headers: origin,
        data: { parentNodeId: nodeId, title: "stolen", x: 0, y: 0 },
      }),
      page.request.post(`/api/mindmaps/${mindmapId}/export`, {
        headers: origin,
        data: { scope: "ALL", format: "MARKDOWN" },
      }),
      page.request.patch(`/api/nodes/${nodeId}`, { headers: origin, data: { title: "stolen", revision: 0 } }),
      page.request.delete(`/api/nodes/${nodeId}`, { headers: origin, data: { expectedDeleteCount: 1 } }),
      page.request.patch(`/api/nodes/${nodeId}/position`, { headers: origin, data: { x: 1, y: 1, revision: 0 } }),
      page.request.patch(`/api/nodes/${nodeId}/collapse`, { headers: origin, data: { isCollapsed: true, revision: 0 } }),
      page.request.get(`/api/nodes/${nodeId}/content`),
      page.request.patch(`/api/nodes/${nodeId}/content`, { headers: origin, data: { contentMd: "stolen", revision: 0 } }),
      page.request.get(`/api/nodes/${nodeId}/deletion-impact`),
    ];
    for (const response of await Promise.all(requests)) {
      expect(response.status()).toBe(404);
      await expect(response.json()).resolves.toMatchObject({ error: { code: "NOT_FOUND" } });
    }

    const invalid = await page.request.get("/api/mindmaps/not-a-uuid");
    expect(invalid.status()).toBe(400);
    await expect(invalid.json()).resolves.toMatchObject({ error: { code: "VALIDATION_ERROR" } });

    const crossOrigin = await page.request.patch(`/api/nodes/${nodeId}`, {
      headers: { origin: "https://evil.example" },
      data: { title: "cross-origin", revision: 0 },
    });
    expect(crossOrigin.status()).toBe(403);
    await expect(crossOrigin.json()).resolves.toMatchObject({ error: { code: "INVALID_ORIGIN" } });

    await page.getByRole("button", { name: "로그아웃" }).click();
    const unauthorized = await page.request.get(`/api/mindmaps/${mindmapId}`);
    expect(unauthorized.status()).toBe(401);
    await expect(unauthorized.json()).resolves.toMatchObject({ error: { code: "UNAUTHORIZED" } });
    expect(pageErrors).toEqual([]);
  });
});

async function signup(page: Page, email: string): Promise<void> {
  await page.goto("/login");
  await page.getByRole("tab", { name: "회원가입" }).click();
  await page.getByLabel("이메일").fill(email);
  await page.getByLabel("비밀번호", { exact: true }).fill("password123");
  await page.getByLabel("비밀번호 확인").fill("password123");
  await page.getByRole("button", { name: "계정 만들기" }).click();
  await expect(page).toHaveURL(/\/$/);
}
