import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";

const projectStorageKey = "mg400-training-project-v1";

test("Issue 08: rename a joint teach point, preserve it, and run Lua with the new name", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("mg400-ui-language-v1", "en");
  });
  await page.goto("/");

  await page.getByRole("button", { name: "Teach & move" }).click();
  await page.getByRole("button", { name: "Save joint point" }).click();
  const nameInput = page.getByLabel("Teach point name");
  await expect(nameInput).toHaveValue(/J\d+/);
  const initialName = await nameInput.inputValue();
  await expect.poll(() => page.evaluate(({ key, name }) => {
    const project = JSON.parse(localStorage.getItem(key) ?? "null");
    return project?.points?.some((candidate: { name: string }) => candidate.name === name) ?? false;
  }, { key: projectStorageKey, name: initialName })).toBe(true);
  const before = await page.evaluate(({ key, name }) => {
    const project = JSON.parse(localStorage.getItem(key) ?? "null");
    const point = project.points.find((candidate: { name: string }) => candidate.name === name);
    return { id: point.id, kind: point.kind, joints: point.joints };
  }, { key: projectStorageKey, name: initialName });

  await nameInput.fill("RenamedJoint");
  await nameInput.press("Enter");
  await expect(page.getByRole("option", { name: /RenamedJoint/ })).toBeVisible();
  await expect.poll(() => page.evaluate((key) => {
    const project = JSON.parse(localStorage.getItem(key) ?? "null");
    return project?.points?.some((candidate: { name: string }) => candidate.name === "RenamedJoint") ?? false;
  }, projectStorageKey)).toBe(true);

  await nameInput.fill("");
  await page.getByRole("button", { name: "Rename", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("non-empty Lua identifier");
  await expect(nameInput).toHaveValue("");

  await nameInput.fill("bad-name");
  await page.getByRole("button", { name: "Rename", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("Lua identifier");
  await expect(nameInput).toHaveValue("bad-name");

  await nameInput.fill("end");
  await page.getByRole("button", { name: "Rename", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("Lua identifier");

  await nameInput.fill("home");
  await page.getByRole("button", { name: "Rename", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("already exists");

  const preservedProject = await page.evaluate((key) => localStorage.getItem(key), projectStorageKey);
  for (const [invalidName, expectedMessage] of [["MovJ", "Lua identifier"], ["print", "Lua identifier"], ["A".repeat(41), "40 characters"]]) {
    await nameInput.fill(invalidName);
    await page.getByRole("button", { name: "Rename", exact: true }).click();
    await expect(page.getByRole("alert")).toContainText(expectedMessage);
    await expect.poll(() => page.evaluate((key) => localStorage.getItem(key), projectStorageKey)).toBe(preservedProject);
    await expect(page.getByRole("option", { name: /RenamedJoint/ })).toBeVisible();
  }

  const renamed = await page.evaluate((key) => {
    const project = JSON.parse(localStorage.getItem(key) ?? "null");
    const point = project.points.find((candidate: { name: string }) => candidate.name === "RenamedJoint");
    return { id: point.id, kind: point.kind, joints: point.joints };
  }, projectStorageKey);
  expect(renamed).toEqual(before);

  // Rejected renames must not leave the project store unable to save later editor edits.
  await page.getByRole("button", { name: "Code", exact: true }).click();
  const editor = page.locator(".monaco-editor .view-lines");
  await expect(editor).toBeVisible({ timeout: 30_000 });
  await editor.click();
  await page.keyboard.press("Meta+A");
  await page.keyboard.insertText('print("after-rejected-rename-save")');
  await expect.poll(() => page.evaluate((key) => {
    const project = JSON.parse(localStorage.getItem(key) ?? "null");
    return project?.script?.includes("after-rejected-rename-save") ?? false;
  }, projectStorageKey)).toBe(true);
  await expect(page.locator(".saved-state")).toContainText("Saved");

  const fortyCharacterName = `Point${"A".repeat(35)}`;
  expect(fortyCharacterName).toHaveLength(40);
  await page.getByRole("button", { name: "Teach & move" }).click();
  await nameInput.fill(fortyCharacterName);
  await page.getByRole("button", { name: "Rename", exact: true }).click();
  await expect(page.getByRole("option", { name: new RegExp(fortyCharacterName) })).toBeVisible();
  await expect.poll(() => page.evaluate(({ key, name }) => {
    const project = JSON.parse(localStorage.getItem(key) ?? "null");
    return project?.points?.some((candidate: { name: string }) => candidate.name === name) ?? false;
  }, { key: projectStorageKey, name: fortyCharacterName })).toBe(true);

  const fortyNamedPoint = await page.evaluate(({ key, name }) => {
    const project = JSON.parse(localStorage.getItem(key) ?? "null");
    const point = project.points.find((candidate: { name: string }) => candidate.name === name);
    return { id: point.id, kind: point.kind, joints: point.joints };
  }, { key: projectStorageKey, name: fortyCharacterName });
  expect(fortyNamedPoint).toEqual(before);

  await page.reload({ waitUntil: "domcontentloaded", timeout: 30_000 });
  await page.getByRole("button", { name: "Teach & move" }).click();
  await expect(page.getByRole("option", { name: new RegExp(fortyCharacterName) })).toBeVisible({ timeout: 30_000 });
  const persisted = await page.evaluate((key) => {
    const project = JSON.parse(localStorage.getItem(key) ?? "null");
    const point = project.points.find((candidate: { name: string }) => candidate.name === `Point${"A".repeat(35)}`);
    return { id: point.id, kind: point.kind, joints: point.joints };
  }, projectStorageKey);
  expect(persisted).toEqual(fortyNamedPoint);

  await page.getByLabel("Project and settings").click();
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export project", exact: true }).click();
  const download = await downloadPromise;
  const downloadPath = await download.path();
  expect(downloadPath).toBeTruthy();
  const exportedText = await readFile(downloadPath!, "utf8");
  expect(JSON.parse(exportedText).points.some((point: { name: string }) => point.name === fortyCharacterName)).toBe(true);
  await page.locator('input[name="project-file"]').setInputFiles({
    name: "mg400-training-project.json",
    mimeType: "application/json",
    buffer: Buffer.from(exportedText),
  });
  await expect.poll(() => page.evaluate(({ key, name }) => {
    const project = JSON.parse(localStorage.getItem(key) ?? "null");
    return project?.points?.some((candidate: { name: string }) => candidate.name === name) ?? false;
  }, { key: projectStorageKey, name: fortyCharacterName })).toBe(true);
  await page.getByRole("button", { name: "Teach & move" }).click();
  await expect(page.getByRole("option", { name: new RegExp(fortyCharacterName) })).toBeVisible();

  await page.getByRole("button", { name: "Code", exact: true }).click();
  await expect(editor).toBeVisible({ timeout: 30_000 });
  await expect(editor).toBeVisible({ timeout: 30_000 });
  await editor.click();
  await page.keyboard.press("Meta+A");
  await page.keyboard.insertText(`JointMovJ(${fortyCharacterName})\nprint("renamed-joint-point-ran")`);
  await expect(page.locator(".monaco-editor .view-lines")).toContainText(fortyCharacterName);
  await expect(page.getByRole("button", { name: "Run code" })).toBeVisible({ timeout: 30_000 });
  await page.getByRole("button", { name: "Run code" }).click();
  await expect(page.getByRole("region", { name: "Run result" })).toContainText("renamed-joint-point-ran", { timeout: 90_000 });
});

test("Issue 08: localizes teach point rename validation in Traditional Chinese", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("mg400-ui-language-v1", "zh-Hant");
  });
  await page.goto("/");
  await page.getByRole("button", { name: "教點與移動" }).click();
  await page.getByRole("button", { name: "示教目前位置" }).first().click();
  const nameInput = page.getByLabel("示教點名稱");
  await nameInput.fill("end");
  await page.getByRole("button", { name: "重新命名" }).click();
  await expect(page.getByRole("alert")).toContainText("保留字");
  await nameInput.fill("Home");
  await page.getByRole("button", { name: "重新命名" }).click();
  await expect(page.getByRole("alert")).toContainText("已有相同名稱");
});
