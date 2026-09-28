export const MODEL_PALETTE = {
  base: "#71868d",
  shoulder: "#c55a4e",
  rearArm: "#a96732",
  forearm: "#92752c",
  wrist: "#347a6d",
  parallelLinkage: "#2c806d",
  flange: "#6985bd",
  unmappedLink: "#788783",
  magnet: "#c84e3d",
  fork: "#91aaa5",
  tcp: "#f1c266",
  target: "#7ce3d1",
  targetCenter: "#e8fff8",
  block: "#ffa63d",
} as const;

export const MODEL_VIEWPORT_BACKGROUND = "#10171a";

export const ROBOT_LINK_PALETTE = {
  base_link: MODEL_PALETTE.base,
  link1: MODEL_PALETTE.shoulder,
  link2_1: MODEL_PALETTE.rearArm,
  link2_2: MODEL_PALETTE.rearArm,
  link3_1: MODEL_PALETTE.forearm,
  link3_2: MODEL_PALETTE.forearm,
  link4_1: MODEL_PALETTE.wrist,
  link4_2: MODEL_PALETTE.wrist,
  fake_link: MODEL_PALETTE.parallelLinkage,
  link5: MODEL_PALETTE.flange,
} as const;

type RobotLinkName = keyof typeof ROBOT_LINK_PALETTE;

const colorGroup = (id: string, label: string, linkNames: readonly RobotLinkName[]) => ({
  id,
  label,
  linkNames,
  colors: [...new Set(linkNames.map((linkName) => ROBOT_LINK_PALETTE[linkName]))],
});

export const ROBOT_COLOR_GROUPS = [
  colorGroup("base", "Base", ["base_link"]),
  colorGroup("shoulder", "Shoulder", ["link1"]),
  colorGroup("arms-linkage", "Arms and linkage", ["link2_1", "link2_2", "link3_1", "link3_2", "fake_link"]),
  colorGroup("wrist-flange", "Wrist and flange", ["link4_1", "link4_2", "link5"]),
] as const;
