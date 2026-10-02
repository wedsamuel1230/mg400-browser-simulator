import { describe, expect, it } from "vitest";
import { FORK_SUPPORT_HEIGHT_MM } from "../domain";
import { DEFAULT_PROJECT } from "../data/defaultProject";
import type { MG400Kinematics } from "./mg400Kinematics";
import { recommendPickAndPlace } from "./codeRecommendation";
import { forkContactPose, forkEntryPose } from "./forkTool";

const reachableKinematics = {
  solve: () => ({ ok: true, joints: [0, 0, 0, 0], positionErrorMm: 0, angleErrorDeg: 0 }),
} as unknown as Pick<MG400Kinematics, "solve">;

describe("context-aware pick-and-place recommendations", () => {
  it("explains a ready magnet template and the controller-version evidence boundary", () => {
    const result = recommendPickAndPlace(structuredClone(DEFAULT_PROJECT), "lua", reachableKinematics);
    expect(result.ready).toBe(true);
    expect(result.checks.filter((check) => check.status === "action")).toEqual([]);
    expect(result.code).toContain("RelMovL({0, 0, 80, 0}, {CP=0, SpeedL=50, AccL=20})");
    expect(result.code.indexOf("DO(1, ON)")).toBeLessThan(result.code.indexOf("RelMovL({0, 0, 0, 90}"));
    expect(result.code.indexOf("RelMovL({0, 0, 0, 90}")).toBeLessThan(result.code.indexOf("MovJ(RotatedPlaceApproach"));
    expect(result.code).toContain("PlaceApproach.coordinate.r + 90");
    expect(result.code).toContain("PlacePoint.coordinate.r + 90");
    expect(result.code).toContain("MovL(PickPoint");
    expect(result.code).toContain("base-frame +Z");
    expect(result.checks.find((check) => check.id === "api-profile")?.detail).toContain("Pro 2.8.0");
  });

  it("requests a fork-specific pair and produces a simulator-only Python example", () => {
    const project = structuredClone(DEFAULT_PROJECT);
    project.tool.mode = "fork";
    const result = recommendPickAndPlace(project, "python", reachableKinematics);
    expect(result.ready).toBe(false);
    expect(result.checks.find((check) => check.id === "pick")?.action).toBe("teach-pick");
    expect(result.message).toContain(`Fork contact is Z=${FORK_SUPPORT_HEIGHT_MM} mm`);
    expect(result.code).toContain("await rel_mov_l");
    expect(result.code).toContain("not a Dobot controller SDK");
    expect(result.code).toContain("No DO is needed");
    expect(result.code).not.toContain("RotatedPlacePoint");
    expect(result.code).not.toMatch(/\bdo\s*\(/i);
    expect(result.code).toContain("slide beneath");
    expect(result.checks.find((check) => check.id === "api-profile")?.detail).toContain("cannot run on the physical arm");
  });

  it("keeps the magnet block attached through the safe-height wrist turn in the Python recommendation", () => {
    const result = recommendPickAndPlace(structuredClone(DEFAULT_PROJECT), "python", reachableKinematics);
    expect(result.code.indexOf("do(1, ON)")).toBeLessThan(result.code.indexOf("\"r\": 90"));
    expect(result.code.indexOf("\"z\": 80")).toBeLessThan(result.code.indexOf("\"r\": 90"));
    expect(result.code).toContain("PlacePoint[\"coordinate\"][\"r\"] + 90");
    expect(result.code.indexOf("RotatedPlacePoint, cp=0")).toBeLessThan(result.code.indexOf("do(1, OFF)"));
  });

  it("blocks a recommendation when one of the +90 degree carried/place poses is unreachable", () => {
    const result = recommendPickAndPlace(structuredClone(DEFAULT_PROJECT), "lua", {
      solve: (pose: { r: number }) => pose.r >= 90
        ? { ok: false, joints: [0, 0, 0, 0], positionErrorMm: 0, angleErrorDeg: 91 }
        : { ok: true, joints: [0, 0, 0, 0], positionErrorMm: 0, angleErrorDeg: 0 },
    } as unknown as Pick<MG400Kinematics, "solve">);
    expect(result.ready).toBe(false);
    expect(result.checks.find((check) => check.id === "reachability")?.pointName).toBe("PickPoint");
    expect(result.checks.find((check) => check.id === "reachability")?.detail).toContain("RotateAbovePick (+90°)");
  });

  it("accepts correctly taught fork pairs and validates point alignment", () => {
    const project = structuredClone(DEFAULT_PROJECT);
    project.tool.mode = "fork";
    for (const point of project.points) {
      if (point.kind !== "cartesian") continue;
      if (point.name === "PickPoint") {
        point.pose.z = FORK_SUPPORT_HEIGHT_MM;
        const entry = forkEntryPose(point.pose);
        const approach = project.points.find((candidate) => candidate.name === "PickApproach");
        if (!approach || approach.kind !== "cartesian") throw new Error("Missing fork entry point fixture.");
        approach.pose = entry;
      }
      if (point.name === "PlacePoint") point.pose.z = FORK_SUPPORT_HEIGHT_MM;
      if (point.name === "PlaceApproach") point.pose.z = FORK_SUPPORT_HEIGHT_MM + 80;
    }
    expect(recommendPickAndPlace(project, "lua", reachableKinematics).ready).toBe(true);
    const forkLua = recommendPickAndPlace(project, "lua", reachableKinematics).code;
    expect(forkLua).not.toMatch(/\bDO\s*\(/);
    expect(forkLua).toContain("lift to pick it up");
    expect(forkLua.toLowerCase()).toContain("lower the supported block");

    project.scene.block.x += 40;
    const misaligned = recommendPickAndPlace(project, "lua", reachableKinematics);
    expect(misaligned.ready).toBe(false);
    expect(misaligned.checks.find((check) => check.id === "pick")?.detail).toContain("reference block centre");
  });

  it("points to the first unreachable target rather than offering the program", () => {
    const project = structuredClone(DEFAULT_PROJECT);
    const kinematics = {
      solve: (pose: { y: number }) => pose.y >= 0
        ? { ok: true, joints: [0, 0, 0, 0], positionErrorMm: 0, angleErrorDeg: 0 }
        : { ok: false, joints: [0, 0, 0, 0], positionErrorMm: 29.2, angleErrorDeg: 0 },
    } as unknown as Pick<MG400Kinematics, "solve">;
    const result = recommendPickAndPlace(project, "lua", kinematics);
    const reachability = result.checks.find((check) => check.id === "reachability");
    expect(result.ready).toBe(false);
    expect(reachability?.action).toBe("select-point");
    expect(reachability?.pointName).toBe("PickApproach");
    expect(reachability?.detail).toContain("29.2 mm");
  });

  it("waits for model reachability evidence and provides a recovery when Home is missing", () => {
    const project = structuredClone(DEFAULT_PROJECT);
    project.points = project.points.filter((point) => point.name !== "Home");
    const pending = recommendPickAndPlace(project, "python");
    expect(pending.ready).toBe(false);
    expect(pending.checks.find((check) => check.id === "home")?.action).toBe("teach-home");
    expect(pending.checks.find((check) => check.id === "reachability")?.status).toBe("waiting");

    const failed = recommendPickAndPlace(project, "python", undefined, "URDF unavailable");
    expect(failed.checks.find((check) => check.id === "reachability")?.detail).toContain("URDF unavailable");
  });
});


it("requires calibrated Body1 heights and groove yaw before offering the no-output path", () => {
  const project=structuredClone(DEFAULT_PROJECT);project.tool.mode="fork";
  for(const point of project.points)if(point.kind==="cartesian"){
    const placing=point.name.startsWith("Place");
    const contact=forkContactPose(placing?project.scene.drop:project.scene.block,0,"body1",placing);
    point.pose=point.name.endsWith("Approach")?(placing?{...contact,z:contact.z+80}:forkEntryPose(contact)):contact;
  }
  const result=recommendPickAndPlace(project,"lua",reachableKinematics,"","body1");
  expect(result.ready).toBe(true);expect(result.code).toContain("MovL(PlaceClear");expect(result.code).not.toMatch(/\b(?:DO|Pick|Place)\s*\(/);
  const pick=project.points.find(p=>p.name==="PickPoint")!;if(pick.kind!=="cartesian")throw Error("fixture");pick.pose.r=0;
  expect(recommendPickAndPlace(project,"lua",reachableKinematics,"","body1").ready).toBe(false);
  pick.pose.r=-90;pick.pose.z=20;
  expect(recommendPickAndPlace(project,"lua",reachableKinematics,"","body1").ready).toBe(false);
});

it("uses generic contact for other cells while first workpiece has Body1 calibration",()=>{
 const project=structuredClone(DEFAULT_PROJECT);project.tool.mode="fork";
 project.scene.block={x:360,y:80};project.scene.blocks.push({id:"other",source:"pickup",color:"neutral",position:{x:360,y:80},r:0});
 project.points=project.points.filter(p=>p.name==="Home");
 const result=recommendPickAndPlace(project,"lua",undefined,"","body1");
 expect(result.checks.find(c=>c.id==="pick")?.detail).toContain("Z=20 mm");
 expect(result.code).not.toContain("PlaceClear");
});
