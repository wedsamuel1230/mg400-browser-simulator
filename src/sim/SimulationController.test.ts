import { afterEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_PROJECT } from "../data/defaultProject";
import { makeJointPoint } from "../projectStore";
import { FORK_SUPPORT_HEIGHT_MM, rad, type JointAngles, type Pose, type ProjectDocument } from "../domain";
import { SimulationController, type ControllerEvents, type RunStatus } from "./SimulationController";
import type { MotionRequest } from "./luaTypes";
import type { MG400Kinematics } from "./mg400Kinematics";

afterEach(() => vi.unstubAllGlobals());

function animationFrameMocks() {
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) =>
    window.setTimeout(() => callback(performance.now()), 8),
  );
  vi.stubGlobal("cancelAnimationFrame", (id: number) => window.clearTimeout(id));
}

function makeHarness(options: {
  project?: ProjectDocument;
  initialJoints?: JointAngles;
  forward?: (joints: JointAngles) => Pose;
} = {}) {
  let joints: JointAngles = options.initialJoints ?? [rad(0), rad(30), rad(45), rad(0)];
  let status: RunStatus = "ready";
  let attached = false;
  let blockPosition = { ...(options.project ?? DEFAULT_PROJECT).scene.block };
  const project = structuredClone(options.project ?? DEFAULT_PROJECT);
  let cellBlocks = structuredClone(project.scene.blocks);
  const positions: JointAngles[] = [];
  const fakeKinematics = {
    forward: options.forward ?? ((value: JointAngles) => ({ x: value[0] * 100, y: 0, z: 100, r: 0 })),
    solve: () => ({ ok: false, joints, positionErrorMm: 100, angleErrorDeg: 0 }),
  } as unknown as MG400Kinematics;
  const events: ControllerEvents = {
    getProject: () => structuredClone(project) as ProjectDocument,
    getJoints: () => joints,
    isAttached: () => attached,
    getBlock: () => ({ ...blockPosition }),
    getCellBlocks: () => structuredClone(cellBlocks),
    setCellBlocks: (next) => { cellBlocks = structuredClone(next); },
    setJoints: (next) => { joints = [...next] as JointAngles; positions.push([...next] as JointAngles); },
    setAttached: (next) => { attached = next; },
    setBlock: (next) => { blockPosition = { ...next }; },
    setDigitalOutput: () => undefined,
    setStatus: (next) => { status = next; },
    addLog: () => undefined,
  };
  return {
    controller: new SimulationController(fakeKinematics, events),
    setJoints: (next: JointAngles) => { joints = [...next] as JointAngles; },
    positions,
    status: () => status,
    attached: () => attached,
    block: () => ({ ...blockPosition }),
    cellBlocks: () => structuredClone(cellBlocks),
  };
}

describe("relative Cartesian motion", () => {
  it("resolves X/Y/Z/R offsets from the current TCP when motion starts", () => {
    const harness = makeHarness({
      initialJoints: [10, 20, 30, 40],
      forward: (joints) => ({ x: joints[0], y: joints[1], z: joints[2], r: joints[3] }),
    });
    const resolveRelativeMotion = (harness.controller as unknown as {
      resolveRelativeMotion: (request: MotionRequest) => MotionRequest;
    }).resolveRelativeMotion.bind(harness.controller);
    const request: MotionRequest = {
      commandId: 1,
      command: "RelMovL",
      relativeOffset: { x: 1, y: 2, z: 3, r: 4 },
      speed: 50,
      acceleration: 20,
      sync: false,
    };

    expect(resolveRelativeMotion(request)).toMatchObject({
      command: "MovL",
      targetPose: { x: 11, y: 22, z: 33, r: 44 },
      sync: false,
    });

    harness.setJoints([30, 40, 50, 60]);
    expect(resolveRelativeMotion(request).targetPose).toEqual({ x: 31, y: 42, z: 53, r: 64 });
  });
});

describe("Go To point transitions", () => {
  it("animates through intermediate joint poses and reaches the saved target", async () => {
    animationFrameMocks();
    const harness = makeHarness();
    const target = makeJointPoint("TeachTarget", [rad(65), rad(25), rad(55), rad(10)]);
    const completion = harness.controller.goToPoint(target);
    await vi.waitFor(() => expect(harness.positions.length).toBeGreaterThan(1), { timeout: 1_000 });

    expect(harness.status()).toBe("running");
    expect(harness.positions.length).toBeGreaterThan(1);
    expect(harness.positions[0][0]).toBeGreaterThan(rad(0));
    expect(harness.positions[0][0]).toBeLessThan(target.joints[0]);

    await completion;
    expect(harness.positions.at(-1)).toEqual(target.joints);
    expect(harness.status()).toBe("complete");
  });

  it("pauses and resumes, then stops without snapping to the destination", async () => {
    animationFrameMocks();
    const harness = makeHarness();
    const target = makeJointPoint("FarTarget", [rad(150), rad(70), rad(90), rad(45)]);
    const completion = harness.controller.goToPoint(target);
    await new Promise((resolve) => window.setTimeout(resolve, 35));
    harness.controller.pause();
    expect(harness.status()).toBe("paused");
    const pausedAt = harness.positions.length;
    await new Promise((resolve) => window.setTimeout(resolve, 25));
    expect(harness.positions.length).toBe(pausedAt);

    harness.controller.resume();
    expect(harness.status()).toBe("running");
    await new Promise((resolve) => window.setTimeout(resolve, 35));
    harness.controller.stop(true);
    await completion;
    expect(harness.status()).toBe("stopped");
    expect(harness.positions.at(-1)).not.toEqual(target.joints);
  });

  it("uses fork insertion, lift, and lowering as automatic pick and release actions", async () => {
    animationFrameMocks();
    const project = structuredClone(DEFAULT_PROJECT);
    project.tool.mode = "fork";
    project.scene.block = { x: 0, y: 0 };
    project.scene.drop = { x: 100, y: 0 };
    const harness = makeHarness({
      project,
      initialJoints: [0, 0.8, 0, 0],
      forward: (joints) => ({ x: joints[0] * 100, y: 0, z: joints[1] * 100 + FORK_SUPPORT_HEIGHT_MM, r: 0 }),
    });

    await harness.controller.goToPoint(makeJointPoint("ForkEntry", [-0.6, 0, 0, 0]));
    await harness.controller.goToPoint(makeJointPoint("ForkInsert", [0, 0, 0, 0]));
    expect(harness.attached()).toBe(false);
    await harness.controller.goToPoint(makeJointPoint("ForkLift", [0, 0.8, 0, 0]));
    expect(harness.attached()).toBe(true);
    await harness.controller.goToPoint(makeJointPoint("DropApproach", [1, 0.8, 0, 0]));
    expect(harness.attached()).toBe(true);
    await harness.controller.goToPoint(makeJointPoint("DropContact", [1, 0, 0, 0]));

    expect(harness.attached()).toBe(false);
    expect(harness.block()).toEqual({ x: 100, y: 0 });
  });

  it("picks and places two distinct cell blocks sequentially", () => {
    const project = structuredClone(DEFAULT_PROJECT);
    project.scene.blocks = [
      { id: "first", color: "black", source: "feeder", position: { x: 0, y: 0 }, r: 0 },
      { id: "second", color: "white", source: "feeder", position: { x: 100, y: 0 }, r: 90 },
    ];
    project.scene.initialBlocks = structuredClone(project.scene.blocks);
    project.scene.feederOrder = ["first", "second"];
    project.scene.drop = { x: 100, y: 0 };
    const harness = makeHarness({ project, forward: (joints) => ({ x: joints[0], y: 0, z: 15, r: 0 }) });
    const action = (name: "pick" | "place") => (harness.controller as unknown as { performToolAction: (value: "pick" | "place") => void }).performToolAction(name);

    action("pick");
    expect(harness.attached()).toBe(true);
    harness.setJoints([100, 0, 0, 0]);
    action("place");
    expect(harness.attached()).toBe(false);
    expect(harness.cellBlocks().find((block) => block.id === "first")?.source).toBe("output");

    action("pick");
    expect(harness.attached()).toBe(true);
    harness.setJoints([100, 0, 0, 0]);
    action("place");
    expect(harness.attached()).toBe(false);
    expect(harness.cellBlocks().filter((block) => block.source === "output").map((block) => block.id)).toEqual(["first", "second"]);
    expect(harness.cellBlocks().find((block) => block.id === "second")?.position).toEqual({ x: 100, y: 0 });
    expect(harness.cellBlocks().map((block) => block.stackLevel)).toEqual([0, 1]);
  });

  it("allows deterministic unload of sorted output blocks after feeder exhaustion", () => {
    const project = structuredClone(DEFAULT_PROJECT);
    project.scene.blocks = [{ id: "sorted-black", color: "black", source: "output", position: { x: 250, y: 80 }, r: 0 }];
    project.scene.initialBlocks = structuredClone(project.scene.blocks);
    const harness = makeHarness({ project, forward: (joints) => ({ x: joints[0], y: 80, z: 15, r: 0 }) });
    const action = (name: "pick" | "place") => (harness.controller as unknown as { performToolAction: (value: "pick" | "place") => void }).performToolAction(name);
    harness.setJoints([250, 0, 0, 0]);
    action("pick");
    harness.setJoints([400, 0, 0, 0]);
    action("place");
    expect(harness.cellBlocks()[0].source).toBe("unloaded");
  });
});
