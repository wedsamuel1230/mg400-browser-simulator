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
});
