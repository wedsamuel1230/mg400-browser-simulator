import { platformHeight, magneticSurfaceHeight, activeTcpOffset, cellBlockTopZ, effectiveForkContactProfile, BODY1_FORK_CONTACT, body1ForkProgram, FORK_SUPPORT_HEIGHT_MM, rad, type ForkContactProfile, type ProgramLanguage, type ProjectDocument, type TeachPoint, type ToolMode } from "../domain";
import type { MG400Kinematics } from "./mg400Kinematics";
import { FORK_INSERTION_DISTANCE_MM, forkEntryPose } from "./forkTool";

export type RecommendationAction = "teach-home" | "teach-pick" | "teach-place" | "select-point";

export type RecommendationCheck = {
  id: string;
  status: "pass" | "action" | "waiting" | "info";
  title: string;
  detail: string;
  action?: RecommendationAction;
  pointName?: string;
};

export type ProgramRecommendation = {
  ready: boolean;
  message: string;
  checks: RecommendationCheck[];
  code: string;
};

const DEFAULT_SEED = [rad(0), rad(30), rad(45), rad(0)] as const;
const APPROACH_HEIGHT_MM = 80;
const CARRY_ROTATION_DEG = 90;
const POINT_TOLERANCE_MM = 0.5;

export function recommendPickAndPlace(
  project: ProjectDocument,
  language: ProgramLanguage,
  kinematics?: Pick<MG400Kinematics, "solve">,
  modelError = "",
  profile: ForkContactProfile = "reference",
): ProgramRecommendation {
  profile = effectiveForkContactProfile(profile, project.scene.blocks, project.scene.blocks.find((block) => Math.hypot(block.position.x - project.scene.block.x, block.position.y - project.scene.block.y) <= 1)?.id);
  const byName = new Map(project.points.map((point) => [point.name, point]));
  const home = byName.get("Home");
  const homeReady = home?.kind === "joint";
  const toolLabel = project.tool.mode === "magnet" ? "Magnet" : "Fork";
  const contactZ = project.tool.mode === "magnet" ? cellBlockTopZ(project.scene.blocks.find((block) => Math.hypot(block.position.x - project.scene.block.x, block.position.y - project.scene.block.y) <= 1), "magnet", magneticSurfaceHeight(project.scene), platformHeight(project.scene)) : platformHeight(project.scene) + (profile === "body1" ? BODY1_FORK_CONTACT.insertionZ : FORK_SUPPORT_HEIGHT_MM);
  const pickTarget = project.scene.block;
  const placeTarget = project.scene.drop;

  const checks: RecommendationCheck[] = [
    homeReady
      ? { id: "home", status: "pass", title: "Starting position", detail: "A joint point named Home is saved for the start and end of the example." }
      : {
          id: "home",
          status: "action",
          title: "Starting position",
          detail: "Save the current robot pose as a joint point named Home. The example uses this name to start and finish predictably.",
          action: "teach-home",
        },
    checkPair(project, byName, "pick", pickTarget, contactZ, profile),
    checkPair(project, byName, "place", placeTarget, profile === "body1" && project.tool.mode === "fork" ? platformHeight(project.scene) + BODY1_FORK_CONTACT.loadZ : contactZ, profile),
    checkReachability(project, byName, home, kinematics, modelError),
    language === "lua"
      ? {
          id: "api-profile",
          status: "info",
          title: "Lua compatibility note",
          detail: "RelMovL syntax and options are confirmed in the official DobotStudio Pro 2.8.0 MG400 guide (p. 172). This simulator uses base-frame offsets, CP=0 only, and simulated timing; it has no hardware command path.",
        }
      : {
          id: "api-profile",
          status: "info",
          title: "Python compatibility note",
          detail: "This code uses the simulator's local Python API. It is not a Dobot controller SDK and cannot run on the physical arm.",
        },
  ];

  const blocking = checks.find((check) => check.status === "action" || check.status === "waiting");
  return {
    ready: blocking === undefined,
    message: blocking
      ? blocking.detail
      : `The saved ${toolLabel.toLowerCase()} points pass the simulator's setup checks. Review each motion step before running the example.`,
    checks,
    code: recommendedProgram(language, project.tool.mode, profile, platformHeight(project.scene)),
  };
}

function checkPair(
  project: ProjectDocument,
  points: Map<string, TeachPoint>,
  kind: "pick" | "place",
  target: { x: number; y: number },
  contactZ: number,
  profile: ForkContactProfile,
): RecommendationCheck {
  const isPick = kind === "pick";
  const contactName = isPick ? "PickPoint" : "PlacePoint";
  const approachName = isPick ? "PickApproach" : "PlaceApproach";
  const action: RecommendationAction = isPick ? "teach-pick" : "teach-place";
  const contact = points.get(contactName);
  const approach = points.get(approachName);
  const mode = project.tool.mode === "magnet" ? "Magnet" : "Fork";
  const targetLabel = isPick ? "reference block" : "drop zone";
  const expectedZ = contactZ;
  const forkEntry = project.tool.mode === "fork" && isPick;

  if (contact?.kind !== "cartesian" || approach?.kind !== "cartesian") {
    return {
      id: kind,
      status: "action",
      title: isPick ? "Pick points" : "Place points",
      detail: forkEntry
        ? `Create the passive fork entry pair at the ${targetLabel}: ${contactName} at Z=${expectedZ} mm and ${approachName} 60 mm before it along tool -X at the support height.`
        : `Create the ${mode.toLowerCase()} ${kind} pair at the ${targetLabel}: ${contactName} at Z=${expectedZ} mm and ${approachName} 80 mm above it.`,
      action,
    };
  }

  const targetError = Math.hypot(contact.pose.x - target.x, contact.pose.y - target.y);
  const contactZError = Math.abs(contact.pose.z - expectedZ);
  const expectedApproach = forkEntry ? forkEntryPose(contact.pose) : {
    ...contact.pose,
    z: contact.pose.z + APPROACH_HEIGHT_MM,
  };
  const approachPositionError = Math.hypot(approach.pose.x - expectedApproach.x, approach.pose.y - expectedApproach.y);
  const approachHeightError = Math.abs(approach.pose.z - expectedApproach.z);
  const approachRotationError = Math.abs(approach.pose.r - contact.pose.r);
  const contactHeightTolerance = profile === "body1" && project.tool.mode === "fork" || forkEntry ? POINT_TOLERANCE_MM : project.tool.pickupTolerance.z;
  const blockR = project.scene.blocks.find((block) => Math.hypot(block.position.x - project.scene.block.x, block.position.y - project.scene.block.y) <= 1)?.r ?? 0;
  const yawError = Math.abs((((contact.pose.r - blockR + 90) % 180) + 270) % 180 - 90);
  const grooveAligned = profile !== "body1" || project.tool.mode !== "fork" || yawError <= 1;
  const valid = grooveAligned && targetError <= project.tool.pickupTolerance.xy &&
    contactZError <= contactHeightTolerance &&
    approachPositionError <= POINT_TOLERANCE_MM &&
    approachHeightError <= POINT_TOLERANCE_MM &&
    approachRotationError <= POINT_TOLERANCE_MM;

  if (valid) {
    return {
      id: kind,
      status: "pass",
      title: isPick ? "Pick points" : "Place points",
      detail: forkEntry
        ? `${contactName} targets the ${targetLabel}; ${approachName} starts 60 mm before it so the fork can slide underneath at Z=${expectedZ} mm.`
        : `${contactName} targets the ${targetLabel}; ${approachName} is directly above it by 80 mm.`,
    };
  }

  const reasons: string[] = [];
  if (!grooveAligned) reasons.push("Body1 叉臂方向須配合工件槽方向（方塊 R−90°）");
  if (targetError > project.tool.pickupTolerance.xy) {
    reasons.push(`${contactName} is ${targetError.toFixed(1)} mm from the ${targetLabel} centre (allowed ${project.tool.pickupTolerance.xy} mm)`);
  }
  if (contactZError > contactHeightTolerance) {
    reasons.push(`${contactName} is at Z=${contact.pose.z.toFixed(1)} mm; ${mode} contact is Z=${expectedZ} mm`);
  }
  if (approachPositionError > POINT_TOLERANCE_MM || approachHeightError > POINT_TOLERANCE_MM || approachRotationError > POINT_TOLERANCE_MM) {
    reasons.push(forkEntry
      ? `${approachName} must be 60 mm before ${contactName} along tool -X, at the same support height and rotation`
      : `${approachName} must share X/Y/R with ${contactName} and be 80 mm above it`);
  }
  return {
    id: kind,
    status: "action",
    title: isPick ? "Pick points" : "Place points",
    detail: `${reasons.join("; ")}. Re-teach this pair from the reference cell to match the active ${mode.toLowerCase()} setup.`,
    action,
  };
}

function checkReachability(
  project: ProjectDocument,
  points: Map<string, TeachPoint>,
  home: TeachPoint | undefined,
  kinematics: Pick<MG400Kinematics, "solve"> | undefined,
  modelError: string,
): RecommendationCheck {
  if (!kinematics) {
    return {
      id: "reachability",
      status: modelError ? "action" : "waiting",
      title: "Workspace check",
      detail: modelError
        ? `The MG400 model could not be checked: ${modelError}`
        : "Waiting for the MG400 kinematic model before checking the saved targets.",
    };
  }

  const seed = home?.kind === "joint" ? home.joints : [...DEFAULT_SEED] as [number, number, number, number];
  const candidates: { name: string; pointName: string; pose: { x: number; y: number; z: number; r: number } }[] = [];
  for (const name of ["PickApproach", "PickPoint", "PlaceApproach", "PlacePoint"]) {
    const point = points.get(name);
    if (point?.kind === "cartesian") candidates.push({ name, pointName: name, pose: point.pose });
  }
  if (project.tool.mode === "magnet") {
    const pickPoint = points.get("PickPoint");
    if (pickPoint?.kind === "cartesian") {
      candidates.push({
        name: "RotateAbovePick (+90°)",
        pointName: "PickPoint",
        pose: { ...pickPoint.pose, z: pickPoint.pose.z + APPROACH_HEIGHT_MM, r: pickPoint.pose.r + CARRY_ROTATION_DEG },
      });
    }
    for (const name of ["PlaceApproach", "PlacePoint"]) {
      const point = points.get(name);
      if (point?.kind === "cartesian") {
        candidates.push({
          name: `${name} (+90°)`,
          pointName: name,
          pose: { ...point.pose, r: point.pose.r + CARRY_ROTATION_DEG },
        });
      }
    }
  }
  const unreachable = candidates.flatMap(({ name, pointName, pose }) => {
    const result = kinematics.solve(pose, seed, project.tool.flangeOffset, activeTcpOffset(project.tool));
    return result.ok ? [] : [{ name, pointName, error: result.positionErrorMm }];
  });

  if (unreachable.length === 0) {
    return {
      id: "reachability",
      status: "pass",
      title: "Workspace check",
      detail: "All taught targets and the requested rotation endpoints can be solved inside the loaded URDF joint limits. This checks endpoints, not collisions or the full travel path.",
    };
  }

  const first = unreachable[0];
  return {
    id: "reachability",
    status: "action",
    title: "Workspace check",
    detail: `${unreachable.map(({ name }) => name).join(", ")} ${unreachable.length === 1 ? "is" : "are"} outside the modeled joint-limited workspace (first endpoint error ${first.error.toFixed(1)} mm). Select a point and adjust it or move the cell target.`,
    action: "select-point",
    pointName: first.pointName,
  };
}

export function recommendedProgram(language: ProgramLanguage, mode: ToolMode, profile: ForkContactProfile = "reference", platformHeightMm = 110): string {
  if (mode === "fork" && profile === "body1") return body1ForkProgram(language, platformHeightMm);
  const tool = mode === "magnet" ? "Magnet" : "Fork";
  const contact = mode === "magnet" ? "top face (use the saved contact height)" : `fork support plane (Z=${platformHeightMm + FORK_SUPPORT_HEIGHT_MM} mm)`;
  if (mode === "fork") {
    if (language === "python") {
      return [
        "# MG400 simulator Python API; not a Dobot controller SDK.",
        "# Passive fork: slide beneath the 40 x 40 x 15 mm block, then lift to pick it up.",
        `# PickApproach begins ${FORK_INSERTION_DISTANCE_MM} mm before PickPoint along tool -X at the ${platformHeightMm + FORK_SUPPORT_HEIGHT_MM} mm support height. No DO is needed.`,
        "",
        "# 1. Move to the fork entry point, then slide beneath the block.",
        "await joint_mov_j(Home, cp=0)",
        "await mov_j(PickApproach, cp=0)",
        "await mov_l(PickPoint, cp=0)",
        "# 2. Lifting after insertion attaches the block automatically.",
        "await rel_mov_l({\"x\": 0, \"y\": 0, \"z\": 80, \"r\": 0}, cp=0, speed_l=50, acc_l=20)",
        "# 3. Lower the supported block onto the drop zone to release it.",
        "await mov_j(PlaceApproach, cp=0)",
        "await mov_l(PlacePoint, cp=0)",
        "await mov_l(PlaceApproach, cp=0)",
        "await joint_mov_j(Home, cp=0)",
        "await sync()",
        "print('Fork pick and place complete')",
        "",
      ].join("\n");
    }
    return [
      "-- MG400 training simulator template; bounded Lua subset.",
      "-- Passive fork: slide beneath the 40 x 40 x 15 mm block, then lift to pick it up.",
      `-- PickApproach begins ${FORK_INSERTION_DISTANCE_MM} mm before PickPoint along tool -X at the ${platformHeightMm + FORK_SUPPORT_HEIGHT_MM} mm support height. No DO is needed.`,
      "",
      "-- 1. Move to the fork entry point, then slide beneath the block.",
      "JointMovJ(Home, {CP=0})",
      "MovJ(PickApproach, {CP=0})",
      "MovL(PickPoint, {CP=0})",
      "-- 2. Lifting after insertion attaches the block automatically.",
      "RelMovL({0, 0, 80, 0}, {CP=0, SpeedL=50, AccL=20})",
      "-- 3. Lower the supported block onto the drop zone to release it.",
      "MovJ(PlaceApproach, {CP=0})",
      "MovL(PlacePoint, {CP=0})",
      "MovL(PlaceApproach, {CP=0})",
      "JointMovJ(Home, {CP=0})",
      "Sync()",
      'print("Fork pick and place complete")',
      "",
    ].join("\n");
  }
  if (language === "python") {
    return [
      "# MG400 simulator Python API; not a Dobot controller SDK.",
      `# Active tool: ${tool}. Its taught contact points must match this mode.`,
      "# Simulation only: DO(1) attaches/releases the reference block; it does not model tool physics.",
      "",
      "# 1. Start from the saved joint pose.",
      "await joint_mov_j(Home, cp=0)",
        "# 2. Move above the block, then move straight down to the taught contact point.",
        "await mov_j(PickApproach, cp=0)",
        "await mov_l(PickPoint, cp=0)",
        "# 3. Attach first, then lift clear before turning the wrist.",
        "do(1, ON)",
        "await rel_mov_l({\"x\": 0, \"y\": 0, \"z\": 80, \"r\": 0}, cp=0, speed_l=50, acc_l=20)  # lift in base-frame +Z",
        "# 4. The block is still attached: rotate the tool wrist +90 degrees at safe height.",
        "await rel_mov_l({\"x\": 0, \"y\": 0, \"z\": 0, \"r\": 90}, cp=0, speed_l=35, acc_l=20)",
        "# 5. Keep the +90 degree orientation in copies of the taught place points.",
        "RotatedPlaceApproach = {\"coordinate\": {\"x\": PlaceApproach[\"coordinate\"][\"x\"], \"y\": PlaceApproach[\"coordinate\"][\"y\"], \"z\": PlaceApproach[\"coordinate\"][\"z\"], \"r\": PlaceApproach[\"coordinate\"][\"r\"] + 90}}",
        "RotatedPlacePoint = {\"coordinate\": {\"x\": PlacePoint[\"coordinate\"][\"x\"], \"y\": PlacePoint[\"coordinate\"][\"y\"], \"z\": PlacePoint[\"coordinate\"][\"z\"], \"r\": PlacePoint[\"coordinate\"][\"r\"] + 90}}",
        "# 6. Travel with the rotated block, lower, and release it.",
        "await mov_j(RotatedPlaceApproach, cp=0)",
        "await mov_l(RotatedPlacePoint, cp=0)",
        "do(1, OFF)",
        "# 7. Retract and return to a known pose.",
        "await mov_l(RotatedPlaceApproach, cp=0)",
      "await joint_mov_j(Home, cp=0)",
      "await sync()",
        "print('Picked, rotated +90 degrees, and placed the block')",
      "",
    ].join("\n");
  }
  return [
    "-- MG400 training simulator template; bounded Lua subset.",
    `-- Active tool: ${tool}. Teach its ${contact} points before running.`,
    "-- Simulation only: DO(1) attaches/releases the reference block; no tool physics is simulated.",
    "",
    "-- 1. Start from the saved joint pose.",
    "JointMovJ(Home, {CP=0})",
    "-- 2. Move above the block, then move straight down to the taught contact point.",
    "MovJ(PickApproach, {CP=0})",
    "MovL(PickPoint, {CP=0})",
    "-- 3. Attach first, then lift clear before turning the wrist.",
    "DO(1, ON)",
    "RelMovL({0, 0, 80, 0}, {CP=0, SpeedL=50, AccL=20}) -- lift in base-frame +Z",
    "-- 4. The block is still attached: rotate the tool wrist +90 degrees at safe height.",
    "RelMovL({0, 0, 0, 90}, {CP=0, SpeedL=35, AccL=20})",
    "-- 5. Keep the +90 degree orientation in copies of the taught place points.",
    "local RotatedPlaceApproach = { coordinate = { x=PlaceApproach.coordinate.x, y=PlaceApproach.coordinate.y, z=PlaceApproach.coordinate.z, r=PlaceApproach.coordinate.r + 90 } }",
    "local RotatedPlacePoint = { coordinate = { x=PlacePoint.coordinate.x, y=PlacePoint.coordinate.y, z=PlacePoint.coordinate.z, r=PlacePoint.coordinate.r + 90 } }",
    "-- 6. Travel with the rotated block, lower, and release it.",
    "MovJ(RotatedPlaceApproach, {CP=0})",
    "MovL(RotatedPlacePoint, {CP=0})",
    "DO(1, OFF)",
    "-- 7. Retract and return to a known pose.",
    "MovL(RotatedPlaceApproach, {CP=0})",
    "JointMovJ(Home, {CP=0})",
    "Sync()",
    'print("Picked, rotated +90 degrees, and placed the block")',
    "",
  ].join("\n");
}
