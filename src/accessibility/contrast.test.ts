import { describe, expect, it } from "vitest";
// @ts-expect-error This test reads project CSS in Node; the browser app intentionally has no Node type dependency.
import { readFileSync } from "node:fs";

const styles = readFileSync("src/styles.css", "utf8").replace(/\/\*[\s\S]*?\*\//g, "");

type Theme = "light" | "dark";

function tokensFor(theme: Theme): Record<string, string> {
  const read = (selector: string): Record<string, string> => {
    const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const rule = styles.match(new RegExp("(?:^|})\\s*" + escaped + "\\s*\\{([^}]*)\\}"));
    if (!rule) throw new Error(`Could not find CSS palette for ${selector}.`);
    return Object.fromEntries([...rule[1].matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)].map((match) => [match[1], match[2].trim()]));
  };
  return { ...read(":root"), ...(theme === "dark" ? read(":root[data-theme='dark']") : {}) };
}

function resolveColor(value: string, theme: Theme): string {
  const tokens = tokensFor(theme);
  let resolved = value;
  for (let depth = 0; depth < 10 && resolved.startsWith("var("); depth += 1) {
    const name = resolved.match(/^var\((--[\w-]+)\)$/)?.[1];
    if (!name || !tokens[name]) throw new Error(`Could not resolve ${resolved}.`);
    resolved = tokens[name];
  }
  if (!/^#[\da-f]{6}([\da-f]{2})?$/i.test(resolved)) throw new Error(`Expected a hex color, received ${resolved}.`);
  return resolved;
}

function declarationFor(selector: string, property: "color" | "background", theme: Theme): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const rule = styles.match(new RegExp("(?:^|})\\s*" + escaped + "\\s*\\{([^}]*)\\}"));
  if (!rule) throw new Error(`Could not find CSS rule for ${selector}.`);
  const declaration = property === "color"
    ? rule[1].match(/(?:^|;)\s*color\s*:\s*([^;]+)/i)?.[1]
    : rule[1].match(/(?:^|;)\s*background(?:-color)?\s*:\s*([^;]+)/i)?.[1];
  if (!declaration) throw new Error(`Could not read ${property} for ${selector}.`);
  return resolveColor(declaration.trim(), theme);
}

function compositeColor(foreground: string, background: string): string {
  if (foreground.length === 7) return foreground;
  const alpha = parseInt(foreground.slice(7, 9), 16) / 255;
  return "#" + [1, 3, 5].map((offset) => {
    const front = parseInt(foreground.slice(offset, offset + 2), 16);
    const back = parseInt(background.slice(offset, offset + 2), 16);
    return Math.round(front * alpha + back * (1 - alpha)).toString(16).padStart(2, "0");
  }).join("");
}

function relativeLuminance(hex: string): number {
  const channels = [1, 3, 5].map((offset) => parseInt(hex.slice(offset, offset + 2), 16) / 255);
  const linear = channels.map((value) => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
}

function contrastRatio(foreground: string, background: string): number {
  const a = relativeLuminance(foreground);
  const b = relativeLuminance(background);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

describe.each(["light", "dark"] as const)("%s UI text contrast", (theme) => {
  it("keeps lesson assessment attempt text at WCAG AA normal-text contrast", () => {
    const color = declarationFor(".attempt-count", "color", theme);
    const background = declarationFor(".lesson-code-section, .lesson-assessment", "background", theme);
    expect(contrastRatio(color, background)).toBeGreaterThanOrEqual(4.5);
  });

  it("keeps disabled joint values readable while motion is running", () => {
    const color = declarationFor(".numeric-input-wrap input:disabled", "color", theme);
    const background = declarationFor(".numeric-input-wrap input:disabled", "background", theme);
    expect(contrastRatio(color, background)).toBeGreaterThanOrEqual(4.5);
  });

  it("gives the keyboard-placement canvas a visible high-contrast focus ring", () => {
    const rule = styles.match(/\.robot-canvas:focus-visible\s*\{([^}]*)\}/);
    expect(rule?.[1]).toMatch(/outline:\s*3px solid var\(--viewport-focus\)/i);
    const color = resolveColor("var(--viewport-focus)", theme);
    expect(contrastRatio(color, resolveColor("var(--viewport-bg)", theme))).toBeGreaterThanOrEqual(3);
  });

  it("keeps scene labels readable over any robot pose with opaque theme-matched chips", () => {
    const chip = resolveColor("var(--viewport-chip)", theme);
    expect(chip).toMatch(/^#[\da-f]{6}$/i);

    for (const [selector, foreground] of [
      [".hud-chip", "--viewport-text"],
      [".scene-caption > span", "--viewport-text"],
      [".scene-controls", "--viewport-muted"],
      [".model-color-guide summary", "--viewport-text"],
    ]) {
      const surface = declarationFor(selector, "background", theme);
      expect(surface).toBe(chip);
      expect(contrastRatio(resolveColor(`var(${foreground})`, theme), surface)).toBeGreaterThanOrEqual(4.5);
    }
  });

  const pairs = [
    ["page text", "--text", "--bg"],
    ["panel text", "--text", "--panel"],
    ["code and numeric text", "--text", "--panel-raised"],
    ["sidebar text", "--text", "--panel-subtle"],
    ["page descriptions", "--muted", "--bg"],
    ["panel descriptions", "--muted", "--panel"],
    ["code descriptions", "--muted", "--panel-raised"],
    ["sidebar descriptions", "--muted", "--panel-subtle"],
    ["links", "--accent", "--panel"],
    ["selected navigation", "--accent-strong", "--accent-soft"],
    ["primary buttons", "--on-accent", "--accent"],
    ["hovered primary buttons", "--on-accent", "--accent-hover"],
    ["warnings", "--warning", "--warning-bg"],
    ["error messages", "--error", "--panel"],
    ["success messages", "--success", "--panel"],
    ["scene text", "--viewport-text", "--viewport-chip"],
    ["scene help", "--viewport-muted", "--viewport-guide"],
    ["loading text", "--viewport-muted", "--viewport-overlay"],
    ["placement instructions", "--placement-text", "--placement-bg"],
    ["editor loading text", "--editor-text", "--editor-bg"],
  ];
  it.each(pairs)("keeps %s at WCAG AA normal-text contrast", (_label, foreground, background) => {
    const color = resolveColor(`var(${foreground})`, theme);
    const backdrop = resolveColor("var(--viewport-bg)", theme);
    const surface = compositeColor(resolveColor(`var(${background})`, theme), backdrop);
    expect(contrastRatio(color, surface)).toBeGreaterThanOrEqual(4.5);
  });
});
