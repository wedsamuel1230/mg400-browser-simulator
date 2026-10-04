import {
  FORK_SUPPORT_HEIGHT_MM,
  DEFAULT_TCP_OFFSETS,
  DEFAULT_SCRIPT,
  DEFAULT_FORK_SCRIPT,
  DEFAULT_PYTHON_SCRIPT,
  DEFAULT_FORK_PYTHON_SCRIPT,
  DEFAULT_FLANGE_OFFSET,
  PROJECT_FORMAT,
  PROJECT_SCHEMA_VERSION,
  MAGNET_SUPPORT_HEIGHT_MM,
  JOINT_LIMITS_DEG,
  deg,
  type JointPoint,
  type CellBlock,
  type Pose,
  type ProjectDocument,
  type ProgramLanguage,
  type ToolMode,
  type TeachPoint,
} from "./domain";
import { DEFAULT_PROJECT } from "./data/defaultProject";
import { cloneCellBlocks, DEFAULT_CELL_BLOCKS, DEFAULT_FEEDER_ORDER, validateCellBlocks } from "./sim/multiBlockCell";

export const STORAGE_KEY = "mg400-training-project-v1";
const MAX_SCRIPT_LENGTH = 200_000;
const MAX_POINTS = 100;
const LEGACY_V7_MAGNET_LUA = [
  "-- MG400 training simulator · bounded Dobot Lua subset",
  "-- DO(1, ON) attaches the block; DO(1, OFF) releases it.",
  "-- CP=0 is explicit because continuous-path blending is not simulated.",
  "",
  "JointMovJ(Home, {CP=0})",
  "MovJ(PickApproach, {CP=0})",
  "MovL(PickPoint, {CP=0})",
  "DO(1, ON)",
  "RelMovL({0, 0, 80, 0}, {CP=0, SpeedL=50, AccL=20})",
  "MovJ(PlaceApproach, {CP=0})",
  "MovL(PlacePoint, {CP=0})",
  "DO(1, OFF)",
  "Wait(150)",
  "MovL(PlaceApproach, {CP=0})",
  "JointMovJ(Home, {CP=0})",
  "Sync()",
  'print("Pick and place complete")',
  "",
].join("\n");
// Exact historical source is a migration fingerprint; do not display or edit it.
const LEGACY_V7_MAGNET_PYTHON = [
  "# MG400 training simulator Python API (not a Dobot controller SDK)",
  "# Offsets use base-frame millimetres and degrees; motion timing is simulated.",
  "",
  "await joint_mov_j(Home, cp=0)",
  "await mov_j(PickApproach, cp=0)",
  "await mov_l(PickPoint, cp=0)",
  "do(1, ON)",
  'await rel_mov_l({"x": 0, "y": 0, "z": 80, "r": 0}, cp=0, speed_l=50, acc_l=20)',
  "await mov_j(PlaceApproach, cp=0)",
  "await mov_l(PlacePoint, cp=0)",
  "do(1, OFF)",
  "await sync()",
  "print('Pick and place complete')",
  "",
].join("\n");
const LUA_RESERVED = new Set([
  "and", "break", "do", "else", "elseif", "end", "false", "for", "function", "goto", "if", "in", "local",
  "nil", "not", "or", "repeat", "return", "then", "true", "until", "while", "MovJ", "MovL", "RelMovL",
  "JointMovJ", "Wait", "Sleep", "Sync", "DO", "Pick", "Place", "GetPose", "GetAngle", "SpeedJ",
  "SpeedL", "AccJ", "AccL", "ON", "OFF", "assert", "dofile", "error", "getmetatable", "ipairs",
  "load", "loadfile", "next", "pairs", "pcall", "print", "rawequal", "rawget", "rawlen", "rawset",
  "select", "setmetatable", "tonumber", "tostring", "type", "xpcall", "coroutine", "string", "table",
  "math", "utf8", "io", "os", "package", "debug", "_G", "_VERSION",
]);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

const isPose = (value: unknown): value is Pose =>
  isRecord(value) &&
  ["x", "y", "z", "r"].every((key) => isFiniteNumber(value[key]));

function validatePoint(value: unknown): value is TeachPoint {
  if (!isRecord(value) || typeof value.id !== "string" || typeof value.name !== "string") {
    return false;
  }
  if (value.id.length < 1 || value.id.length > 80 || value.name.length > 40) return false;
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(value.name) || LUA_RESERVED.has(value.name)) return false;
  if (value.kind === "cartesian") return isPose(value.pose) && Object.values(value.pose).every((n) => Math.abs(n as number) <= 1000);
  if (value.kind === "joint") {
    return (
      Array.isArray(value.joints) &&
      value.joints.length === 4 &&
      value.joints.every(isFiniteNumber) &&
      value.joints.every((joint, index) => deg(joint) >= JOINT_LIMITS_DEG[index].min && deg(joint) <= JOINT_LIMITS_DEG[index].max)
    );
  }
  return false;
}

export function validateProject(input: unknown): ProjectDocument {
  if (!isRecord(input)) throw new Error("Project file must be a JSON object.");
  let value: Record<string, unknown> = input;
  if (value.format !== PROJECT_FORMAT) throw new Error("This is not an MG400 training project.");
  if (value.schemaVersion === 1) value = migrateV1Project(value);
  if (value.schemaVersion === 2 || value.schemaVersion === 3) value = migrateSingleTcpOffset(value);
  if (value.schemaVersion === 4) value = migrateV4Project(value);
  if (value.schemaVersion === 5) value = migrateV5Project(value);
  if (value.schemaVersion === 6) value = migrateV6Project(value);
  if (value.schemaVersion === 7) value = migrateV7Project(value);
  if (value.schemaVersion === 8) value = migrateV8Project(value);
  if (value.schemaVersion === 9 && isRecord(value.scene)) {
    const scene = value.scene;
    const preserveKinds = (blocks: unknown) => Array.isArray(blocks) ? blocks.map((block) => isRecord(block) && block.kind === undefined ? { ...block, kind: "block" } : block) : blocks;
    value = { ...value, schemaVersion: 10, scene: { ...scene, blocks: preserveKinds(scene.blocks), initialBlocks: preserveKinds(scene.initialBlocks) } };
  }
  if (value.schemaVersion === 10 && isRecord(value.scene)) {
    const scene = value.scene;
    const removeRoundPieces = (blocks: unknown) => Array.isArray(blocks) ? blocks.map((block) => isRecord(block) && block.kind === "puck" ? { ...block, kind: "magnet" } : block) : blocks;
    const points = Array.isArray(value.points) ? value.points : [];
    const stockNames = new Map(points.filter(isRecord).map((point) => [point.name, point]));
    const stockZ = (name: string, expected: number) => { const point = stockNames.get(name); return isRecord(point) && isPose(point.pose) && point.pose.z === expected && point.pose.x === 300 && point.pose.y === (name.startsWith("Pick") ? -80 : 80) && point.pose.r === 0; };
    const stockBlocks = (blocks: unknown) => Array.isArray(blocks) && JSON.stringify(blocks) === JSON.stringify(DEFAULT_CELL_BLOCKS);
    const stockMagnet = stockBlocks(scene.blocks) && stockBlocks(scene.initialBlocks) && isRecord(scene.block) && scene.block.x === 300 && scene.block.y === -80 && isRecord(scene.drop) && scene.drop.x === 300 && scene.drop.y === 80 && isRecord(value.tool) && value.tool.mode === "magnet" && value.script === DEFAULT_SCRIPT && value.pythonScript === DEFAULT_PYTHON_SCRIPT
      && stockZ("PickPoint", 24) && stockZ("PlacePoint", 24) && stockZ("PickApproach", 104) && stockZ("PlaceApproach", 104);
    value = { ...value, schemaVersion: 11,
      points: stockMagnet ? points.map((point) => isRecord(point) && isPose(point.pose) && ["PickPoint", "PlacePoint", "PickApproach", "PlaceApproach"].includes(String(point.name)) ? { ...point, pose: { ...point.pose, z: point.pose.z + MAGNET_SUPPORT_HEIGHT_MM - 20 } } : point) : points,
      scene: { ...scene, platformHeightMm: stockMagnet ? 110 : 0, magnetStandHeightMm: stockMagnet ? 0 : scene.magnetStandHeightMm ?? 20, blocks: removeRoundPieces(scene.blocks), initialBlocks: removeRoundPieces(scene.initialBlocks) } };
  }
  if (value.schemaVersion !== PROJECT_SCHEMA_VERSION) {
    throw new Error("Unsupported project schema version: " + String(value.schemaVersion) + ".");
  }
  if (typeof value.script !== "string" || value.script.length > MAX_SCRIPT_LENGTH) {
    throw new Error("Script is missing or exceeds the 200,000 character limit.");
  }
  if (
    typeof value.pythonScript !== "string" || value.pythonScript.length > MAX_SCRIPT_LENGTH ||
    (value.programmingLanguage !== "lua" && value.programmingLanguage !== "python")
  ) {
    throw new Error("Python program or selected programming language is malformed.");
  }
  if (!Array.isArray(value.points) || value.points.length > MAX_POINTS) {
    throw new Error("Project exceeds the 100 point limit.");
  }
  const invalidPoint = value.points.findIndex((point) => !validatePoint(point));
  if (invalidPoint >= 0) {
    const point = value.points[invalidPoint];
    const pointName = isRecord(point) && typeof point.name === "string" ? ` '${point.name}'` : "";
    const pointKind = isRecord(point) && point.kind === "joint" ? " joint" : " Cartesian";
    throw new Error(`Project${pointKind} point${pointName} at index ${invalidPoint} is malformed or outside the allowed ranges.`);
  }
  const names = value.points.map((point) => point.name.trim().toLowerCase());
  const ids = value.points.map((point) => point.id);
  if (names.some((name) => !name) || new Set(names).size !== names.length || new Set(ids).size !== ids.length) {
    throw new Error("Point names must be non-empty and unique.");
  }
  if (
    !isRecord(value.scene) ||
    !isRecord(value.scene.block) ||
    !isRecord(value.scene.drop) ||
    !isFiniteNumber(value.scene.block.x) ||
    !isFiniteNumber(value.scene.block.y) ||
    !isFiniteNumber(value.scene.drop.x) ||
    !isFiniteNumber(value.scene.drop.y) ||
    [value.scene.block.x, value.scene.block.y, value.scene.drop.x, value.scene.drop.y].some((n) => Math.abs(n as number) > 500)
  ) {
    throw new Error("Scene block or drop-zone coordinates are malformed.");
  }
  if (!Array.isArray(value.scene.blocks) || !Array.isArray(value.scene.initialBlocks) || !Array.isArray(value.scene.feederOrder)) {
    throw new Error("Multi-block cell state is malformed.");
  }
  if (value.scene.body1SupportHeightMm !== undefined && (!isFiniteNumber(value.scene.body1SupportHeightMm) || value.scene.body1SupportHeightMm < 0 || value.scene.body1SupportHeightMm > 100)) throw new Error("Body1 support datum must be between 0 and 100 mm.");
  if (value.scene.platformHeightMm !== undefined && (!isFiniteNumber(value.scene.platformHeightMm) || value.scene.platformHeightMm < 0 || value.scene.platformHeightMm > 200)) throw new Error("Teaching platform height must be between 0 and 200 mm.");
  if (value.scene.magnetStandHeightMm !== undefined && (!isFiniteNumber(value.scene.magnetStandHeightMm) || value.scene.magnetStandHeightMm < 0 || value.scene.magnetStandHeightMm > 200)) throw new Error("Magnetic teaching stand height must be between 0 and 200 mm.");
  try {
    validateCellBlocks(value.scene.blocks as CellBlock[], value.scene.feederOrder as string[]);
    validateCellBlocks(value.scene.initialBlocks as CellBlock[], value.scene.feederOrder as string[]);
  } catch (error) {
    throw new Error(error instanceof Error ? error.message : "Multi-block cell state is malformed.");
  }
  if (
    !isRecord(value.tool) ||
    (value.tool.mode !== "magnet" && value.tool.mode !== "fork") ||
    !isPose(value.tool.flangeOffset) ||
    !isRecord(value.tool.tcpOffsets) ||
    !isPose(value.tool.tcpOffsets.magnet) ||
    !isPose(value.tool.tcpOffsets.fork) ||
    !isRecord(value.tool.pickupTolerance) ||
    !isFiniteNumber(value.tool.pickupTolerance.xy) ||
    !isFiniteNumber(value.tool.pickupTolerance.z) ||
    value.tool.pickupTolerance.xy < 0 ||
    value.tool.pickupTolerance.z < 0 ||
    value.tool.pickupTolerance.xy > 100 ||
    value.tool.pickupTolerance.z > 100 ||
    [...Object.values(value.tool.flangeOffset), ...Object.values(value.tool.tcpOffsets.magnet), ...Object.values(value.tool.tcpOffsets.fork)].some((n) => Math.abs(n as number) > 500)
  ) {
    throw new Error("Tool TCP or pickup tolerance settings are malformed.");
  }
  if (!isRecord(value.simulation) || !isFiniteNumber(value.simulation.speed) || value.simulation.speed < 10 || value.simulation.speed > 200) {
    throw new Error("Simulation settings are malformed.");
  }

  const project = structuredClone(value) as ProjectDocument;
  if ((project.scene.platformHeightMm ?? 0) !== 110) {
    project.scene.platformMigrationFromMm = project.scene.platformHeightMm ?? 0;
    project.scene.platformHeightMm = 110;
    project.scene.magnetStandHeightMm = 0;
  }
  return project;
}

function migrateV8Project(value: Record<string, unknown>): Record<string, unknown> {
  const scene = isRecord(value.scene) ? value.scene : {};
  const block = isRecord(scene.block) && isFiniteNumber(scene.block.x) && isFiniteNumber(scene.block.y)
    ? { x: scene.block.x, y: scene.block.y }
    : { x: 300, y: -80 };
  const blocks = cloneCellBlocks(DEFAULT_CELL_BLOCKS);
  blocks[0].position = { ...block };
  return {
    ...value,
    schemaVersion: 9,
    scene: {
      ...scene,
      blocks,
      initialBlocks: cloneCellBlocks(blocks),
      feederOrder: [...DEFAULT_FEEDER_ORDER],
    },
  };
}

function migrateV1Project(value: Record<string, unknown>): Record<string, unknown> {
  if (!isRecord(value.tool)) return value;
  const tool = { ...value.tool };
  if (tool.mode === undefined) tool.mode = "magnet" satisfies ToolMode;
  if (isPose(tool.tcpOffset) && tool.tcpOffset.x === 0 && tool.tcpOffset.y === 0 && tool.tcpOffset.z === -35 && tool.tcpOffset.r === 0) {
    tool.tcpOffset = { x: 60, y: 0, z: -35, r: 0 };
  }
  return {
    ...value,
    schemaVersion: 2,
    pythonScript: DEFAULT_PYTHON_SCRIPT,
    programmingLanguage: "lua" satisfies ProgramLanguage,
    tool,
  };
}

function migrateSingleTcpOffset(value: Record<string, unknown>): Record<string, unknown> {
  if (!isRecord(value.tool)) return value;
  const tool = { ...value.tool };
  const mode = tool.mode === "fork" ? "fork" : "magnet";
  const legacyOffset = isPose(tool.tcpOffset) ? tool.tcpOffset : { x: 60, y: 0, z: -35, r: 0 };
  // v2 used an inferred shared Z=-35 mm. The short-lived v3 build changed it
  // to zero but still had one shared point. Recognize both defaults while
  // preserving any user-tuned offset on the selected tool.
  const wasInferredDefault = legacyOffset.x === 60 && legacyOffset.y === 0 &&
    (legacyOffset.z === -35 || (value.schemaVersion === 3 && legacyOffset.z === 0)) && legacyOffset.r === 0;
  const tcpOffsets = {
    magnet: { ...DEFAULT_TCP_OFFSETS.magnet },
    fork: { ...DEFAULT_TCP_OFFSETS.fork },
  };
  if (!wasInferredDefault) tcpOffsets[mode] = { ...legacyOffset };
  delete tool.tcpOffset;
  return { ...value, schemaVersion: 4, tool: { ...tool, tcpOffsets } };
}

function migrateV4Project(value: Record<string, unknown>): Record<string, unknown> {
  const tool = isRecord(value.tool) ? value.tool : {};
  if (tool.mode !== "fork") return { ...value, schemaVersion: 5 };
  return {
    ...value,
    schemaVersion: 5,
    script: value.script === DEFAULT_SCRIPT || value.script === LEGACY_V7_MAGNET_LUA ? DEFAULT_FORK_SCRIPT : value.script,
    pythonScript: value.pythonScript === DEFAULT_PYTHON_SCRIPT || value.pythonScript === LEGACY_V7_MAGNET_PYTHON ? DEFAULT_FORK_PYTHON_SCRIPT : value.pythonScript,
  };
}

function migrateV5Project(value: Record<string, unknown>): Record<string, unknown> {
  const tool = isRecord(value.tool) ? value.tool : {};
  const isFork = tool.mode === "fork";
  const scene = isRecord(value.scene) ? value.scene : {};
  const block = isRecord(scene.block) ? scene.block : {};
  const drop = isRecord(scene.drop) ? scene.drop : {};
  const points = Array.isArray(value.points) ? value.points : [];
  const byName = new Map(points.filter(isRecord).map((point) => [point.name, point]));
  const pointMatches = (name: string, expected: Pose) => {
    const point = byName.get(name);
    if (!isRecord(point) || point.kind !== "cartesian" || !isPose(point.pose)) return false;
    const pose = point.pose as Pose;
    return pose.x === expected.x && pose.y === expected.y && pose.z === expected.z && pose.r === expected.r;
  };
  const oldZ = isFork ? 0 : 15;
  const pairMatches =
    pointMatches("PickPoint", { x: 300, y: -80, z: oldZ, r: 0 }) &&
    pointMatches("PickApproach", { x: isFork ? 240 : 300, y: -80, z: isFork ? 0 : 95, r: 0 }) &&
    pointMatches("PlacePoint", { x: 300, y: 80, z: oldZ, r: 0 }) &&
    pointMatches("PlaceApproach", { x: 300, y: 80, z: isFork ? 80 : 95, r: 0 });
  const isUntouchedReferenceCell =
    block.x === 300 && block.y === -80 && drop.x === 300 && drop.y === 80 && pairMatches;

  const migratedPoints = isUntouchedReferenceCell
    ? points.map((point) => {
        if (!isRecord(point) || point.kind !== "cartesian" || !isPose(point.pose)) return point;
        const pose = { ...point.pose };
        if (point.name === "PickPoint") Object.assign(pose, { x: 300, z: isFork ? FORK_SUPPORT_HEIGHT_MM : 15 });
        if (point.name === "PickApproach") Object.assign(pose, { x: 300 - (isFork ? 60 : 0), z: isFork ? FORK_SUPPORT_HEIGHT_MM : 95 });
        if (point.name === "PlacePoint") Object.assign(pose, { x: 300, z: isFork ? FORK_SUPPORT_HEIGHT_MM : 15 });
        if (point.name === "PlaceApproach") Object.assign(pose, { x: 300, z: isFork ? FORK_SUPPORT_HEIGHT_MM + 80 : 95 });
        return { ...point, pose };
      })
    : points;

  let script = value.script;
  let pythonScript = value.pythonScript;
  if (isFork && typeof script === "string") {
    script = script.replace("-- PickApproach is 60 mm before PickPoint along tool -X at table height.", "-- The block sits 20 mm above the table on three fork-access support pads.")
      .replace("-- Slide the fork under the block, lift to pick, and lower to release; no DO is needed.", "-- Slide the unpowered fork beneath the block, lift to pick, and lower onto its stand; no DO is needed.");
  }
  if (isFork && typeof pythonScript === "string") {
    pythonScript = pythonScript.replace("# PickApproach is 60 mm before PickPoint along tool -X at table height.", "# The block sits 20 mm above the table on three fork-access support pads.")
      .replace("# Passive fork: slide beneath the block, lift to pick, and lower to release; no DO is needed.", "# Passive fork: slide beneath the block, lift to pick, and lower onto its stand; no DO is needed.");
  }

  return {
    ...value,
    schemaVersion: 7,
    scene: isUntouchedReferenceCell
      ? { ...scene, block: { x: 300, y: -80 }, drop: { x: 300, y: 80 } }
      : scene,
    points: migratedPoints,
    script,
    pythonScript,
  };
}

function migrateV6Project(value: Record<string, unknown>): Record<string, unknown> {
  const tool = isRecord(value.tool) ? value.tool : {};
  const isFork = tool.mode === "fork";
  const scene = isRecord(value.scene) ? value.scene : {};
  const block = isRecord(scene.block) ? scene.block : {};
  const drop = isRecord(scene.drop) ? scene.drop : {};
  const points = Array.isArray(value.points) ? value.points : [];
  const byName = new Map(points.filter(isRecord).map((point) => [point.name, point]));
  const sceneX = block.x;
  const pointMatches = (name: string, expected: Pose) => {
    const point = byName.get(name);
    if (!isRecord(point) || point.kind !== "cartesian" || !isPose(point.pose)) return false;
    const pose = point.pose as Pose;
    return pose.x === expected.x && pose.y === expected.y && pose.z === expected.z && pose.r === expected.r;
  };
  const isUntouchedReferenceCell =
    (sceneX === 300 || sceneX === 360) &&
    block.y === -80 && drop.x === sceneX && drop.y === 80 &&
    pointMatches("PickPoint", { x: sceneX, y: -80, z: 15, r: 0 }) &&
    pointMatches("PickApproach", { x: sceneX, y: -80, z: 95, r: 0 }) &&
    pointMatches("PlacePoint", { x: sceneX, y: 80, z: 15, r: 0 }) &&
    pointMatches("PlaceApproach", { x: sceneX, y: 80, z: 95, r: 0 });

  const migratedPoints = isUntouchedReferenceCell
    ? points.map((point) => {
        if (!isRecord(point) || point.kind !== "cartesian" || !isPose(point.pose)) return point;
        const pose = { ...point.pose };
        if (point.name === "PickPoint") Object.assign(pose, { x: 300, z: isFork ? FORK_SUPPORT_HEIGHT_MM : 15 });
        if (point.name === "PickApproach") Object.assign(pose, { x: isFork ? 240 : 300, z: isFork ? FORK_SUPPORT_HEIGHT_MM : 95 });
        if (point.name === "PlacePoint") Object.assign(pose, { x: 300, z: isFork ? FORK_SUPPORT_HEIGHT_MM : 15 });
        if (point.name === "PlaceApproach") Object.assign(pose, { x: 300, z: isFork ? FORK_SUPPORT_HEIGHT_MM + 80 : 95 });
        return { ...point, pose };
      })
    : points;

  const script = isFork && isUntouchedReferenceCell && (value.script === DEFAULT_SCRIPT || value.script === LEGACY_V7_MAGNET_LUA)
    ? DEFAULT_FORK_SCRIPT
    : value.script;
  const pythonScript = isFork && isUntouchedReferenceCell && (value.pythonScript === DEFAULT_PYTHON_SCRIPT || value.pythonScript === LEGACY_V7_MAGNET_PYTHON)
    ? DEFAULT_FORK_PYTHON_SCRIPT
    : value.pythonScript;

  return {
    ...value,
    schemaVersion: 7,
    scene: isUntouchedReferenceCell
      ? { ...scene, block: { x: 300, y: -80 }, drop: { x: 300, y: 80 } }
      : scene,
    points: migratedPoints,
    script,
    pythonScript,
  };
}

function migrateV7Project(value: Record<string, unknown>): Record<string, unknown> {
  const tool = isRecord(value.tool) ? value.tool : {};
  const isFork = tool.mode === "fork";
  const scene = isRecord(value.scene) ? value.scene : {};
  const block = isRecord(scene.block) ? scene.block : {};
  const drop = isRecord(scene.drop) ? scene.drop : {};
  const points = Array.isArray(value.points) ? value.points : [];
  const byName = new Map(points.filter(isRecord).map((point) => [point.name, point]));
  const pointMatches = (name: string, expected: Pose) => {
    const point = byName.get(name);
    if (!isRecord(point) || point.kind !== "cartesian" || !isPose(point.pose)) return false;
    const pose = point.pose as Pose;
    return pose.x === expected.x && pose.y === expected.y && pose.z === expected.z && pose.r === expected.r;
  };
  const supportZ = isFork ? FORK_SUPPORT_HEIGHT_MM : 15;
  const approachZ = isFork ? FORK_SUPPORT_HEIGHT_MM + 80 : 95;
  const isUntouchedReferenceCell =
    block.x === 360 && block.y === -80 && drop.x === 360 && drop.y === 80 &&
    pointMatches("PickPoint", { x: 360, y: -80, z: supportZ, r: 0 }) &&
    pointMatches("PickApproach", { x: isFork ? 300 : 360, y: -80, z: isFork ? FORK_SUPPORT_HEIGHT_MM : 95, r: 0 }) &&
    pointMatches("PlacePoint", { x: 360, y: 80, z: supportZ, r: 0 }) &&
    pointMatches("PlaceApproach", { x: 360, y: 80, z: approachZ, r: 0 });

  if (!isUntouchedReferenceCell) return { ...value, schemaVersion: 8 };

  const migratedPoints = points.map((point) => {
    if (!isRecord(point) || point.kind !== "cartesian" || !isPose(point.pose)) return point;
    if (point.name !== "PlacePoint" && point.name !== "PlaceApproach") return point;
    return { ...point, pose: { ...point.pose, x: 300 } };
  });
  return {
    ...value,
    schemaVersion: 8,
    scene: { ...scene, drop: { x: 300, y: 80 } },
    points: migratedPoints,
    script: !isFork && value.script === LEGACY_V7_MAGNET_LUA ? DEFAULT_SCRIPT : value.script,
    pythonScript: !isFork && value.pythonScript === LEGACY_V7_MAGNET_PYTHON ? DEFAULT_PYTHON_SCRIPT : value.pythonScript,
  };
}

export function loadProject(): ProjectDocument {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return structuredClone(DEFAULT_PROJECT);
    return validateProject(JSON.parse(stored));
  } catch {
    return structuredClone(DEFAULT_PROJECT);
  }
}

export function saveProject(project: ProjectDocument): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(validateProject(project)));
}

export function exportProject(project: ProjectDocument): string {
  const safe = validateProject(project);
  return JSON.stringify(safe, null, 2) + "\n";
}

export function parseProjectFile(text: string): ProjectDocument {
  if (text.length > MAX_SCRIPT_LENGTH * 2) throw new Error("Project file is too large.");
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("Project file is not valid JSON.");
  }
  return validateProject(parsed);
}

export function makeCartesianPoint(name: string, pose: Pose, id: string = crypto.randomUUID()) {
  return { id, name, kind: "cartesian" as const, pose: { ...pose } };
}

export function makeJointPoint(
  name: string,
  joints: JointPoint["joints"],
  id = crypto.randomUUID(),
) {
  return { id, name, kind: "joint" as const, joints: [...joints] as JointPoint["joints"] };
}

export function resetProject(): ProjectDocument {
  const fresh = structuredClone(DEFAULT_PROJECT);
  fresh.tool.flangeOffset = { ...DEFAULT_FLANGE_OFFSET };
  fresh.tool.tcpOffsets = {
    magnet: { ...DEFAULT_TCP_OFFSETS.magnet },
    fork: { ...DEFAULT_TCP_OFFSETS.fork },
  };
  return fresh;
}

/** Only used to explain a historical import conversion, never to accept invalid data. */
export function containsRemovedRoundWorkpieces(value: unknown): boolean {
  if (!isRecord(value) || !isRecord(value.scene)) return false;
  return [value.scene.blocks, value.scene.initialBlocks].some((blocks) => Array.isArray(blocks) && blocks.some((block) => isRecord(block) && block.kind === "puck"));
}
