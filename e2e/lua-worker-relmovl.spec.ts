import { expect, test, type Browser } from "@playwright/test";
import { DEFAULT_PROJECT } from "../src/data/defaultProject";

const projectStorageKey = "mg400-training-project-v1";
const baseUrl = "http://127.0.0.1:4179";

async function runLuaSource(browser: Browser, source: string, marker: string, language: "en" | "zh-Hant" = "en") {
  const context = await browser.newContext();
  const page = await context.newPage();
  const project = { ...DEFAULT_PROJECT, script: source, programmingLanguage: "lua" as const };
  await context.addInitScript(({ key, seededProject, language }) => {
    localStorage.setItem("mg400-ui-language-v1", language);
    localStorage.setItem(key, JSON.stringify(seededProject));
  }, { key: projectStorageKey, seededProject: project, language });

  await page.goto(baseUrl);
  await page.getByRole("button", { name: language === "zh-Hant" ? "程式" : "Code", exact: true }).click();
  await expect(page.locator(".monaco-editor .view-lines")).toContainText(marker);
  await expect.poll(() => page.evaluate((key) => {
    const stored = JSON.parse(localStorage.getItem(key) ?? "null");
    return stored?.script;
  }, projectStorageKey)).toBe(source);

  const workerStarted = page.waitForEvent("worker", {
    predicate: (worker) => /lua\.worker/i.test(worker.url()),
  });
  await page.getByRole("button", { name: language === "zh-Hant" ? "執行程式" : "Run code" }).click();
  await workerStarted;

  return { context, result: page.getByRole("region", { name: language === "zh-Hant" ? "執行結果" : "Run result" }) };
}

const invalidMotionOptions = [
  { command: "MovJ", option: "SpeeedJ", source: "MovJ(PickApproach, {CP=0, SpeeedJ=50})" },
  { command: "MovL", option: "SpeedJ", source: "MovL(PickPoint, {CP=0, SpeedJ=50})" },
  { command: "JointMovJ", option: "SpeedL", source: "JointMovJ(Home, {CP=0, SpeedL=50})" },
  { command: "RelMovL", option: "SpeeedL", source: "RelMovL({0, 0, 0, 0}, {CP=0, SpeeedL=50})" },
];

for (const candidate of invalidMotionOptions) {
  test(`Lua worker rejects unsupported ${candidate.command} options`, async ({ browser }) => {
    const marker = `should-not-run-${candidate.command}`;
    const invalid = await runLuaSource(browser, `${candidate.source}\nprint('${marker}')`, candidate.command);
    try {
      await expect(invalid.result.locator(".result-error"))
        .toContainText(`${candidate.command} does not support option ${candidate.option}`);
      await expect(invalid.result).not.toContainText(marker);
    } finally {
      await invalid.context.close();
    }
  });
}

test("Lua worker retains the documented options on every motion command", async ({ browser }) => {
  const valid = await runLuaSource(browser, [
    "MovJ(PickApproach, {CP=0, SpeedJ=50, AccJ=20, SYNC=1})",
    "MovL(PickPoint, {CP=0, SpeedL=50, AccL=20, SYNC=1})",
    "JointMovJ(Home, {CP=0, SpeedJ=50, AccJ=20, SYNC=1})",
    "RelMovL({0, 0, 0, 0}, {CP=0, SpeedL=50, AccL=20, SYNC=1})",
    "print('documented-options-ok')",
  ].join("\n"), "documented-options-ok");
  await expect(valid.result.locator(".result-error")).toHaveCount(0);
  await expect(valid.result).toContainText("documented-options-ok");
  await valid.context.close();
});

test("Lua worker localizes an unsupported motion-option error in Traditional Chinese", async ({ browser }) => {
  const result = await runLuaSource(
    browser,
    "MovL(PickPoint, {CP=0, SpeedJ=50})",
    "MovL(PickPoint",
    "zh-Hant",
  );
  await expect(result.result.locator(".result-error")).toContainText("MovL 不支援「SpeedJ」選項。");
  await result.context.close();
});

test("Lua worker enforces RelMovL's four-offset form and known motion options", async ({ browser }) => {
  const valid = await runLuaSource(browser, [
    "RelMovL({0, 0, 0, 0}, {CP=0, SpeedL=50, AccL=20, SYNC=0})",
    "Sync()",
    "print('relmovl-valid-tuple')",
  ].join("\n"), "relmovl-valid-tuple");
  await expect(valid.result.getByText("relmovl-valid-tuple")).toBeVisible({ timeout: 90_000 });
  await valid.context.close();

  const missingR = await runLuaSource(browser, "RelMovL({0, 0, 0}, {CP=0})", "RelMovL({0, 0, 0}, {CP=0})");
  await expect(missingR.result.locator(".result-error")).toContainText("RelMovL needs X, Y, Z, and R offset values");
  await missingR.context.close();

  const missingNamedR = await runLuaSource(browser, "RelMovL({OffsetX=0, OffsetY=0, OffsetZ=0}, {CP=0})", "OffsetZ=0");
  await expect(missingNamedR.result.locator(".result-error")).toContainText("RelMovL needs X, Y, Z, and R offset values");
  await missingNamedR.context.close();

  const unknownOption = await runLuaSource(browser, "RelMovL({0, 0, 0, 0}, {CP=0, SpeeedL=50})", "SpeeedL=50");
  await expect(unknownOption.result.locator(".result-error")).toContainText("RelMovL does not support option SpeeedL");
  await unknownOption.context.close();

  const invalidSpeed = await runLuaSource(browser, "RelMovL({0, 0, 0, 0}, {CP=0, SpeedL=101})", "SpeedL=101");
  await expect(invalidSpeed.result.locator(".result-error")).toContainText("SpeedL motion option must be between 1 and 100");
  await invalidSpeed.context.close();

  const invalidOffset = await runLuaSource(browser, "RelMovL({1001, 0, 0, 0}, {CP=0})", "RelMovL({1001, 0, 0, 0}, {CP=0})");
  await expect(invalidOffset.result.locator(".result-error")).toContainText("RelMovL offset or motion setting is outside the supported finite range");
  await invalidOffset.context.close();

  const unsupportedBlending = await runLuaSource(browser, "RelMovL({0, 0, 0, 0}, {CP=1})", "CP=1");
  await expect(unsupportedBlending.result.locator(".result-error")).toContainText("continuous-path blending requires CP=0");
  await unsupportedBlending.context.close();
});

test("runs the guided RelMovL sequence after synchronously reaching P0", async ({ browser }) => {
  const guided = await runLuaSource(browser, [
    "local P0 = {coordinate = {x=300, y=80, z=135, r=-90}}",
    "MovJ(P0, {CP=0, SYNC=1})",
    "RelMovL({0, 0, 20, 0}, {CP=0, SYNC=1})",
    "RelMovL({15, 0, 0, 0}, {CP=0, SYNC=1})",
    "Sync()",
    "print('guided-relmovl-p0-complete')",
  ].join("\n"), "guided-relmovl-p0-complete");
  await expect(guided.result.getByText("guided-relmovl-p0-complete")).toBeVisible({ timeout: 90_000 });
  await expect(guided.result.locator(".result-error")).toHaveCount(0);
  await guided.context.close();
});
