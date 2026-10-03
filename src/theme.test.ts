import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readWorkspaceTheme, saveWorkspaceTheme, THEME_STORAGE_KEY } from "./theme";

describe("workspace theme preference", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: true })));
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  it("uses the OS preference when no manual preference exists", () => {
    expect(readWorkspaceTheme()).toBe("dark");
    vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: false })));
    expect(readWorkspaceTheme()).toBe("light");
  });

  it.each(["light", "dark"] as const)("persists a manual %s choice across reads", (theme) => {
    saveWorkspaceTheme(theme);
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe(theme);
    expect(readWorkspaceTheme()).toBe(theme);
    expect(window.matchMedia).not.toHaveBeenCalled();
  });

  it("ignores malformed saved preferences", () => {
    localStorage.setItem(THEME_STORAGE_KEY, "automatic");
    expect(readWorkspaceTheme()).toBe("dark");
  });

  it("still uses the OS preference when storage reads are blocked", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("blocked"); });
    expect(readWorkspaceTheme()).toBe("dark");
  });

  it("allows a theme change when storage writes are blocked", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("blocked"); });
    expect(() => saveWorkspaceTheme("dark")).not.toThrow();
  });

  it("falls back to light when media queries are unavailable", () => {
    vi.stubGlobal("matchMedia", undefined);
    expect(readWorkspaceTheme()).toBe("light");
  });

  it("falls back to light in a non-browser environment", () => {
    vi.stubGlobal("window", undefined);
    expect(readWorkspaceTheme()).toBe("light");
    expect(() => saveWorkspaceTheme("dark")).not.toThrow();
  });
});
