import { deg, rad, type JointAngles, type Pose } from "../domain";
import type { MG400Kinematics } from "./mg400Kinematics";

export const LINEAR_PREFLIGHT_SAMPLES = 100;

export type LinearPathPreflight =
  | { ok: true; finalJoints: JointAngles }
  | { ok: false; progressPercent: number; positionErrorMm: number };

export function interpolateCartesianPose(from: Pose, to: Pose, progress: number): Pose {
  const angleDelta = Math.atan2(Math.sin(rad(to.r - from.r)), Math.cos(rad(to.r - from.r)));
  return {
    x: from.x + (to.x - from.x) * progress,
    y: from.y + (to.y - from.y) * progress,
    z: from.z + (to.z - from.z) * progress,
    r: from.r + deg(angleDelta) * progress,
  };
}

export function preflightLinearPath(
  from: Pose,
  to: Pose,
  seed: JointAngles,
  kinematics: Pick<MG400Kinematics, "solve">,
  flangeOffset: Pose,
  tcpOffset: Pose,
  toleranceMm: number,
): LinearPathPreflight {
  let lastJoints = seed;
  for (let index = 1; index <= LINEAR_PREFLIGHT_SAMPLES; index += 1) {
    const progress = index / LINEAR_PREFLIGHT_SAMPLES;
    const pose = interpolateCartesianPose(from, to, progress);
    const result = kinematics.solve(pose, lastJoints, flangeOffset, tcpOffset, toleranceMm);
    if (!result.ok) return { ok: false, progressPercent: progress * 100, positionErrorMm: result.positionErrorMm };
    lastJoints = result.joints;
  }
  return { ok: true, finalJoints: lastJoints };
}
