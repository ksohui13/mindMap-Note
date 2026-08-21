import { expect, test } from "@playwright/test";

test("redirects guests to auth and exposes health", async ({ page, request }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole("heading", { name: /생각을 연결하고/ })).toBeVisible();
  await expect(page.getByRole("tab", { name: "로그인" })).toHaveAttribute("aria-selected", "true");

  const response = await request.get("/api/health");
  expect(response.ok()).toBe(true);
  await expect(response.json()).resolves.toMatchObject({ status: "ok" });
});
