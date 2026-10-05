import { expect, test } from "@playwright/test";

const projectStorageKey = "mg400-training-project-v1";

test("Issue 08: teach and save named points, then execute Lua pick-and-place in the browser", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("mg400-ui-language-v1", "en");
  });
  await page.goto("/");

  await page.getByRole("button", { name: "Teach & move" }).click();
  await page.getByRole("button", { name: "Teach pick pair" }).click();
  await page.getByRole("button", { name: "Teach place pair" }).click();

  await expect.poll(() => page.evaluate((key) => {
    const saved = JSON.parse(localStorage.getItem(key) ?? "null");
    return saved?.points?.map((point: { name: string }) => point.name) ?? [];
  }, projectStorageKey)).toEqual(expect.arrayContaining(["PickPoint", "PickApproach", "PlacePoint", "PlaceApproach"]));

  const before = await page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? "null"), projectStorageKey);
  const sourceBlock = before.scene.blocks.find((block: { source: string }) => block.source === "pickup");
  expect(sourceBlock, "the guided cell should contain its original pickup workpiece").toBeTruthy();
  const originalPosition = { ...sourceBlock.position };

  await page.reload();
  await page.getByRole("button", { name: "Teach & move" }).click();
  await expect(page.getByRole("option", { name: /PickPoint/ })).toBeVisible();

  await page.getByRole("button", { name: "Code", exact: true }).click();
  await page.getByRole("button", { name: "AI coach" }).click();
  await page.locator("details.guided-example-section > summary").click();
  const replaceExample = page.getByRole("button", { name: "Replace current Lua code with this example" });
  await expect(replaceExample).toBeEnabled();
  await replaceExample.click();
  await expect.poll(() => page.evaluate((key) => {
    const saved = JSON.parse(localStorage.getItem(key) ?? "null");
    return ["PickApproach", "PickPoint", "PlaceApproach", "PlacePoint"].map((name) => saved?.script?.includes(name));
  }, projectStorageKey)).toEqual([true, true, true, true]);

  const luaWorkerPromise = page.waitForEvent("worker", {
    predicate: (worker) => /lua\.worker/i.test(worker.url()),
  });
  await page.getByRole("button", { name: "Run code" }).click();
  const luaWorker = await luaWorkerPromise;
  expect(luaWorker.url()).toMatch(/lua\.worker/i);

  await expect(page.getByText("Lua program started in the isolated browser worker.")).toBeVisible();
  const runResult = page.getByRole("region", { name: "Run result" });
  await expect(runResult.getByText(/fork pick and place complete/i)).toBeVisible({ timeout: 90_000 });
  await expect(page.getByText(/Fork lowered the block onto the support pads/)).toBeVisible();

  const completed = await page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? "null"), projectStorageKey);
  expect(completed.points.map((point: { name: string }) => point.name)).toEqual(expect.arrayContaining(["PickPoint", "PickApproach", "PlacePoint", "PlaceApproach"]));
  const placedBlock = completed.scene.blocks.find((block: { id: string }) => block.id === sourceBlock.id);
  expect(placedBlock.source).toBe("output");
  expect(placedBlock.position.x).not.toBe(originalPosition.x);
  expect(Math.hypot(placedBlock.position.x - completed.scene.drop.x, placedBlock.position.y - completed.scene.drop.y)).toBeLessThanOrEqual(1);
});
