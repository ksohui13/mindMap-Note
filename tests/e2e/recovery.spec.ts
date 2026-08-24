import { expect, test, type Page, type Route } from "@playwright/test";

test.describe("autosave failure recovery", () => {
  test.skip(process.env.E2E_DATABASE_READY !== "true", "Requires the step 12 acceptance database.");

  test("retries a failed save and restores a pagehide journal after reload", async ({ page }) => {
    await signup(page, `recovery-${Date.now()}@example.test`);
    await page.getByRole("button", { name: "+ 새 마인드맵" }).click();
    await page.getByLabel("노드 제목").press("Escape");
    await page.getByLabel("시작 상세 열기").click();

    const failContentPatch = async (route: Route) => {
      if (route.request().method() === "PATCH") await route.abort("failed");
      else await route.continue();
    };
    await page.route("**/api/nodes/*/content", failContentPatch);
    const markdown = page.getByLabel("Markdown 내용");
    await markdown.fill("# retryable failure");
    await expect(page.getByText(/저장 실패/).first()).toBeVisible({ timeout: 6_000 });

    await page.unroute("**/api/nodes/*/content", failContentPatch);
    await page.getByRole("button", { name: "다시 시도" }).first().click();
    await expect(page.getByText("저장 완료").first()).toBeVisible({ timeout: 5_000 });

    await page.route("**/api/nodes/*/content", failContentPatch);
    await markdown.fill("# recovered after pagehide");
    await expect(page.getByText(/저장 실패/).first()).toBeVisible({ timeout: 6_000 });
    await page.reload();
    await page.unroute("**/api/nodes/*/content", failContentPatch);
    await page.getByLabel("시작 상세 열기").click();
    await expect(page.getByText("저장되지 않은 로컬 초안이 있습니다")).toBeVisible();
    await page.getByRole("button", { name: "초안 적용" }).click();
    await expect(page.getByLabel("Markdown 내용")).toHaveValue("# recovered after pagehide");
    await expect(page.getByText("저장 완료").first()).toBeVisible({ timeout: 6_000 });

    await page.reload();
    await page.getByLabel("시작 상세 열기").click();
    await expect(page.getByLabel("Markdown 내용")).toHaveValue("# recovered after pagehide");
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
