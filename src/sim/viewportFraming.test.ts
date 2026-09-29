import { describe, expect, it } from "vitest";
import { viewportVerticalFov } from "./SimulatorScene";

describe("viewport camera framing", () => {
  it("preserves the baseline vertical field on landscape viewports", () => {
    expect(viewportVerticalFov(42, 1.7)).toBe(42);
  });

  it("widens the vertical field on portrait viewports so the horizontal framing stays usable", () => {
    expect(viewportVerticalFov(42, 0.65)).toBeGreaterThan(42);
    expect(viewportVerticalFov(42, 0.65)).toBeLessThanOrEqual(75);
    expect(viewportVerticalFov(42, 0)).toBe(42);
  });
});
