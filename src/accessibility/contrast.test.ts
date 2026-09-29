import { describe, expect, it } from "vitest";
// @ts-expect-error This test reads project CSS in Node; the browser app intentionally has no Node type dependency.
import { readFileSync } from "node:fs";

const styles = readFileSync("src/styles.css", "utf8");

function declarationFor(selector: string, property: "color" | "background"): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const rule = styles.match(new RegExp("(?:^|})\\s*" + escaped + "\\s*\\{([^}]*)\\}"));
  if (!rule) throw new Error(`Could not find CSS rule for ${selector}.`);
  const declaration = property === "color"
    ? rule[1].match(/(?:^|;)\s*color\s*:\s*(#[\da-f]{6})\b/i)?.[1]
    : rule[1].match(/(?:^|;)\s*background(?:-color)?\s*:\s*(#[\da-f]{6})\b/i)?.[1];
  if (!declaration) throw new Error(`Could not read ${property} for ${selector}.`);
  return declaration;
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

describe("small UI text contrast", () => {
  it("keeps lesson assessment attempt text at WCAG AA normal-text contrast", () => {
    const color = declarationFor(".attempt-count", "color");
    const background = declarationFor(".lesson-code-section, .lesson-assessment", "background");
    expect(contrastRatio(color, background)).toBeGreaterThanOrEqual(4.5);
  });

  it("keeps disabled joint values readable while motion is running", () => {
    const color = declarationFor(".numeric-input-wrap input:disabled", "color");
    const background = declarationFor(".numeric-input-wrap input:disabled", "background");
    expect(contrastRatio(color, background)).toBeGreaterThanOrEqual(4.5);
  });

  it("gives the keyboard-placement canvas a visible high-contrast focus ring", () => {
    const rule = styles.match(/\.robot-canvas:focus-visible\s*\{([^}]*)\}/);
    expect(rule?.[1]).toMatch(/outline:\s*3px solid #ffe09d/i);
    const color = rule?.[1].match(/outline:\s*3px solid (#[\da-f]{6})/i)?.[1];
    expect(color).toBeDefined();
    expect(contrastRatio(color!, "#10171a")).toBeGreaterThanOrEqual(3);
  });
});
