import { activeTcpOffset, deg, FORK_SUPPORT_HEIGHT_MM, rad, type CellBlock, type JointAngles, type Pose, type ProjectDocument, type TeachPoint } from "../domain";
import type { LuaRuntimeCallbacks } from "./luaRuntime";
import { LuaRuntime } from "./luaRuntime";
import { PythonRuntime } from "./pythonRuntime";
import type { MG400Kinematics } from "./mg400Kinematics";
import type { LuaWorkerMessage, MotionRequest } from "./luaTypes";
import { advancePassiveFork, EMPTY_PASSIVE_FORK_STATE, type PassiveForkState } from "./forkTool";

type Action =
  | { type: "motion"; motion: MotionRequest }
  | { type: "io"; index: number; value: boolean }
  | { type: "tool"; action: "pick" | "place" };

export type RunStatus = "ready" | "running" | "paused" | "complete" | "stopped" | "error";

export type ControllerEvents = {
  getProject: () => ProjectDocument;
  getJoints: () => JointAngles;
  isAttached: () => boolean;
  getBlock: () => { x: number; y: number };
  getCellBlocks?: () => CellBlock[];
  setCellBlocks?: (blocks: CellBlock[]) => void;
  setJoints: (joints: JointAngles) => void;
  setAttached: (attached: boolean) => void;
  setAttachedCellBlockId?: (id: string | null) => void;
  setBlock: (position: { x: number; y: number }) => void;
  setDigitalOutput: (index: number, value: boolean) => void;
  setStatus: (status: RunStatus) => void;
  addLog: (message: string, level: "info" | "warning" | "error") => void;
};

export class SimulationController {
  private readonly luaRuntime = new LuaRuntime();
  private readonly pythonRuntime = new PythonRuntime();
  private activeRuntime?: LuaRuntime | PythonRuntime;
  private readonly queue: Action[] = [];
  private processing = false;
  private paused = false;
  private stopped = true;
  private scriptEnded = false;
  private executionProject?: ProjectDocument;
  private passiveForkState: PassiveForkState = { ...EMPTY_PASSIVE_FORK_STATE };
  private attachedCellBlockId: string | null = null;
  private generation = 0;
  private readonly pendingFrames = new Map<number, (timestamp: number) => void>();
  private idleWaiters: (() => void)[] = [];
  private resumeWaiters: (() => void)[] = [];
  private readonly options: LuaRuntimeCallbacks;

  constructor(
    private readonly kinematics: MG400Kinematics,
    private readonly events: ControllerEvents,
  ) {
    this.options = {
      onMessage: (message) => this.handleMessage(message),
      onError: (message) => this.fail(message),
    };
  }

  run(script: string, points: TeachPoint[], language: "lua" | "python" = "lua") {
    this.stop(false);
    this.executionProject = structuredClone(this.events.getProject());
    this.stopped = false;
    this.scriptEnded = false;
    this.events.setStatus("running");
    this.activeRuntime = language === "python" ? this.pythonRuntime : this.luaRuntime;
    this.events.addLog(`${language === "python" ? "Python" : "Lua"} program started in the isolated browser worker.`, "info");
    this.activeRuntime.run(script, points, this.options);
  }

  async goToPoint(point: TeachPoint): Promise<void> {
    const forkState = this.passiveForkState;
    this.stop(false);
    this.passiveForkState = forkState;
    const generation = this.generation;
    this.executionProject = structuredClone(this.events.getProject());
    this.stopped = false;
    this.scriptEnded = false;
    this.events.setStatus("running");
    this.events.addLog(`Moving smoothly to ${point.name}…`, "info");

    const motion: MotionRequest = point.kind === "joint"
      ? {
          commandId: -1,
          command: "JointMovJ",
          targetJoints: [...point.joints],
          speed: 100,
          acceleration: 100,
          sync: true,
        }
      : {
          commandId: -1,
          command: "MovJ",
          targetPose: { ...point.pose },
          speed: 100,
          acceleration: 100,
          sync: true,
        };

    try {
      await this.animateMotion(motion, generation);
      if (generation !== this.generation || this.stopped) return;
      this.stopped = true;
      this.executionProject = undefined;
      this.events.setStatus("complete");
      this.events.addLog(`Reached ${point.name}.`, "info");
    } catch (error) {
      if (generation === this.generation && !this.stopped) {
        this.fail(error instanceof Error ? error.message : String(error));
      }
    }
  }

  pause() {
    if (this.stopped || this.paused) return;
    this.paused = true;
    this.events.setStatus("paused");
  }

  resume() {
    if (this.stopped || !this.paused) return;
    this.paused = false;
    this.events.setStatus("running");
    for (const resolve of this.resumeWaiters.splice(0)) resolve();
  }

  stop(report = true) {
    this.generation += 1;
    for (const [frameId, resolve] of this.pendingFrames) {
      cancelAnimationFrame(frameId);
      resolve(performance.now());
    }
    this.pendingFrames.clear();
    this.activeRuntime?.stop();
    this.activeRuntime = undefined;
    this.stopped = true;
    this.paused = false;
    this.scriptEnded = false;
    this.executionProject = undefined;
    this.passiveForkState = { ...EMPTY_PASSIVE_FORK_STATE };
    this.attachedCellBlockId = null;
    this.events.setAttachedCellBlockId?.(null);
    this.queue.length = 0;
    this.processing = false;
    for (const resolve of this.resumeWaiters.splice(0)) resolve();
    this.notifyIdle();
    if (report) {
      this.events.setStatus("stopped");
      this.events.addLog("Simulation stopped. The robot holds its current pose.", "warning");
    }
  }

  private handleMessage(message: LuaWorkerMessage) {
    if (this.stopped) return;
    switch (message.type) {
      case "motion":
      case "io":
      case "tool":
        this.queue.push(message as Action);
        void this.processQueue();
        break;
      case "clock":
        void this.handleClock(message.requestId, message.mode, message.milliseconds);
        break;
      case "state":
        this.replyState(message.requestId, message.state);
        break;
      case "print":
        this.events.addLog(message.message, message.level);
        break;
      case "script-complete":
        this.scriptEnded = true;
        if (!this.processing && this.queue.length === 0) this.finish();
        break;
      case "script-error":
        this.fail(message.message);
        break;
      case "rpc-response":
      case "motion-complete":
      case "motion-failed":
        break;
    }
  }

  private replyState(requestId: number, state: "pose" | "angles") {
    const project = this.currentProject();
    const joints = this.events.getJoints();
    const value = state === "pose"
      ? this.kinematics.forward(joints, project.tool.flangeOffset, activeTcpOffset(project.tool))
      : { j1: joints[0], j2: joints[1], j3: joints[2], j4: joints[3] };
    this.activeRuntime?.reply(requestId, value);
  }

  private async handleClock(requestId: number, mode: "sleep" | "wait" | "sync", milliseconds: number) {
    const generation = this.generation;
    try {
      if (mode === "sync" || mode === "wait") await this.waitForIdle();
      if (mode === "sleep" || mode === "wait") await this.delay(milliseconds, generation);
      if (generation === this.generation && !this.stopped) this.activeRuntime?.reply(requestId, true);
    } catch (error) {
      this.fail(error instanceof Error ? error.message : String(error));
    }
  }

  private async processQueue() {
    if (this.processing || this.stopped) return;
    this.processing = true;
    const generation = this.generation;
    try {
      while (this.queue.length && !this.stopped && generation === this.generation) {
        await this.waitUntilResumed(generation);
        const action = this.queue.shift()!;
        if (action.type === "motion") {
          await this.animateMotion(this.resolveRelativeMotion(action.motion), generation);
          if (generation !== this.generation || this.stopped) return;
          this.activeRuntime?.motionComplete(action.motion.commandId);
        } else if (action.type === "io") {
          this.events.setDigitalOutput(action.index, action.value);
          if (action.index === 1 && this.currentProject().tool.mode === "magnet") {
            this.performToolAction(action.value ? "pick" : "place");
          } else if (action.index === 1) {
            this.events.addLog("DO1 is only a virtual output in Fork mode. Slide beneath the block and lift to pick it up; lower it onto the table to release it.", "info");
          }
        } else {
          this.performToolAction(action.action);
        }
      }
    } catch (error) {
      if (generation === this.generation && !this.stopped) {
        this.fail(error instanceof Error ? error.message : String(error));
      }
    } finally {
      if (generation === this.generation) {
        this.processing = false;
        this.notifyIdle();
        if (this.scriptEnded && this.queue.length === 0 && !this.stopped) this.finish();
      }
    }
  }

  private resolveRelativeMotion(request: MotionRequest): MotionRequest {
    if (request.command !== "RelMovL") return request;
    const offset = request.relativeOffset;
    if (!offset) throw new Error("RelMovL is missing its X/Y/Z/R Cartesian offset.");
    const project = this.currentProject();
    const currentPose = this.kinematics.forward(this.events.getJoints(), project.tool.flangeOffset, activeTcpOffset(project.tool));
    return {
      ...request,
      command: "MovL",
      targetPose: {
        x: currentPose.x + offset.x,
        y: currentPose.y + offset.y,
        z: currentPose.z + offset.z,
        r: currentPose.r + offset.r,
      },
      relativeOffset: undefined,
    };
  }

  private async animateMotion(request: MotionRequest, generation: number) {
    const project = this.currentProject();
    const current = this.events.getJoints();
    const currentPose = this.kinematics.forward(current, project.tool.flangeOffset, activeTcpOffset(project.tool));
    let destination: JointAngles;
    let targetPose: Pose;

    if (request.command === "JointMovJ") {
      if (!request.targetJoints || request.targetJoints.length !== 4) throw new Error("JointMovJ requires four joint angles.");
      destination = [...request.targetJoints] as JointAngles;
      this.assertJointLimits(destination);
      targetPose = this.kinematics.forward(destination, project.tool.flangeOffset, activeTcpOffset(project.tool));
    } else {
      if (!request.targetPose) throw new Error(`${request.command} requires a Cartesian point.`);
      targetPose = request.targetPose;
      const solved = this.kinematics.solve(targetPose, current, project.tool.flangeOffset, activeTcpOffset(project.tool));
      if (!solved.ok) {
        throw new Error(`Target is outside the modeled workspace (remaining error ${solved.positionErrorMm.toFixed(1)} mm, ${solved.angleErrorDeg.toFixed(1)}°).`);
      }
      destination = solved.joints;
    }

    const distance = request.command === "MovL"
      ? Math.hypot(targetPose.x - currentPose.x, targetPose.y - currentPose.y, targetPose.z - currentPose.z)
      : Math.max(...destination.map((angle, index) => Math.abs(deg(angle - current[index]))));
    const nominalRate = request.command === "MovL" ? 230 : 165;
    const ratio = Math.max(0.05, request.speed / 100);
    const accelerationScale = 0.75 + 0.25 * Math.sqrt(100 / Math.max(1, request.acceleration));
    const duration = Math.max(250, Math.min(12000, (distance / (nominalRate * ratio)) * 1000 * accelerationScale * (100 / project.simulation.speed)));
    const start = performance.now();
    let elapsed = 0;
    let lastFrame = start;
    let lastJoints = current;
    let lastTcpPose = currentPose;

    while (elapsed < duration && generation === this.generation && !this.stopped) {
      await this.waitUntilResumed(generation);
      const frameTime = await this.nextFrame(generation);
      if (this.stopped || generation !== this.generation) return;
      if (this.paused) {
        await this.waitUntilResumed(generation);
        lastFrame = performance.now();
        continue;
      }
      elapsed += Math.max(0, frameTime - lastFrame);
      lastFrame = frameTime;
      const t = Math.min(1, elapsed / duration);
      const eased = t * t * (3 - 2 * t);

      if (request.command === "MovL") {
        const pose = interpolatePose(currentPose, targetPose, eased);
        const result = this.kinematics.solve(pose, lastJoints, project.tool.flangeOffset, activeTcpOffset(project.tool));
        if (!result.ok) {
          throw new Error(`Straight-line motion left the modeled workspace (${result.positionErrorMm.toFixed(1)} mm position error).`);
        }
        lastJoints = result.joints;
      } else {
        lastJoints = destination.map((angle, index) => current[index] + (angle - current[index]) * eased) as JointAngles;
      }
      this.events.setJoints(lastJoints);
      const tcpPose = this.kinematics.forward(lastJoints, project.tool.flangeOffset, activeTcpOffset(project.tool));
      this.updatePassiveFork(lastTcpPose, tcpPose);
      lastTcpPose = tcpPose;
    }
    if (generation === this.generation && !this.stopped) {
      this.events.setJoints(destination);
      const destinationPose = this.kinematics.forward(destination, project.tool.flangeOffset, activeTcpOffset(project.tool));
      this.updatePassiveFork(lastTcpPose, destinationPose);
    }
  }

  private updatePassiveFork(previous: Pose, current: Pose) {
    const project = this.currentProject();
    if (project.tool.mode !== "fork") {
      this.passiveForkState = { ...EMPTY_PASSIVE_FORK_STATE };
      return;
    }
    const result = advancePassiveFork(
      this.passiveForkState,
      previous,
      current,
      this.events.isAttached(),
      this.events.getBlock(),
      project.scene.drop,
      project.tool.pickupTolerance,
    );
    this.passiveForkState = result.state;
    if (result.action === "pick") {
      this.events.setAttached(true);
      this.events.addLog("Fork slid beneath the 40 × 40 × 15 mm block; lifting attached it to the passive tool.", "info");
    } else if (result.action === "place") {
      this.events.setAttached(false);
      this.events.setBlock({ x: current.x, y: current.y });
      this.events.addLog(`Fork lowered the block onto the support pads at X ${current.x.toFixed(1)} mm, Y ${current.y.toFixed(1)} mm.`, "info");
    }
  }

  private assertJointLimits(joints: JointAngles) {
    const ranges = [[-160, 160], [-25, 85], [-25, 105], [-360, 360]];
    for (let i = 0; i < 4; i += 1) {
      const value = deg(joints[i]);
      if (!Number.isFinite(value) || value < ranges[i][0] - 1e-6 || value > ranges[i][1] + 1e-6) {
        throw new Error(`Joint J${i + 1} target ${value.toFixed(1)}° exceeds the documented MG400 range.`);
      }
    }
  }

  private performToolAction(action: "pick" | "place") {
    const project = this.currentProject();
    if (project.tool.mode === "fork") {
      throw new Error(`The fork is passive. Move it to its Z=${FORK_SUPPORT_HEIGHT_MM} mm support plane, slide beneath the block, then lift; lower it onto the support pads to release it. Remove DO1 and Pick()/Place() actions from the fork program.`);
    }
    const attached = this.events.isAttached();
    if (action === "pick") {
      if (attached) throw new Error("The block is already attached to the tool.");
      const tcp = this.kinematics.forward(this.events.getJoints(), project.tool.flangeOffset, activeTcpOffset(project.tool));
      const candidates = this.events.getCellBlocks?.() ?? [];
      const block = candidates.length > 0
        ? (candidates.find((candidate) => candidate.source !== "output" && candidate.source !== "unloaded" && Math.hypot(tcp.x - candidate.position.x, tcp.y - candidate.position.y) <= project.tool.pickupTolerance.xy)
          ?? candidates.find((candidate) => candidate.source === "output" && Math.hypot(tcp.x - candidate.position.x, tcp.y - candidate.position.y) <= project.tool.pickupTolerance.xy))?.position
        : this.events.getBlock();
      if (!block) throw new Error("Pick failed: no eligible source block is within the configured pickup tolerance.");
      const xyError = Math.hypot(tcp.x - block.x, tcp.y - block.y);
      const pickupZ = 15;
      const zError = Math.abs(tcp.z - pickupZ);
      if (xyError > project.tool.pickupTolerance.xy || zError > project.tool.pickupTolerance.z) {
        throw new Error(`Pick failed: TCP is ${xyError.toFixed(1)} mm from the block centre and ${zError.toFixed(1)} mm from the magnet target at the top-face centre (Z=15 mm).`);
      }
      this.events.setAttached(true);
      this.attachedCellBlockId = candidates.find((candidate) => candidate.position === block)?.id ?? null;
      this.events.setAttachedCellBlockId?.(this.attachedCellBlockId);
      this.events.addLog(`Magnet attached ${this.attachedCellBlockId ?? "reference block"} at X ${tcp.x.toFixed(1)} mm, Y ${tcp.y.toFixed(1)} mm.`, "info");
      return;
    }
    if (!attached) throw new Error("Place failed: there is no block attached to the tool.");
    const tcp = this.kinematics.forward(this.events.getJoints(), project.tool.flangeOffset, activeTcpOffset(project.tool));
    const placedCellBlockId = this.attachedCellBlockId;
    let placedStackLevel: number | undefined;
    this.events.setAttached(false);
    this.events.setBlock({ x: tcp.x, y: tcp.y });
    const candidates = this.events.getCellBlocks?.();
    if (candidates && this.attachedCellBlockId) {
      const towerRadius = Math.max(8, project.tool.pickupTolerance.xy);
      const inTowerZone = Math.hypot(tcp.x - project.scene.drop.x, tcp.y - project.scene.drop.y) <= towerRadius;
      const towerBlocks = candidates.filter((candidate) => candidate.source === "output" && candidate.stackLevel !== undefined);
      const stackLevel = inTowerZone ? towerBlocks.length : undefined;
      placedStackLevel = stackLevel;
      const attachedCandidate = candidates.find((candidate) => candidate.id === this.attachedCellBlockId);
      const unloading = attachedCandidate?.source === "output" && Math.hypot(tcp.x - project.scene.drop.x, tcp.y - project.scene.drop.y) > towerRadius;
      this.events.setCellBlocks?.(candidates.map((candidate) => candidate.id === this.attachedCellBlockId
        ? { ...candidate, source: unloading ? "unloaded" : "output", position: { x: tcp.x, y: tcp.y }, r: tcp.r, ...(stackLevel === undefined ? {} : { stackLevel }) }
        : candidate));
    }
    this.attachedCellBlockId = null;
    this.events.setAttachedCellBlockId?.(null);
    this.events.addLog(`Block ${placedCellBlockId ?? "reference block"} placed at X ${tcp.x.toFixed(1)} mm, Y ${tcp.y.toFixed(1)} mm${placedStackLevel === undefined ? "" : `, Z ${(15 * (placedStackLevel + 1)).toFixed(1)} mm, R ${tcp.r.toFixed(1)}°`}.`, "info");
  }

  private waitForIdle(): Promise<void> {
    if (!this.processing && this.queue.length === 0) return Promise.resolve();
    return new Promise((resolve) => this.idleWaiters.push(resolve));
  }

  private notifyIdle() {
    if (this.processing || this.queue.length > 0) return;
    for (const resolve of this.idleWaiters.splice(0)) resolve();
  }

  private async waitUntilResumed(generation: number) {
    while (this.paused && !this.stopped && generation === this.generation) {
      await new Promise<void>((resolve) => this.resumeWaiters.push(resolve));
    }
  }

  private async delay(milliseconds: number, generation: number) {
    const project = this.currentProject();
    const total = milliseconds * (100 / project.simulation.speed);
    let elapsed = 0;
    let previous = performance.now();
    while (elapsed < total && !this.stopped && generation === this.generation) {
      await this.waitUntilResumed(generation);
      const now = await this.nextFrame(generation);
      if (this.paused) {
        await this.waitUntilResumed(generation);
        previous = performance.now();
        continue;
      }
      elapsed += Math.max(0, now - previous);
      previous = now;
    }
  }

  private nextFrame(generation: number) {
    return new Promise<number>((resolve) => {
      let frameId = 0;
      frameId = requestAnimationFrame((now) => {
        this.pendingFrames.delete(frameId);
        if (generation === this.generation) resolve(now);
        else resolve(performance.now());
      });
      this.pendingFrames.set(frameId, resolve);
    });
  }

  private finish() {
    this.stopped = true;
    this.events.setStatus("complete");
    this.events.addLog("Program and queued simulation motions completed.", "info");
    this.notifyIdle();
  }

  private currentProject(): ProjectDocument {
    return this.executionProject ?? this.events.getProject();
  }

  private fail(message: string) {
    if (this.stopped) return;
    this.events.addLog(message, "error");
    this.stop(false);
    this.events.setStatus("error");
  }
}

function interpolatePose(from: Pose, to: Pose, progress: number): Pose {
  const angleDelta = Math.atan2(Math.sin(rad(to.r - from.r)), Math.cos(rad(to.r - from.r)));
  return {
    x: from.x + (to.x - from.x) * progress,
    y: from.y + (to.y - from.y) * progress,
    z: from.z + (to.z - from.z) * progress,
    r: from.r + deg(angleDelta) * progress,
  };
}
