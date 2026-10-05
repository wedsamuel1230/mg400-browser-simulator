import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { RelMovLMathActivity } from "./RelMovLMathActivity";
import { DEFAULT_PROJECT } from "../data/defaultProject";
import type { JointAngles, Pose } from "../domain";
import { MG400Kinematics } from "../sim/mg400Kinematics";
import urdf from "../../public/models/mg400/mg400_description/urdf/mg400_description.urdf?raw";

const exampleCode = () => [...document.querySelectorAll(".relmovl-examples pre")].map((element) => element.textContent ?? "").join("\n");
const initialJoints = [0, Math.PI / 6, Math.PI / 4, 0] as JointAngles;
const loadedKinematics = MG400Kinematics.fromUrdf(urdf);
const kinematicsFor = (isReachable: (pose: Pose) => boolean = () => true) => ({
  solve: (pose: Pose, seed: JointAngles) => isReachable(pose)
    ? { ok: true as const, joints: seed, positionErrorMm: 0, angleErrorDeg: 0 }
    : { ok: false as const, joints: seed, positionErrorMm: 9.2, angleErrorDeg: 0 },
}) as Pick<MG400Kinematics, "solve">;

describe("RelMovL math activity", () => {
  afterEach(cleanup);

  it("shows block stack coordinates, offsets, graph labels, and N−1 Lua/Python steps", () => {
    render(<RelMovLMathActivity language="en" />);
    expect(screen.getByRole("link", { name: "Open the visual math guide ↗" })).toHaveAttribute("href", "/learning/relmovl-math.html");
    expect(screen.getByText(/40×40×40 mm/)).toBeInTheDocument();
    expect(screen.getByText(/ΔZᵢ = i × h; Zᵢ = Z₀ \+ ΔZᵢ/)).toBeInTheDocument();
    expect(screen.getByText(/N = number of pieces; i = target index starting at 0; h = height or thickness per stacked piece/)).toBeInTheDocument();
    expect(screen.getByText(/Assume P₀ starts at Z₀ = 135 mm: Z targets 135 → 175 → 215 mm/)).toBeInTheDocument();
    expect(screen.getByText(/ΔZ 0 → 40 → 80 mm/)).toBeInTheDocument();
    expect(screen.getByText(/Total stack height/).parentElement).toHaveTextContent("120 mm");
    expect(screen.getByRole("img", { name: /Target offset from the first point/ }).querySelector("desc")).toHaveTextContent("Target P0: Z target 135 mm; offset from P₀ 0 mm; Target P1: Z target 175 mm; offset from P₀ 40 mm; Target P2: Z target 215 mm; offset from P₀ 80 mm");
    expect(screen.getByText(/N pieces mean N targets.*MovJ to reach P₀, then repeats the selected RelMovL step N−1 times.*loaded MG400 model checks P₀ and every later straight segment/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Copy code · Lua" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Copy code · Python" })).toBeInTheDocument();
    expect(screen.getAllByText("Swipe left or right to view all code.")).toHaveLength(2);
    for (const name of ["Lua code example", "Python code example"]) {
      const codeRegion = screen.getByRole("region", { name });
      expect(codeRegion).toHaveAttribute("tabindex", "0");
      codeRegion.focus();
      expect(document.activeElement).toBe(codeRegion);
    }
    expect(screen.getByText(/Copy the matching Lua or Python example below; pasting edits the program but does not run it/)).toBeInTheDocument();
    expect(document.querySelector(".relmovl-comparison")).toHaveTextContent("Named targets: Z135 / Z175 / Z215 mm · RelMovL after P₀ +Z 40 mm × 2");
    expect(exampleCode()).toContain("local P0 = {coordinate = {x=300, y=80, z=135, r=-90}}");
    expect(exampleCode()).toContain("MovJ(P0, {CP=0, SYNC=1})");
    expect(exampleCode()).toContain("for i = 1, 2 do");
    expect(exampleCode()).toContain("RelMovL({0,0,40,0}, {CP=0, SYNC=1})");
    expect(exampleCode()).toContain("def move_to_next_targets():");
    expect(exampleCode()).toContain('P0 = {"coordinate": {"x": 300, "y": 80, "z": 135, "r": -90}}');
    expect(exampleCode()).toContain("mov_j(P0, cp=0)");
    expect(exampleCode()).toContain("for _ in range(2):");
    expect(exampleCode()).toContain("move_to_next_targets()");
    expect(exampleCode()).not.toMatch(/\bawait\b/);
    const [lua, python] = [...document.querySelectorAll(".relmovl-examples pre")].map((element) => element.textContent ?? "");
    expect(lua.indexOf("MovJ(P0")).toBeLessThan(lua.indexOf("RelMovL("));
    expect(python.indexOf("mov_j(P0")).toBeLessThan(python.indexOf("rel_mov_l("));
  });

  it("updates magnet row coordinates and relative offsets in Traditional Chinese", () => {
    render(<RelMovLMathActivity language="zh-Hant" />);
    expect(screen.getByRole("link", { name: "開啟步距數學圖解 ↗" })).toHaveAttribute("href", "/learning/relmovl-math.html");
    expect(screen.getByRole("button", { name: "複製程式碼 · Lua" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "複製程式碼 · Python" })).toBeInTheDocument();
    expect(screen.getAllByText("向左或向右滑動，查看完整程式碼。")).toHaveLength(2);
    for (const name of ["Lua 程式碼範例", "Python 程式碼範例"]) {
      const codeRegion = screen.getByRole("region", { name });
      expect(codeRegion).toHaveAttribute("tabindex", "0");
      codeRegion.focus();
      expect(document.activeElement).toBe(codeRegion);
    }
    expect(screen.getByText(/貼入編輯器只會修改程式，不會自動執行/)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("物件"), { target: { value: "magnet" } });
    expect(screen.getByText(/絕對目標 Z = 114 → 118 → 122 mm/)).toBeInTheDocument();
    expect(exampleCode()).toContain('P0 = {"coordinate": {"x": 300, "y": 80, "z": 114, "r": 0}}');
    expect(exampleCode()).toContain("# P0 是示範首點；請按所選工具及工作區，示教一個可達位置。");
    expect(exampleCode()).toContain("rel_mov_l([0,0,4,0], cp=0)");
    fireEvent.change(screen.getByLabelText("排列方式"), { target: { value: "row" } });
    expect(screen.getByText(/35×35×4 mm/)).toBeInTheDocument();
    expect(exampleCode()).toContain('P0 = {"coordinate": {"x": 300, "y": -80, "z": 114, "r": 0}}');
    expect(document.querySelector(".relmovl-math > p")).toHaveTextContent("相對步進向量 X/Y/Z/R（mm、mm、mm、°）: (0, 35, 0, 0)");
    expect(screen.getByText(/ΔYᵢ = i ×（w \+ gap）；Yᵢ = Y₀ \+ ΔYᵢ/)).toBeInTheDocument();
    expect(screen.getByText(/N = 件數；i = 由 0 起算的目標序號；h = 每件堆疊高度或厚度/)).toBeInTheDocument();
    expect(screen.getByText(/絕對目標 Y = -80 → -45 → -10 mm/)).toBeInTheDocument();
    expect(screen.getByText(/相對偏移 ΔY = 0 → 35 → 70 mm/)).toBeInTheDocument();
    expect(screen.getByText(/列間空隙：0 mm/)).toBeInTheDocument();
    expect(document.querySelector(".relmovl-graph desc")).toHaveTextContent("目標 P0：Y 座標 -80 毫米；相對 P₀ 偏移 0 毫米；目標 P1：Y 座標 -45 毫米；相對 P₀ 偏移 35 毫米；目標 P2：Y 座標 -10 毫米；相對 P₀ 偏移 70 毫米");
    expect(screen.getByText(/使用一般函式呼叫/)).toBeInTheDocument();
    expect(screen.getByText("Python · 僅供模擬器使用")).toBeInTheDocument();
    expect(exampleCode()).toContain("RelMovL({0,35,0,0}, {CP=0, SYNC=1})");
    expect(exampleCode()).toContain("rel_mov_l([0,35,0,0], cp=0)");
    expect(exampleCode()).not.toMatch(/\bawait\b/);
    expect(document.querySelector(".relmovl-comparison")).toHaveTextContent("逐點指定目標: Y-80 / Y-45 / Y-10 mm · 由 P₀ 開始 RelMovL +Y 35 mm × 2");
  });

  it("uses the selected piece count for N−1 loop iterations and target coordinates", () => {
    render(<RelMovLMathActivity language="en" />);
    fireEvent.change(screen.getByLabelText("Pattern"), { target: { value: "row" } });
    fireEvent.change(screen.getByLabelText("Pieces"), { target: { value: "5" } });
    expect(screen.getByText(/Y targets -80 → -40 → 0 → 40 → 80 mm/)).toBeInTheDocument();
    expect(screen.getByText(/ΔY 0 → 40 → 80 → 120 → 160 mm/)).toBeInTheDocument();
    expect(document.querySelector(".relmovl-graph desc")).toHaveTextContent("Target P4: Y target 80 mm; offset from P₀ 160 mm");
    expect(exampleCode()).toContain("for i = 1, 4 do");
    expect(exampleCode()).toContain("RelMovL({0,40,0,0}, {CP=0, SYNC=1})");
    expect(exampleCode()).toContain("for _ in range(4):");
    expect(exampleCode()).not.toMatch(/\bawait\b/);
    expect(document.querySelector(".relmovl-comparison")).toHaveTextContent("Named targets: Y-80 / Y-40 / Y0 / Y40 / Y80 mm · RelMovL after P₀ +Y 40 mm × 4");
    const graph = document.querySelector(".relmovl-graph")!;
    expect(graph.getAttribute("viewBox")).toBe("0 0 330 185");
    expect(graph.querySelectorAll("circle")).toHaveLength(5);
    const yAxisTitle = graph.querySelector(".relmovl-y-axis-title")!;
    expect(yAxisTitle.textContent).toBe("ΔY Offset from P₀ (mm)");
    expect(yAxisTitle.getAttribute("x")).toBe("42");
    expect(yAxisTitle.getAttribute("y")).toBe("17");
    expect(yAxisTitle.hasAttribute("transform")).toBe(false);
    expect(graph.querySelector("polyline.relmovl-connector")?.getAttribute("points")).toBe("50,135 110,108.75 170,82.5 230,56.25 290,30");
    expect(graph.querySelector("polyline.relmovl-connector")).toBeInTheDocument();
  });

  it("preflights P₀ and every generated straight-line segment for the selected tool", () => {
    render(<RelMovLMathActivity language="zh-Hant" project={DEFAULT_PROJECT} joints={initialJoints} kinematics={kinematicsFor()} />);
    const checks = [...document.querySelectorAll(".relmovl-preflight li")];
    expect(checks).toHaveLength(3);
    expect(checks.map((check) => check.className)).toEqual(["relmovl-check-pass", "relmovl-check-pass", "relmovl-check-pass"]);
    expect(document.querySelector(".relmovl-preflight-summary")).toHaveTextContent("所有生成目標及 RelMovL 直線步進均通過");
    expect(document.querySelector(".relmovl-preflight-caveat")).toHaveTextContent("不檢查碰撞、工具接觸或實體機械臂安全");
  });

  it("confirms the published block and magnet sample paths against the bundled MG400 model", () => {
    render(<RelMovLMathActivity language="zh-Hant" project={DEFAULT_PROJECT} joints={initialJoints} kinematics={loadedKinematics} />);
    expect([...document.querySelectorAll(".relmovl-preflight li")].map((check) => check.className)).toEqual([
      "relmovl-check-pass", "relmovl-check-pass", "relmovl-check-pass",
    ]);
    fireEvent.change(screen.getByLabelText("物件"), { target: { value: "magnet" } });
    fireEvent.change(screen.getByLabelText("排列方式"), { target: { value: "row" } });
    expect([...document.querySelectorAll(".relmovl-preflight li")].map((check) => check.className)).toEqual([
      "relmovl-check-pass", "relmovl-check-pass", "relmovl-check-pass",
    ]);
    expect(document.querySelector(".relmovl-preflight-summary")).toHaveTextContent("所有生成目標及 RelMovL 直線步進均通過");
  });

  it("identifies the first unreachable path and leaves later targets unchecked", () => {
    render(<RelMovLMathActivity language="zh-Hant" project={DEFAULT_PROJECT} joints={initialJoints} kinematics={kinematicsFor((pose) => pose.z < 165)} />);
    const checks = [...document.querySelectorAll(".relmovl-preflight li")];
    expect(checks.map((check) => check.className)).toEqual(["relmovl-check-pass", "relmovl-check-fail", "relmovl-check-unchecked"]);
    expect(checks[1]).toHaveTextContent("直線路徑在 75% 處不可達");
    expect(checks[2]).toHaveTextContent("未檢查");
  });

  it("does not claim a reachability result while the model is missing", () => {
    render(<RelMovLMathActivity language="zh-Hant" modelError="URDF unavailable" />);
    expect(document.querySelector(".relmovl-preflight")).toHaveTextContent("MG400 運動學模型未能載入");
    expect(document.querySelector(".relmovl-preflight li")).toBeNull();
  });

  it("keeps Body1's fork contact height and alignment in both patterns", () => {
    render(<RelMovLMathActivity language="en" />);
    expect(exampleCode()).toContain('P0 = {"coordinate": {"x": 300, "y": 80, "z": 135, "r": -90}}');
    fireEvent.change(screen.getByLabelText("Pattern"), { target: { value: "row" } });
    expect(exampleCode()).toContain('P0 = {"coordinate": {"x": 300, "y": -80, "z": 135, "r": -90}}');
  });
});
