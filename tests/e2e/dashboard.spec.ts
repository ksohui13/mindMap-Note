import { expect, test } from "@playwright/test";

test.describe("dashboard lifecycle", () => {
  test.skip(process.env.E2E_DATABASE_READY !== "true", "Requires migrated PostgreSQL test data.");

  test("signup, create, open, return, and rename", async ({ page }) => {
    const email = `dashboard-${Date.now()}@example.test`;
    await page.goto("/login");
    await page.getByRole("button", { name: "회원가입" }).click();
    await page.getByLabel("이메일").fill(email);
    await page.getByLabel("비밀번호", { exact: true }).fill("password123");
    await page.getByLabel("비밀번호 확인").fill("password123");
    await page.getByRole("button", { name: "계정 만들기" }).click();

    await expect(page.getByText("첫 마인드맵을 만들어 보세요")).toBeVisible();
    await page.getByRole("button", { name: "+ 새 마인드맵" }).click();
    await expect(page).toHaveURL(/\/mindmaps\/[0-9a-f-]+\?rootNodeId=[0-9a-f-]+&initialEdit=1/);
    await expect(page.getByText("시작", { exact: true })).toBeVisible();
    await page.getByRole("link", { name: "← Dashboard" }).click();

    await page.getByRole("button", { name: "+ 새 마인드맵" }).click();
    await page.getByRole("link", { name: "← Dashboard" }).click();
    await expect(page.getByText("전체 2개")).toBeVisible();

    await page.getByLabel("새로운 마인드맵 2 메뉴").click();
    await page.getByRole("button", { name: "이름 변경" }).click();
    const titleInput = page.getByRole("textbox", { name: "마인드맵 이름" });
    await titleInput.fill("고객 인터뷰 정리");
    await titleInput.press("Enter");
    await expect(page.getByText("고객 인터뷰 정리")).toBeVisible();
  });
});
