import { mkdir, readFile, writeFile } from "node:fs/promises";
import { performance } from "node:perf_hooks";

import { expect, test, type Page } from "@playwright/test";

import {
  PERFORMANCE_EMAIL,
  PERFORMANCE_MAPS,
  PERFORMANCE_PASSWORD,
} from "../../scripts/performance/fixture";

type BrowserSample = Readonly<{ firstVisibleMs: number; usableMs: number }>;

test.describe("1,000-node production performance", () => {
  test.skip(process.env.E2E_DATABASE_READY !== "true", "Requires the step 12 acceptance database.");

  test("meets expanded and collapsed first-visible and usable thresholds", async ({ page }) => {
    const browserErrors: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error") browserErrors.push(message.text());
    });
    page.on("pageerror", (error) => browserErrors.push(error.message));
    await login(page);

    const results: Record<string, BrowserSample[]> = {};
    for (const [profile, definition] of Object.entries({
      expanded: PERFORMANCE_MAPS.expanded,
      collapsed: PERFORMANCE_MAPS.collapsed,
    })) {
      await measureEditor(page, definition.id);
      const samples: BrowserSample[] = [];
      for (let sample = 0; sample < 5; sample += 1) {
        samples.push(await measureEditor(page, definition.id));
      }
      results[profile] = samples;
      for (const sample of samples) {
        expect(sample.firstVisibleMs, `${profile} first-visible`).toBeLessThanOrEqual(2_000);
        expect(sample.usableMs, `${profile} usable`).toBeLessThanOrEqual(5_000);
      }
    }

    await page.goto(`/mindmaps/${PERFORMANCE_MAPS.expanded.id}`);
    const visibleNode = page.locator(".react-flow__node:visible").first();
    await visibleNode.getByRole("button", { name: /상세 열기/ }).click();
    await page.getByLabel("Markdown 내용").fill("# 1,000-node autosave acceptance");
    await expect(page.getByText("저장 완료").first()).toBeVisible({ timeout: 5_000 });

    await page.getByRole("button", { name: "내보내기" }).click();
    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("dialog", { name: "Markdown 내보내기" })
      .getByRole("button", { name: "파일 생성" }).click();
    const download = await downloadPromise;
    const exportPath = await download.path();
    if (!exportPath) throw new Error("Performance export download path was unavailable.");
    const exported = await readFile(exportPath, "utf8");
    expect(exported).toContain("# Performance 1000 Expanded");
    expect(exported).toContain("Node 1000");

    expect(browserErrors).toEqual([]);
    await mkdir("artifacts/performance", { recursive: true });
    await writeFile(
      "artifacts/performance/browser.json",
      `${JSON.stringify({ generatedAt: new Date().toISOString(), results: summarize(results) }, null, 2)}\n`,
      "utf8",
    );
  });
});

async function login(page: Page): Promise<void> {
  await page.goto("/login");
  await page.getByLabel("이메일").fill(PERFORMANCE_EMAIL);
  await page.getByLabel("비밀번호").fill(PERFORMANCE_PASSWORD);
  await page.getByRole("button", { name: "로그인", exact: true }).click();
  await expect(page).toHaveURL(/\/$/);
}

async function measureEditor(page: Page, mindmapId: string): Promise<BrowserSample> {
  const startedAt = performance.now();
  await page.goto(`/mindmaps/${mindmapId}`, { waitUntil: "domcontentloaded" });
  await page.locator(".react-flow__node").first().waitFor({ state: "visible" });
  const firstVisibleMs = round(performance.now() - startedAt);
  const viewport = page.locator(".react-flow__viewport");
  const beforeZoom = await viewport.getAttribute("style");
  await page.getByRole("button", { name: "확대" }).click();
  await expect(viewport).not.toHaveAttribute("style", beforeZoom ?? "");
  await page.locator(".react-flow__node").first().click();
  return { firstVisibleMs, usableMs: round(performance.now() - startedAt) };
}

function summarize(results: Record<string, BrowserSample[]>) {
  return Object.fromEntries(Object.entries(results).map(([profile, samples]) => {
    const summarizeMetric = (key: keyof BrowserSample) => {
      const values = samples.map((sample) => sample[key]).sort((a, b) => a - b);
      return {
        medianMs: values[Math.ceil(values.length / 2) - 1] ?? 0,
        maxMs: Math.max(...values),
      };
    };
    return [profile, { firstVisible: summarizeMetric("firstVisibleMs"), usable: summarizeMetric("usableMs"), samples }];
  }));
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}
