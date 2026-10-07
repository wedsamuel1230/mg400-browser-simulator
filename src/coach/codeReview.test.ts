import { describe, expect, it } from "vitest";
import { inspectLuaCalls, reviewLuaSnippet, reviewRobotCalls } from "./codeReview";
import { coachText } from "./coachLanguage";

const points = [
  { name: "PickPoint", kind: "cartesian" as const },
  { name: "Home", kind: "joint" as const },
];

describe("AI example static review", () => {
  it("ignores passive-fork command text in Lua comments and strings", () => {
    const report = reviewLuaSnippet(
      '-- DO(1, ON) is not used by the fork\nlocal note = "Place() is just text"',
      [],
      false,
      "fork",
    );

    expect(report.robotCallCount).toBe(0);
    expect(report.findings).toEqual([]);
  });

  it("recognizes Lua API calls without mistaking local helper functions for robot commands", () => {
    const report = reviewLuaSnippet(
      "local function moveBlock(point) print(point) end\nmoveBlock(PickPoint)\nMovL(PickPoint, {CP=0})",
      points,
      true,
      "magnet",
    );

    expect(report.robotCallCount).toBe(1);
    expect(report.pointTargetCount).toBe(1);
    expect(report.pointsStatus).toBe("checked");
    expect(report.findings).toEqual([]);
  });

  it("detects unsupported robot-style Lua calls and unknown saved motion targets", () => {
    const report = reviewLuaSnippet("MovR(PickPoint)\nMovL(PikPoint)", points, true, "magnet");

    expect(report.findings.map(({ kind }) => kind)).toEqual(["unsupported-api", "missing-point"]);
    expect(report.findings[0].message).toContain("MovR");
    expect(report.findings[1].message).toContain("PikPoint");
  });

  it("rejects malformed Lua motion suggestions from the live coach", () => {
    const report = reviewLuaSnippet(
      'MovJ("PLACEHOLDER_APPROACH", {cp=0})\nMovL(200, 0, 150, 0)\nRelMovL({z=10}, {cp=0})',
      [],
      false,
      "fork",
    );

    expect(report.findings.map(({ kind }) => kind)).toEqual([
      "invalid-motion-target",
      "invalid-motion-option",
      "invalid-motion-target",
      "invalid-motion-option",
      "invalid-relative-offset",
    ]);
    expect(report.findings[0].message).toContain("point table");
    expect(report.findings[1].message).toContain("CP");
    expect(report.findings[2].message).toContain("raw numeric coordinate list");
    expect(report.findings[3].message).toContain("CP");
    expect(report.findings[4].message).toContain("X, Y, Z, and R");
  });

  it("accepts the supported motion point, option, and relative-offset forms", () => {
    const report = reviewLuaSnippet(
      "MovJ(PickPoint, {CP=0})\nRelMovL({0, 0, 20, 0}, {CP=0})\nRelMovL({OffsetX=0, OffsetY=0, OffsetZ=20, OffsetR=0}, {CP=0, SpeedL=50, AccL=20})\nRelMovL({x=0,y=0,z=20,r=0}, {CP=0})",
      points,
      true,
      "magnet",
    );

    expect(report.findings).toEqual([]);
  });

  it("requires R in literal positional and named Lua offsets, including the translated guidance", () => {
    const report = reviewLuaSnippet(
      "RelMovL({0, 0, -20}, {CP=0})\nRelMovL({OffsetX=0, OffsetY=0, OffsetZ=20}, {CP=0})\nRelMovL({x=0,y=0,z=20}, {CP=0})",
      [], false, "magnet",
    );

    expect(report.findings.map(({ kind, line }) => ({ kind, line }))).toEqual([
      { kind: "invalid-relative-offset", line: 1 },
      { kind: "invalid-relative-offset", line: 2 },
      { kind: "invalid-relative-offset", line: 3 },
    ]);
    expect(report.findings[0].message).toContain("use R=0");
    expect(coachText(report.findings[0].message, "zh-Hant")).toBe("RelMovL 偏移資料需要 X、Y、Z、R，可依序排列或使用命名欄位；毋須旋轉時請填 R=0。");
  });

  it("leaves dynamic Lua offsets to runtime validation", () => {
    const report = reviewLuaSnippet(
      "RelMovL(offset, {CP=0})\nRelMovL({dx, 0, height*2, rotation}, {CP=0})\nRelMovL({0, 0, table.unpack(tail)}, {CP=0})",
      [], false, "magnet",
    );

    expect(report.findings).toEqual([]);
  });

  it("checks saved point kind for Cartesian and joint movement commands", () => {
    const report = reviewLuaSnippet("JointMovJ(PickPoint)\nMovL(Home)", points, true, "magnet");

    expect(report.findings.map(({ kind }) => kind)).toEqual(["wrong-point-kind", "wrong-point-kind"]);
    expect(report.findings[0].message).toContain("joint point");
    expect(report.findings[1].message).toContain("Cartesian point");
  });

  it("treats locally declared motion targets as unverified rather than missing", () => {
    const report = reviewLuaSnippet("local PickPoint = {coordinate={x=1,y=2,z=3}}\nMovL(PickPoint)", [], true, "magnet");

    expect(report.findings).toEqual([]);
    expect(report.pointsStatus).toBe("local-targets");
    expect(report.unresolvedLocalTargetCount).toBe(1);
  });

  it("ignores commands inside Lua long comments and long strings", () => {
    const source = "--[=[ DO(1, ON) ]=]\nlocal example = [==[ Place() ]==]";
    const report = reviewLuaSnippet(source, [], false, "fork");

    expect(inspectLuaCalls(source).calls).toEqual([]);
    expect(report.findings).toEqual([]);
  });

  it("flags active powered actions in passive-fork mode", () => {
    const report = reviewLuaSnippet("DO(1, ON)\nPlace()", [], false, "fork");

    expect(report.findings.map(({ kind }) => kind)).toEqual(["passive-fork-action", "passive-fork-action"]);
  });

  it("checks Python AST call inventory against the bounded API and shared points", () => {
    const report = reviewRobotCalls(
      "python",
      [
        { name: "mov_l", line: 1, targetName: "PickPoint" },
        { name: "joint_mov_j", line: 2, targetName: "Home" },
        { name: "move_j", line: 3, targetName: "Home" },
      ],
      new Set(),
      points,
      true,
      "fork",
    );

    expect(report.findings.map(({ kind }) => kind)).toEqual(["unsupported-api"]);
    expect(report.pointsStatus).toBe("checked");
  });

  it("does not claim to check saved targets when the learner has not shared project context", () => {
    const report = reviewRobotCalls(
      "python",
      [{ name: "mov_j", line: 1, targetName: "PickPoint" }],
      new Set(),
      [],
      false,
      "magnet",
    );

    expect(report.findings).toEqual([]);
    expect(report.pointsStatus).toBe("not-shared");
  });
});
