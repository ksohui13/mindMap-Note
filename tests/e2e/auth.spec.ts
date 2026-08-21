import { expect, test } from "@playwright/test";

test.describe("authentication", () => {
  test.skip(
    process.env.E2E_DATABASE_READY !== "true",
    "PostgreSQL E2E environment is deferred to MASTER_PLAN step 12.",
  );

  test("signup, protected dashboard, and logout", async ({ page }) => {
    const email = `e2e-${Date.now()}@example.test`;
    await page.goto("/");
    await expect(page).toHaveURL(/\/login$/);
    await page.getByRole("tab", { name: "회원가입" }).click();
    await page.getByLabel("이메일").fill(email);
    await page.getByLabel("비밀번호").fill("password123");
    await page.getByRole("button", { name: "계정 만들기" }).click();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole("heading", { name: "내 마인드맵" })).toBeVisible();
    await page.getByRole("button", { name: "로그아웃" }).click();
    await expect(page).toHaveURL(/\/login$/);
  });
});
