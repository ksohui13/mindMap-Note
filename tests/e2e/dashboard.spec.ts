import { readFile } from "node:fs/promises";

import { expect, test } from "@playwright/test";

test.describe("dashboard lifecycle", () => {
  test.skip(process.env.E2E_DATABASE_READY !== "true", "Requires migrated PostgreSQL test data.");

  test("signup, create, rename, safely delete, and reuse the maximum sequence", async ({ page }) => {
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
    await expect(page.getByLabel("노드 제목")).toHaveValue("시작");
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

    await page.getByLabel("고객 인터뷰 정리 메뉴").click();
    await page.getByRole("button", { name: "Markdown 내보내기" }).click();
    const exportDialog = page.getByRole("dialog", { name: "Markdown 내보내기" });
    await expect(exportDialog.getByLabel("전체 마인드맵")).toBeChecked();
    await expect(exportDialog.getByLabel("현재 노드만")).toBeDisabled();
    const downloadPromise = page.waitForEvent("download");
    await exportDialog.getByRole("button", { name: "파일 생성" }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe("고객 인터뷰 정리-all.md");
    const exportPath = await download.path();
    if (!exportPath) throw new Error("Export download path was unavailable.");
    expect(await readFile(exportPath, "utf8")).toContain("# 고객 인터뷰 정리");

    await page.getByLabel("고객 인터뷰 정리 메뉴").click();
    await page.getByRole("button", { name: "삭제", exact: true }).click();
    const dialog = page.getByRole("alertdialog");
    await expect(dialog).toContainText("포함된 노드 1개");
    await dialog.getByRole("button", { name: "삭제", exact: true }).click();
    await expect(page.getByText("고객 인터뷰 정리")).not.toBeVisible();
    await expect(page.getByText("전체 1개")).toBeVisible();

    await page.getByRole("button", { name: "+ 새 마인드맵" }).click();
    await page.getByRole("link", { name: "← Dashboard" }).click();
    await expect(page.getByText("새로운 마인드맵 2", { exact: true })).toBeVisible();
  });
});
