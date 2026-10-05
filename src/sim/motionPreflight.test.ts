import { describe, expect, it } from "vitest";
import type { JointAngles, Pose } from "../domain";
import type { MG400Kinematics } from "./mg400Kinematics";
import { interpolateCartesianPose, LINEAR_PREFLIGHT_SAMPLES, preflightLinearPath } from "./motionPreflight";

describe("linear motion preflight", () => {
  it("checks all 100 points and returns the final solved joints", () => {
    const samples: Pose[] = [];
    const kinematics = {
      solve: (pose: Pose, seed: JointAngles) => {
        samples.push(pose);
        return { ok: true as const, joints: [seed[0] + 0.01, seed[1], seed[2], seed[3]] as JointAngles, positionErrorMm: 0, angleErrorDeg: 0 };
      },
    } as Pick<MG400Kinematics, "solve">;
    const result = preflightLinearPath(
      { x: 0, y: 0, z: 0, r: 0 },
      { x: 10, y: 0, z: 0, r: 0 },
      [0, 0, 0, 0],
      kinematics,
      { x: 0, y: 0, z: 0, r: 0 },
      { x: 0, y: 0, z: 0, r: 0 },
      0.5,
    );

    expect(samples).toHaveLength(LINEAR_PREFLIGHT_SAMPLES);
    expect(samples.at(-1)).toEqual({ x: 10, y: 0, z: 0, r: 0 });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.finalJoints[0]).toBeCloseTo(1);
  });

  it("reports the first failed sample and error without checking later samples", () => {
    let samples = 0;
    const kinematics = {
      solve: (pose: Pose, seed: JointAngles) => {
        samples += 1;
        return pose.x >= 5
          ? { ok: false as const, joints: seed, positionErrorMm: 12.3, angleErrorDeg: 0 }
          : { ok: true as const, joints: seed, positionErrorMm: 0, angleErrorDeg: 0 };
      },
    } as Pick<MG400Kinematics, "solve">;
    const result = preflightLinearPath(
      { x: 0, y: 0, z: 0, r: 0 },
      { x: 10, y: 0, z: 0, r: 0 },
      [0, 0, 0, 0],
      kinematics,
      { x: 0, y: 0, z: 0, r: 0 },
      { x: 0, y: 0, z: 0, r: 0 },
      0.5,
    );

    expect(result).toEqual({ ok: false, progressPercent: 50, positionErrorMm: 12.3 });
    expect(samples).toBe(50);
  });

  it("interpolates wrist rotation along the shortest angular path", () => {
    expect(interpolateCartesianPose(
      { x: 0, y: 0, z: 0, r: 170 },
      { x: 0, y: 0, z: 0, r: -170 },
      0.5,
    ).r).toBeCloseTo(180);
  });
});
