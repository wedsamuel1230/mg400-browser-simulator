export const PROJECT_FORMAT = "mg400-training-project";
export const PROJECT_SCHEMA_VERSION = 9;
export const BLOCK_SIZE_MM = { x: 40, y: 40, z: 15 } as const;
export const FORK_SUPPORT_HEIGHT_MM = 20;
export type ProgramLanguage = "lua" | "python";
export type ToolMode = "magnet" | "fork";
export type BlockColor = "neutral" | "black" | "white";
export type BlockSource = "pickup" | "feeder" | "output" | "unloaded";

export type CellBlock = {
  id: string;
  color: BlockColor;
  source: BlockSource;
  position: { x: number; y: number };
  r: number;
  /** Deterministic tower layer assigned on release; omitted for source blocks. */
  stackLevel?: number;
};

export type Pose = { x: number; y: number; z: number; r: number };
export type JointAngles = [number, number, number, number]; // radians

export type CartesianPoint = {
  id: string;
  name: string;
  kind: "cartesian";
  pose: Pose;
};

export type JointPoint = {
  id: string;
  name: string;
  kind: "joint";
  joints: JointAngles;
};

export type TeachPoint = CartesianPoint | JointPoint;

export type ProjectDocument = {
  format: typeof PROJECT_FORMAT;
  schemaVersion: typeof PROJECT_SCHEMA_VERSION;
  script: string;
  pythonScript: string;
  programmingLanguage: ProgramLanguage;
  points: TeachPoint[];
  scene: {
    block: { x: number; y: number };
    drop: { x: number; y: number };
    /** Current deterministic multi-block cell state. The legacy block/drop fields remain for v1 missions. */
    blocks: CellBlock[];
    initialBlocks: CellBlock[];
    feederOrder: string[];
  };
  tool: {
    mode: ToolMode;
    flangeOffset: Pose;
    tcpOffsets: Record<ToolMode, Pose>;
    pickupTolerance: { xy: number; z: number };
  };
  simulation: {
    speed: number;
  };
};

export const JOINT_LIMITS_DEG = [
  { min: -160, max: 160 },
  { min: -25, max: 85 },
  { min: -25, max: 105 },
  { min: -360, max: 360 },
] as const;

export const rad = (degrees: number) => (degrees * Math.PI) / 180;
export const deg = (radians: number) => (radians * 180) / Math.PI;

// Both owner-supplied tool meshes mount at the flange plane and extend +X.
// Magnet contacts the block top from above; fork supports the block at its base.
export const DEFAULT_TCP_OFFSETS: Record<ToolMode, Pose> = {
  magnet: { x: 60, y: 0, z: -5, r: 0 },
  fork: { x: 60, y: 0, z: 0, r: 0 },
};
export const activeTcpOffset = (tool: Pick<ProjectDocument["tool"], "mode" | "tcpOffsets">): Pose => tool.tcpOffsets[tool.mode];
export const FLANGE_TO_LINK5_ORIGIN_MM = -85;
export const DEFAULT_FLANGE_OFFSET: Pose = {
  x: 0,
  y: 0,
  z: FLANGE_TO_LINK5_ORIGIN_MM,
  r: 0,
};

export const DEFAULT_SCRIPT = [
  "-- MG400 training simulator · bounded Dobot Lua subset",
  "-- The dark arrow on the block shows its local +X direction.",
  "-- Pick first, lift clear, then rotate the carried tool/block by +90°.",
  "-- DO(1, ON) attaches the block; DO(1, OFF) releases it.",
  "-- CP=0 is explicit because continuous-path blending is not simulated.",
  "",
  "JointMovJ(Home, {CP=0})",
  "MovJ(PickApproach, {CP=0})",
  "MovL(PickPoint, {CP=0})",
  "DO(1, ON)",
  "RelMovL({0, 0, 80, 0}, {CP=0, SpeedL=50, AccL=20}) -- lift in base-frame +Z",
  "-- The block is attached and high enough; turn only the wrist R axis now.",
  "RelMovL({0, 0, 0, 90}, {CP=0, SpeedL=35, AccL=20})",
  "local RotatedPlaceApproach = { coordinate = { x=PlaceApproach.coordinate.x, y=PlaceApproach.coordinate.y, z=PlaceApproach.coordinate.z, r=PlaceApproach.coordinate.r + 90 } }",
  "local RotatedPlacePoint = { coordinate = { x=PlacePoint.coordinate.x, y=PlacePoint.coordinate.y, z=PlacePoint.coordinate.z, r=PlacePoint.coordinate.r + 90 } }",
  "MovJ(RotatedPlaceApproach, {CP=0})",
  "MovL(RotatedPlacePoint, {CP=0})",
  "DO(1, OFF)",
  "Wait(150)",
  "MovL(PlaceApproach, {CP=0})",
  "JointMovJ(Home, {CP=0})",
  "Sync()",
  'print("Picked, rotated +90 degrees, and placed the block")',
  "",
].join("\n");

// The passive fork enters along tool +X beneath the raised block, lifts it,
// and releases it when lowered onto the visible support pads. No DO is used.
export const DEFAULT_FORK_SCRIPT = [
  "-- MG400 training simulator · passive fork pick and place",
  "-- Slide the unpowered fork under the block, lift to pick, and lower onto its stand; no DO is needed.",
  "-- The 40 x 40 x 15 mm block is supported 20 mm above the table, leaving room for the fork.",
  "-- PickApproach is 60 mm before PickPoint along tool -X at the support height.",
  "",
  "JointMovJ(Home, {CP=0})",
  "MovJ(PickApproach, {CP=0})",
  "MovL(PickPoint, {CP=0})",
  "RelMovL({0, 0, 80, 0}, {CP=0, SpeedL=50, AccL=20})",
  "MovJ(PlaceApproach, {CP=0})",
  "MovL(PlacePoint, {CP=0})",
  "MovL(PlaceApproach, {CP=0})",
  "JointMovJ(Home, {CP=0})",
  "Sync()",
  'print("Fork pick and place complete")',
  "",
].join("\n");

export const DEFAULT_PYTHON_SCRIPT = [
  "# MG400 training simulator Python API (not a Dobot controller SDK)",
  "# Offsets use base-frame millimetres and degrees; motion timing is simulated.",
  "# The dark arrow on the block shows its local +X direction.",
  "# Pick first, lift clear, then rotate the carried tool/block by +90 degrees.",
  "",
  "await joint_mov_j(Home, cp=0)",
  "await mov_j(PickApproach, cp=0)",
  "await mov_l(PickPoint, cp=0)",
  "do(1, ON)",
  "await rel_mov_l({\"x\": 0, \"y\": 0, \"z\": 80, \"r\": 0}, cp=0, speed_l=50, acc_l=20)  # lift in base-frame +Z",
  "# The block is attached and high enough; turn only the wrist R axis now.",
  "await rel_mov_l({\"x\": 0, \"y\": 0, \"z\": 0, \"r\": 90}, cp=0, speed_l=35, acc_l=20)",
  "RotatedPlaceApproach = {\"coordinate\": {\"x\": PlaceApproach[\"coordinate\"][\"x\"], \"y\": PlaceApproach[\"coordinate\"][\"y\"], \"z\": PlaceApproach[\"coordinate\"][\"z\"], \"r\": PlaceApproach[\"coordinate\"][\"r\"] + 90}}",
  "RotatedPlacePoint = {\"coordinate\": {\"x\": PlacePoint[\"coordinate\"][\"x\"], \"y\": PlacePoint[\"coordinate\"][\"y\"], \"z\": PlacePoint[\"coordinate\"][\"z\"], \"r\": PlacePoint[\"coordinate\"][\"r\"] + 90}}",
  "await mov_j(RotatedPlaceApproach, cp=0)",
  "await mov_l(RotatedPlacePoint, cp=0)",
  "do(1, OFF)",
  "await sync()",
  "print('Picked, rotated +90 degrees, and placed the block')",
  "",
].join("\n");

export const DEFAULT_FORK_PYTHON_SCRIPT = [
  "# MG400 simulator Python API (not a Dobot controller SDK)",
  "# Passive fork: slide beneath the block, lift to pick, and lower onto its stand; no DO is needed.",
  "# The 40 x 40 x 15 mm block is supported 20 mm above the table, leaving room for the fork.",
  "# PickApproach is 60 mm before PickPoint along tool -X at the support height.",
  "",
  "await joint_mov_j(Home, cp=0)",
  "await mov_j(PickApproach, cp=0)",
  "await mov_l(PickPoint, cp=0)",
  "await rel_mov_l({\"x\": 0, \"y\": 0, \"z\": 80, \"r\": 0}, cp=0, speed_l=50, acc_l=20)",
  "await mov_j(PlaceApproach, cp=0)",
  "await mov_l(PlacePoint, cp=0)",
  "await mov_l(PlaceApproach, cp=0)",
  "await joint_mov_j(Home, cp=0)",
  "await sync()",
  "print('Fork pick and place complete')",
  "",
].join("\n");

export function getStarterProgram(language: ProgramLanguage, mode: ToolMode): string {
  if (mode === "fork") return language === "lua" ? DEFAULT_FORK_SCRIPT : DEFAULT_FORK_PYTHON_SCRIPT;
  return language === "lua" ? DEFAULT_SCRIPT : DEFAULT_PYTHON_SCRIPT;
}
