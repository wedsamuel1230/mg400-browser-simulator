// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { LuaEngine, LuaFactory } from "wasmoon";
import { loadPyodide, type PyodideInterface } from "pyodide";
import { reviewLuaSnippet, reviewRobotCalls, type RobotCall, type SavedPointDescriptor } from "../coach/codeReview";
import { PYTHON_ANALYSIS } from "../coach/pythonAnalysis";
import { LESSONS } from "./curriculum";
import { recommendedProgram } from "../sim/codeRecommendation";
import { DEFAULT_FORK_PYTHON_SCRIPT, DEFAULT_FORK_SCRIPT, DEFAULT_PYTHON_SCRIPT, DEFAULT_SCRIPT } from "../domain";

const savedPoints: SavedPointDescriptor[] = [
  { name: "Home", kind: "joint" },
  { name: "PickApproach", kind: "cartesian" },
  { name: "PickPoint", kind: "cartesian" },
  { name: "PlaceApproach", kind: "cartesian" },
  { name: "PlacePoint", kind: "cartesian" },
];

function toolModeForLesson(id: string): "magnet" | "fork" {
  return ["intermediate-passive-fork","intermediate-rotate-carried-block","intermediate-three-layer-tower"].includes(id) ? "fork" : "magnet";
}

let lua: LuaEngine;
let python: PyodideInterface;

beforeAll(async () => {
  const factory = new LuaFactory();
  [lua, python] = await Promise.all([
    factory.createEngine({ openStandardLibs: false, injectObjects: false }),
    loadPyodide(),
  ]);
}, 60_000);

afterAll(() => {
  lua?.global.close();
  python?.globals.destroy();
});

describe("curriculum example verification", () => {
  it("uses passive Body1 fork sequences for rotation and the 0/90/0 tower", () => {
    for (const id of ["intermediate-rotate-carried-block", "intermediate-three-layer-tower"]) {
      const lesson = LESSONS.find(item => item.id === id)!;
      expect(lesson.evidenceProfile.en).toMatch(/fork/i);
      for (const source of Object.values(lesson.examples)) expect(source).not.toMatch(/\b(?:DO|do)\s*\(/);
    }
  });
  it("parses every Lua lesson example and checks its simulator API, saved points, and tool mode", () => {
    for (const lesson of LESSONS) {
      expect(() => lua.global.loadString(lesson.examples.lua, `<${lesson.id}>`), `${lesson.id} Lua syntax`).not.toThrow();
      lua.global.setTop(0);

      const report = reviewLuaSnippet(lesson.examples.lua, savedPoints, true, toolModeForLesson(lesson.id));
      expect(report.findings, `${lesson.id} Lua findings`).toEqual([]);
    }
  });

  it("parses every Python lesson example and checks its simulator API, saved points, and tool mode", () => {
    for (const lesson of LESSONS) {
      python.globals.set("__ai_source", lesson.examples.python);
      const raw = python.runPython(PYTHON_ANALYSIS);
      expect(typeof raw, `${lesson.id} Python AST result`).toBe("string");
      const inventory = JSON.parse(raw as string) as { calls: RobotCall[]; definitions: string[] };
      const report = reviewRobotCalls(
        "python",
        inventory.calls,
        new Set(inventory.definitions),
        savedPoints,
        true,
        toolModeForLesson(lesson.id),
      );
      expect(report.findings, `${lesson.id} Python findings`).toEqual([]);
      python.globals.set("__ai_source", "");
    }
  });

  it("parses both-language starter and recommended missions while preserving passive-fork restrictions", () => {
    const luaExamples = [
      { label: "magnet starter", source: DEFAULT_SCRIPT, mode: "magnet" as const },
      { label: "magnet recommendation", source: recommendedProgram("lua", "magnet"), mode: "magnet" as const },
      { label: "fork starter", source: DEFAULT_FORK_SCRIPT, mode: "fork" as const },
      { label: "fork recommendation", source: recommendedProgram("lua", "fork"), mode: "fork" as const },
      { label: "Body1 calibrated fork", source: recommendedProgram("lua", "fork", "body1"), mode: "fork" as const },
    ];
    for (const example of luaExamples) {
      expect(() => lua.global.loadString(example.source, example.label), `${example.label} syntax`).not.toThrow();
      lua.global.setTop(0);
      expect(reviewLuaSnippet(example.source, savedPoints, true, example.mode).findings, example.label).toEqual([]);
    }

    const pythonExamples = [
      { label: "magnet starter", source: DEFAULT_PYTHON_SCRIPT, mode: "magnet" as const },
      { label: "magnet recommendation", source: recommendedProgram("python", "magnet"), mode: "magnet" as const },
      { label: "fork starter", source: DEFAULT_FORK_PYTHON_SCRIPT, mode: "fork" as const },
      { label: "fork recommendation", source: recommendedProgram("python", "fork"), mode: "fork" as const },
      { label: "Body1 calibrated fork", source: recommendedProgram("python", "fork", "body1"), mode: "fork" as const },
    ];
    for (const example of pythonExamples) {
      python.globals.set("__ai_source", example.source);
      const raw = python.runPython(PYTHON_ANALYSIS);
      expect(typeof raw, `${example.label} AST result`).toBe("string");
      const inventory = JSON.parse(raw as string) as { calls: RobotCall[]; definitions: string[] };
      expect(
        reviewRobotCalls("python", inventory.calls, new Set(inventory.definitions), savedPoints, true, example.mode).findings,
        example.label,
      ).toEqual([]);
      python.globals.set("__ai_source", "");
    }
  });
});
