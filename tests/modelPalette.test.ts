import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { MODEL_PALETTE, MODEL_VIEWPORT_BACKGROUND, ROBOT_COLOR_GROUPS, ROBOT_LINK_PALETTE } from "../src/sim/modelPalette";

const urdf = readFileSync(resolve(process.cwd(), "public/models/mg400/mg400_description/urdf/mg400_description.urdf"), "utf8");
const urdfLinkNames = [...urdf.matchAll(/<link\s+name="([^"]+)"/g)].map((match) => match[1]).sort();

function luminance(hex: string): number {
  const channels = [1, 3, 5].map((start) => Number.parseInt(hex.slice(start, start + 2), 16) / 255);
  const linear = channels.map((channel) => channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4);
  return linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722;
}

function contrastRatio(first: string, second: string): number {
  const firstLuminance = luminance(first);
  const secondLuminance = luminance(second);
  return (Math.max(firstLuminance, secondLuminance) + 0.05) / (Math.min(firstLuminance, secondLuminance) + 0.05);
}

describe("MG400 teaching color palette", () => {
  it("assigns exactly one material color to every source URDF link", () => {
    expect(Object.keys(ROBOT_LINK_PALETTE).sort()).toEqual(urdfLinkNames);
  });

  it("lists every link once and derives each legend swatch from its link material", () => {
    const legendLinks = ROBOT_COLOR_GROUPS.flatMap((group) => group.linkNames);
    expect([...legendLinks].sort()).toEqual(urdfLinkNames);
    expect(new Set(legendLinks).size).toBe(legendLinks.length);

    for (const group of ROBOT_COLOR_GROUPS) {
      const expectedColors = [...new Set(group.linkNames.map((linkName) => ROBOT_LINK_PALETTE[linkName]))];
      expect(group.colors).toEqual(expectedColors);
    }

    expect(new Set(ROBOT_COLOR_GROUPS.flatMap((group) => group.colors))).toEqual(new Set(Object.values(ROBOT_LINK_PALETTE)));
  });

  it("keeps every robot-link legend swatch at least 3:1 against the viewport background", () => {
    for (const color of new Set(Object.values(ROBOT_LINK_PALETTE))) {
      expect(contrastRatio(color, MODEL_VIEWPORT_BACKGROUND), `${color} against ${MODEL_VIEWPORT_BACKGROUND}`).toBeGreaterThanOrEqual(3);
    }
  });

  it("keeps the rendered scene and teaching guide on one accessory palette", () => {
    expect(MODEL_PALETTE.magnet).toBe("#c84e3d");
    expect(MODEL_PALETTE.fork).toBe("#91aaa5");
    expect(MODEL_PALETTE.tcp).toBe("#f1c266");
    expect(MODEL_PALETTE.target).toBe("#7ce3d1");
    expect(MODEL_PALETTE.block).toBe("#ffa63d");
  });
});
