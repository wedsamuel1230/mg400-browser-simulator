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
});
