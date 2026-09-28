import { describe, expect, it } from "vitest";
import { getRovingFocusIndex } from "./rovingFocus";

describe("roving focus navigation", () => {
  it("wraps through horizontal tabs with left and right arrows", () => {
    expect(getRovingFocusIndex("ArrowRight", 0, 2, "horizontal")).toBe(1);
    expect(getRovingFocusIndex("ArrowRight", 1, 2, "horizontal")).toBe(0);
    expect(getRovingFocusIndex("ArrowLeft", 0, 2, "horizontal")).toBe(1);
  });

  it("wraps through vertical options with up and down arrows", () => {
    expect(getRovingFocusIndex("ArrowDown", 0, 5, "vertical")).toBe(1);
    expect(getRovingFocusIndex("ArrowDown", 4, 5, "vertical")).toBe(0);
    expect(getRovingFocusIndex("ArrowUp", 0, 5, "vertical")).toBe(4);
  });

  it("moves to the first and last item and ignores unrelated keys", () => {
    expect(getRovingFocusIndex("Home", 3, 5, "vertical")).toBe(0);
    expect(getRovingFocusIndex("End", 1, 5, "horizontal")).toBe(4);
    expect(getRovingFocusIndex("ArrowDown", 0, 2, "horizontal")).toBeNull();
    expect(getRovingFocusIndex("Enter", 0, 2, "horizontal")).toBeNull();
    expect(getRovingFocusIndex("ArrowDown", 0, 0, "vertical")).toBeNull();
  });
});
