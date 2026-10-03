import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { loadPyodide, type PyodideInterface } from "pyodide";
import { reviewRobotCalls } from "./codeReview";
import { PYTHON_ANALYSIS } from "./pythonAnalysis";

let runtime: PyodideInterface;

beforeAll(async () => {
  runtime = await loadPyodide();
}, 60_000);

afterAll(() => runtime?.globals.destroy());

describe("local Python AST review", () => {
  it("extracts robot call names and direct point targets without running the learner code", () => {
    const source = [
      "async def teach(point):",
      "    await mov_l(point, cp=0)",
      "await mov_l(PickPoint, cp=0)",
      "await MovL(Home, cp=0)",
      "await set_do(1, True)",
      "await joint_mov_j(PickPoint, cp=0)",
    ].join("\n");
    runtime.globals.set("__ai_source", source);
    const raw = runtime.runPython(PYTHON_ANALYSIS);
    expect(typeof raw).toBe("string");
    const inventory = JSON.parse(raw as string) as {
      calls: Array<{ name: string; line: number; targetName: string | null; memberCall: boolean }>;
      definitions: string[];
    };

    expect(inventory.calls).toEqual([
      { name: "mov_l", line: 2, targetName: "point", memberCall: false },
      { name: "mov_l", line: 3, targetName: "PickPoint", memberCall: false },
      { name: "MovL", line: 4, targetName: "Home", memberCall: false },
      { name: "set_do", line: 5, targetName: null, memberCall: false },
      { name: "joint_mov_j", line: 6, targetName: "PickPoint", memberCall: false },
    ]);
    expect(inventory.definitions).toContain("point");
    expect(inventory.definitions).toContain("teach");
    expect(inventory.definitions).not.toContain("PickPoint");
    const report = reviewRobotCalls(
      "python",
      inventory.calls,
      new Set(inventory.definitions),
      [{ name: "PickPoint", kind: "cartesian" }, { name: "Home", kind: "joint" }],
      true,
      "fork",
    );
    expect(report.findings.map(({ kind }) => kind)).toEqual(["unsupported-api", "unsupported-api", "wrong-point-kind"]);
    runtime.globals.set("__ai_source", "");
  });
});

it("reviews no-await robot commands nested inside ordinary functions and branches without executing them", () => {
  runtime.globals.set("__ai_source", "def task():\n    if True:\n        mov_l(Home)\n    else:\n        do(1, ON)\nfunctions=[task]\nselected_value=functions[0]\nselected_value()");
  const inventory = JSON.parse(runtime.runPython(PYTHON_ANALYSIS) as string);
  expect(inventory.calls.map((call: {name: string; line: number}) => [call.name, call.line])).toEqual([["mov_l", 3], ["do", 5]]);
  expect(reviewRobotCalls("python", inventory.calls, new Set(inventory.definitions), [{name: "Home",kind: "cartesian"}], true, "fork").findings.map(({kind}) => kind)).toEqual(["passive-fork-action"]);
});
