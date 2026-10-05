import { describe, expect, it } from "vitest";
import { localizeWorkspaceMessage } from "./localizeWorkspaceMessage";

describe("workspace message localization", () => {
  it("translates common motion failures for the default Traditional Chinese interface", () => {
    expect(localizeWorkspaceMessage("Jog stopped at J2 limit (-25° to 85°).", "zh-Hant"))
      .toBe("點動已停止：J2 目標超出限制（-25° 至 85°）。");
    expect(localizeWorkspaceMessage("Pick failed: no eligible source block is within the configured pickup tolerance.", "zh-Hant"))
      .toBe("拾取失敗：請檢查工件位置及目前工具的拾取容差。");
  });

  it("preserves English messages in English mode and unknown diagnostics", () => {
    const message = "A new diagnostic from the worker.";
    expect(localizeWorkspaceMessage(message, "en")).toBe(message);
    expect(localizeWorkspaceMessage(message, "zh-Hant")).toBe(message);
  });

  it("explains the simulator's CP limit in Traditional Chinese", () => {
    expect(localizeWorkspaceMessage(
      "UNSUPPORTED_OPTION: continuous-path blending requires CP=0 in this version",
      "zh-Hant",
    )).toBe("目前版本只支援 CP=0，尚未模擬非零 CP 的連續路徑混合。CP 不是 TCP 座標；請將移動選項設為 CP=0。");
    expect(localizeWorkspaceMessage(
      "Traceback: ValueError: UNSUPPORTED_OPTION: this simulator supports CP=0 only",
      "zh-Hant",
    )).toContain("CP 不是 TCP 座標");
    expect(localizeWorkspaceMessage(
      "CP omitted; this simulator uses CP=0. DobotStudio Pro documents CP=1 by default.",
      "zh-Hant",
    )).toContain("請在指令中明確寫出 {CP=0}");
  });

  it("translates simulation start, completion, and go-to logs for Traditional Chinese", () => {
    expect(localizeWorkspaceMessage("Python program started in the isolated browser worker.", "zh-Hant"))
      .toBe("Python 程式已在本機隔離工作執行器中開始執行。");
    expect(localizeWorkspaceMessage("Program and queued simulation motions completed.", "zh-Hant"))
      .toBe("程式及排隊中的模擬動作已完成。");
    expect(localizeWorkspaceMessage("Moving smoothly to PickApproach…", "zh-Hant"))
      .toBe("正平順移動至 PickApproach…");
    expect(localizeWorkspaceMessage("Reached PickApproach.", "zh-Hant"))
      .toBe("已到達 PickApproach。");
  });

  it("translates teach, program-loading, and recovery logs for Traditional Chinese", () => {
    expect(localizeWorkspaceMessage(
      "Taught pick and approach points above the reference cell block.",
      "zh-Hant",
    )).toBe("已在參考工作格的方塊上方示教拾取點及接近點。");
    expect(localizeWorkspaceMessage(
      "Taught the fork entry point 60 mm before the block and the insertion point at its 35 mm contact plane.",
      "zh-Hant",
    )).toBe("已在方塊前方 60 mm 示教叉臂入口點，並在 Z 35 mm 接觸平面示教插入點。");
    expect(localizeWorkspaceMessage("Loaded the recommended Python pick-and-place template.", "zh-Hant"))
      .toBe("已載入 Python 取放程式範例。");
    expect(localizeWorkspaceMessage("Lua lesson example loaded into the program editor.", "zh-Hant"))
      .toBe("已將 Lua 課程範例載入程式編輯器。");
    expect(localizeWorkspaceMessage("Simulation stopped. The robot holds its current pose.", "zh-Hant"))
      .toBe("模擬已停止；機械臂保持目前姿勢。");
    expect(localizeWorkspaceMessage(
      "DO1 is only a virtual output in Fork mode. Slide beneath the block and lift to pick it up; lower it onto the table to release it.",
      "zh-Hant",
    )).toContain("叉臂模式中的 DO1");
    expect(localizeWorkspaceMessage(
      "Fork lowered the block onto the support pads at X 250.0 mm, Y 90.0 mm.",
      "zh-Hant",
    )).toBe("叉臂已將方塊降至支撐墊（X 250.0 mm，Y 90.0 mm）。");
    expect(localizeWorkspaceMessage(
      "Magnet attached puck-1 at X 250.0 mm, Y 90.0 mm.",
      "zh-Hant",
    )).toBe("磁吸工具已吸附「puck-1」（X 250.0 mm，Y 90.0 mm）。");
    expect(localizeWorkspaceMessage(
      "Block puck-1 placed at X 250.0 mm, Y 90.0 mm, Z 48.0 mm, R 90.0°.",
      "zh-Hant",
    )).toBe("方塊「puck-1」已放置於 X 250.0 mm、Y 90.0 mm，Z 48.0 mm，R 90.0°。");
    expect(localizeWorkspaceMessage(
      "Straight-line motion failed preflight at 45% (2.1 mm position error).",
      "zh-Hant",
    )).toBe("直線移動預檢在 45% 失敗（位置誤差 2.1 mm）。");
  });
});
