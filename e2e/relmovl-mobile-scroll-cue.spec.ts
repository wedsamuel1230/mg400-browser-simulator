import { expect, test } from "@playwright/test";

test("shows how to read horizontally scrolling RelMovL examples on mobile", async ({ page }) => {
  page.setDefaultTimeout(10_000);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => {
    localStorage.setItem("mg400-ui-language-v1", "zh-Hant");
  });
  await page.goto("/");

  await page.getByRole("button", { name: "課程", exact: true }).click();
  await page.locator(".training-track").filter({ has: page.locator("summary", { hasText: "中階" }) }).locator("summary").click();
  await page.getByRole("button", { name: "RelMovL 相對直線移動" }).click();

  const hints = page.locator(".relmovl-scroll-hint");
  const examples = page.locator(".relmovl-examples pre");
  await expect(hints).toHaveCount(2);
  await expect(hints.first()).toBeVisible();
  await expect(hints.first()).toHaveText("向左或向右滑動，查看完整程式碼。");
  await expect(hints.first()).toHaveCSS("font-size", "16px");
  await expect(examples).toHaveCount(2);
  await expect.poll(() => examples.first().evaluate((element) => element.scrollWidth > element.clientWidth)).toBe(true);
  await expect.poll(() => examples.last().evaluate((element) => element.scrollWidth > element.clientWidth)).toBe(true);

  await examples.first().focus();
  await expect(examples.first()).toBeFocused();
  await page.screenshot({ path: "test-results/relmovl-mobile-scroll-cue-390.png", fullPage: true });
});
