import { describe, expect, it } from "vitest";
import { CURRICULUM_VERSION, LESSONS, TRACKS } from "./curriculum";

describe("beginner curriculum entry", () => {
  it("starts with a bilingual text-only program instead of a robot command", () => {
    const first = LESSONS[0];
    expect(CURRICULUM_VERSION).toBe("1.3.6");
    expect(first.id).toBe("foundation-first-program");
    expect(first.track).toBe("foundation");
    expect(first.title.en).toBeTruthy();
    expect(first.title["zh-Hant"]).toBeTruthy();
    const explanations = first.explanation.map((copy) => copy.en).join(" ");
    expect(explanations).toMatch(/Lua starts one with/);
    expect(explanations).toMatch(/Python starts one with/);
    expect(explanations).toMatch(/do not need those ideas/i);
    expect(first.explanation.map((copy) => copy["zh-Hant"]).join(" ")).toContain("不需 API key");
    expect(first.examples.lua).toContain("print(greeting)");
    expect(first.examples.python).toContain("print(greeting)");
    expect(first.examples.lua).not.toMatch(/\b(?:MovJ|MovL|JointMovJ|RelMovL|DO|GetPose)\s*\(/);
    expect(first.examples.python).not.toMatch(/\b(?:mov_j|mov_l|joint_mov_j|rel_mov_l|do|pick|place|get_pose)\s*\(/);
    expect(TRACKS.some((track) => track.id === "foundation")).toBe(true);
    const languageGuidance = first.explanation.map((copy) => copy.en).join(" ");
    expect(languageGuidance).toContain("Lua is the MG400 training language");
    expect(languageGuidance).toContain("Python is for this simulator only");
    expect(languageGuidance).toContain("separate editor programs");
    expect(first.explanation.map((copy) => copy["zh-Hant"]).join(" ")).toContain("程式不能在實體 Dobot 控制器執行");
    expect(first.explanation.map((copy) => copy.en).join(" ")).toContain("Run executes the program in the editor");
    expect(first.explanation.map((copy) => copy["zh-Hant"]).join(" ")).toContain("「執行編輯器程式」會執行編輯器內的程式");
    expect(first.guidedSteps[1].en).toContain("Until you load it, Run will execute the current editor program");
    expect(first.guidedSteps[2].en).toContain("After loading the example");
    expect(first.guidedSteps[1]["zh-Hant"]).toContain("「執行編輯器程式」會執行編輯器目前的程式");
    expect(first.practice.en).toContain("After loading the lesson example");
    expect(first.practice["zh-Hant"]).toContain("載入課堂範例後");
    expect(TRACKS.find((track) => track.id === "foundation")?.summary.en).toContain("a first simulated move");
    expect(TRACKS.find((track) => track.id === "foundation")?.summary["zh-Hant"]).toContain("第一次模擬移動");
  });

  it("puts a single first robot move between the print lesson and control-flow foundations", () => {
    expect(LESSONS.slice(0, 6).map(({ id }) => id)).toEqual([
      "foundation-first-program",
      "foundation-first-robot-move",
      "foundation-if-else",
      "foundation-loops",
      "foundation-cell-and-coordinates",
      "foundation-points-and-moves",
    ]);

    const firstMove = LESSONS[1];
    expect(firstMove.title.en).toBe("First robot move: go to the approach point");
    expect(firstMove.guidedSteps[0].en).toContain("completed course progress stay saved");
    expect(firstMove.guidedSteps[0].en).toContain("save automatically with this local project");
    expect(firstMove.guidedSteps[0].en).toContain("resume this lesson");
    expect(firstMove.guidedSteps[0]["zh-Hant"]).toContain("已完成進度會保留");
    expect(firstMove.guidedSteps[0]["zh-Hant"]).toContain("自動儲存到本機專案");
    expect(firstMove.guidedSteps[0]["zh-Hant"]).toContain("繼續本課");
    expect(firstMove.examples.lua).toContain("MovJ(PickApproach, {CP=0})");
    expect(firstMove.examples.lua).toContain("Sync()");
    expect(firstMove.examples.python).toContain("mov_j(PickApproach, cp=0)");
    expect(firstMove.examples.python).toContain("sync()");
    expect(firstMove.examples.lua).not.toMatch(/\b(?:MovL|RelMovL|DO|Pick|Place)\s*\(/);
    expect(firstMove.examples.python).not.toMatch(/\b(?:mov_l|rel_mov_l|do|pick|place)\s*\(/);
    expect(firstMove.explanation.map((copy) => copy.en).join(" ")).toContain("does not insert, lift, or pick up anything");
    expect(firstMove.explanation.map((copy) => copy["zh-Hant"]).join(" ")).toContain("無動力叉臂");

    const decisions = LESSONS[2];
    expect(decisions.title.en).toBe("If and else: choose a path");
    expect(decisions.title["zh-Hant"]).toBe("If 與 else：選擇程式分支");
    expect(decisions.prerequisite.en).toContain("first program");
    expect(decisions.explanation.map((copy) => copy.en).join(" ")).toContain("Python uses if/elif/else");
    expect(decisions.questions[0].en).toContain("both Lua and Python");
    expect(decisions.examples.lua).toContain("if blockHeight > 10 then");
    expect(decisions.examples.lua).toContain("elseif blockHeight == 10 then");
    expect(decisions.examples.python).toContain("elif block_height == 10:");
    expect(decisions.examples.lua).not.toMatch(/\b(?:for|while)\s+/);
    expect(decisions.examples.python).not.toMatch(/\b(?:for|while)\s+/);

    const loops = LESSONS[3];
    expect(loops.title.en).toBe("Loops: repeat a small task");
    expect(loops.title["zh-Hant"]).toBe("迴圈：重複小任務");
    expect(loops.prerequisite.en).toContain("If and else");
    expect(loops.explanation.map((copy) => copy.en).join(" ")).toContain("no automatic stopping condition");
    expect(loops.examples.lua).toMatch(/for step = 1, 3 do/);
    expect(loops.examples.lua).toMatch(/while count < 3 do/);
    expect(loops.examples.python).toMatch(/range\(1, 4\)/);
    expect(loops.examples.python).toMatch(/while count < 3:/);
    expect(loops.examples.lua).not.toMatch(/\b(?:MovJ|MovL|JointMovJ|RelMovL|DO|GetPose)\s*\(/);
    expect(loops.examples.python).not.toMatch(/\b(?:mov_j|mov_l|joint_mov_j|rel_mov_l|do|pick|place|get_pose)\s*\(/);
  });

  it("keeps the six Intermediate lessons in the authored teaching order", () => {
    expect(LESSONS.filter(({ track }) => track === "intermediate").map(({ id }) => id)).toEqual([
      "intermediate-relative-linear-motion",
      "intermediate-pick-and-place",
      "intermediate-passive-fork",
      "intermediate-rotate-carried-block",
      "intermediate-three-layer-tower",
      "intermediate-black-white-sort",
    ]);
  });

  it("keeps every lesson bilingual, assessed, and consistent with the current course release", () => {
    expect(LESSONS).toHaveLength(14);
    for (const lesson of LESSONS) {
      for (const language of ["en", "zh-Hant"] as const) {
        expect(lesson.title[language].trim(), `${lesson.id} title ${language}`).not.toBe("");
        expect(lesson.outcome[language].trim(), `${lesson.id} outcome ${language}`).not.toBe("");
        expect(lesson.prerequisite[language].trim(), `${lesson.id} prerequisite ${language}`).not.toBe("");
        expect(lesson.evidenceProfile[language].trim(), `${lesson.id} evidence profile ${language}`).not.toBe("");
        expect(lesson.explanation.every((copy) => copy[language].trim().length > 0), `${lesson.id} explanation ${language}`).toBe(true);
        expect(lesson.guidedSteps.every((copy) => copy[language].trim().length > 0), `${lesson.id} guided steps ${language}`).toBe(true);
        expect(lesson.practice[language].trim(), `${lesson.id} practice ${language}`).not.toBe("");
        expect(lesson.questions.every((question) => question[language].trim().length > 0
          && question.options[language].length >= 2
          && question.explanation[language].trim().length > 0), `${lesson.id} assessment ${language}`).toBe(true);
      }
      expect(lesson.examples.lua.trim(), `${lesson.id} Lua example`).not.toBe("");
      expect(lesson.examples.python.trim(), `${lesson.id} Python example`).not.toBe("");
      for (const profile of Object.values(lesson.evidenceProfile)) {
        const version = profile.match(/curriculum (\d+\.\d+\.\d+)/i)?.[1]
          ?? profile.match(/課程 (\d+\.\d+\.\d+)/)?.[1];
        if (version) expect(version, `${lesson.id} evidence profile release`).toBe(CURRICULUM_VERSION);
      }
      for (const question of lesson.questions) {
        expect(question.answer, `${lesson.id} assessment answer`).toBeGreaterThanOrEqual(0);
        expect(question.answer, `${lesson.id} assessment answer`).toBeLessThan(question.options.en.length);
        expect(question.answer, `${lesson.id} Traditional Chinese assessment answer`).toBeLessThan(question.options["zh-Hant"].length);
      }
    }

    const advanced = LESSONS.find((lesson) => lesson.id === "advanced-debugging-and-fidelity");
    expect(advanced?.prerequisite.en).toContain("Foundation and Intermediate tracks");
    expect(advanced?.prerequisite["zh-Hant"]).toContain("初階及中階課程");
    expect(advanced?.evidenceProfile.en).not.toContain("linked below");
  });

  it("teaches the pick-lift-rotate-place order with a visible block direction marker", () => {
    const rotation = LESSONS.find((lesson) => lesson.id === "intermediate-rotate-carried-block");
    expect(rotation).toBeDefined();
    if (!rotation) throw new Error("Missing carried-block rotation lesson.");
    expect(rotation.examples.lua.indexOf("RelMovL({0,0,80,0}")).toBeLessThan(rotation.examples.lua.indexOf("RelMovL({0,0,0,90}"));
    expect(rotation.examples.python.indexOf("rel_mov_l([0,0,80,0]")).toBeLessThan(rotation.examples.python.indexOf("rel_mov_l([0,0,0,90]"));
    expect(rotation.examples.lua).not.toMatch(/\bDO\s*\(/);
    expect(rotation.examples.python).not.toMatch(/\bdo\s*\(|\bawait\b/);
    expect(rotation.explanation.map((copy) => copy.en).join(" ")).toContain("held tool +90°");
    expect(rotation.explanation.map((copy) => copy["zh-Hant"]).join(" ")).toContain("先抬高 80 mm");
  });

  it("separates RelMovL offsets from the CP path-blending option", () => {
    const lesson = LESSONS.find((entry) => entry.id === "intermediate-relative-linear-motion");
    expect(lesson).toBeDefined();
    if (!lesson) throw new Error("Missing RelMovL lesson.");
    expect(lesson.explanation.map((copy) => copy.en).join(" ")).toContain("CP is the path-blending option, not a TCP coordinate");
    expect(lesson.explanation.map((copy) => copy["zh-Hant"]).join(" ")).toContain("CP 是路徑混合選項，不是 TCP 座標");
    expect(lesson.examples.lua).toContain("{CP=0}");
    expect(lesson.examples.python).toContain("cp=0");
  });
});
