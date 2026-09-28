/// <reference lib="webworker" />
import type { JointAngles, TeachPoint } from "../domain";
import type { LuaWorkerMessage } from "./luaTypes";
import { loadPyodide } from "pyodide";

const scope = self as DedicatedWorkerGlobalScope;
const MAX_ACTIONS = 2000;
const MAX_PRINTS = 500;
const PYTHON_RESERVED = new Set([
  "False", "None", "True", "and", "as", "assert", "async", "await", "break", "class", "continue",
  "def", "del", "elif", "else", "except", "finally", "for", "from", "global", "if", "import",
  "in", "is", "lambda", "nonlocal", "not", "or", "pass", "raise", "return", "try", "while",
  "with", "yield", "ON", "OFF",
]);
let nextCommandId = 1;
let nextRpcId = 1;
let actionCount = 0;
let printCount = 0;
const pendingRpc = new Map<number, (value: unknown) => void>();
const pendingMotions = new Map<number, { resolve: () => void; reject: (error: Error) => void }>();

function send(message: LuaWorkerMessage) {
  scope.postMessage(message);
}

function reserveAction() {
  actionCount += 1;
  if (actionCount > MAX_ACTIONS) throw new Error("Program exceeded the 2,000 simulator-action limit.");
}

function askMain(type: "clock" | "state", payload: Record<string, unknown>): Promise<unknown> {
  const requestId = nextRpcId++;
  return new Promise((resolve) => {
    pendingRpc.set(requestId, resolve);
    scope.postMessage({ type, requestId, ...payload });
  });
}

function queueCartesian(command: "MovJ" | "MovL", x: number, y: number, z: number, r: number, speed: number, acceleration: number, sync: boolean) {
  reserveAction();
  if (![x, y, z, r, speed, acceleration].every(Number.isFinite)) throw new Error("Cartesian target contains a non-finite number.");
  const commandId = nextCommandId++;
  send({ type: "motion", motion: { commandId, command, targetPose: { x, y, z, r }, speed, acceleration, sync } });
  return commandId;
}

function queueRelative(x: number, y: number, z: number, r: number, speed: number, acceleration: number, sync: boolean) {
  reserveAction();
  if (![x, y, z, r, speed, acceleration].every(Number.isFinite) || [x, y, z, r].some((n) => Math.abs(n) > 1000)) {
    throw new Error("Relative offset or motion setting is outside the supported finite range.");
  }
  const commandId = nextCommandId++;
  send({ type: "motion", motion: { commandId, command: "RelMovL", relativeOffset: { x, y, z, r }, speed, acceleration, sync } });
  return commandId;
}

function queueJoint(j1: number, j2: number, j3: number, j4: number, speed: number, acceleration: number, sync: boolean) {
  reserveAction();
  const joints: JointAngles = [j1, j2, j3, j4];
  if (!joints.every(Number.isFinite)) throw new Error("Joint target contains a non-finite number.");
  const commandId = nextCommandId++;
  send({ type: "motion", motion: { commandId, command: "JointMovJ", targetJoints: joints, speed, acceleration, sync } });
  return commandId;
}

function queueToolAction(action: "pick" | "place") {
  reserveAction();
  send({ type: "tool", action });
}

function queueOutput(index: number, value: boolean) {
  reserveAction();
  if (!Number.isInteger(index) || index < 1 || index > 8) throw new Error("Virtual DO index must be an integer from 1 to 8.");
  send({ type: "io", index, value });
}

function waitMotion(commandId: number): Promise<void> {
  return new Promise((resolve, reject) => pendingMotions.set(commandId, { resolve, reject }));
}

function numberSource(value: number): string {
  if (!Number.isFinite(value)) throw new Error("A saved point contains a non-finite number.");
  return String(value);
}

function pointSource(points: TeachPoint[]): string {
  const identifiers = new Set<string>();
  return points.map((point) => {
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(point.name) || PYTHON_RESERVED.has(point.name)) {
      throw new Error("Point names used by Python must be valid, non-reserved identifiers.");
    }
    const key = point.name.toLowerCase();
    if (identifiers.has(key)) throw new Error("Saved point names collide after identifier conversion.");
    identifiers.add(key);
    if (point.kind === "cartesian") {
      const { x, y, z, r } = point.pose;
      return `${point.name} = {"coordinate": {"x": ${numberSource(x)}, "y": ${numberSource(y)}, "z": ${numberSource(z)}, "r": ${numberSource(r)}}}`;
    }
    return `${point.name} = {"joint": [${point.joints.map(numberSource).join(", ")}]}`;
  }).join("\n");
}

const API_SOURCE = `
import math as _math
ON, OFF = 1, 0
_speed_j, _speed_l, _acc_j, _acc_l = 50.0, 50.0, 20.0, 20.0

def _options(cp, speed, acceleration):
    if cp != 0:
        raise ValueError("UNSUPPORTED_OPTION: this simulator supports CP=0 only")
    if not (1 <= speed <= 100) or not (1 <= acceleration <= 100):
        raise ValueError("Speed and acceleration ratios must be between 1 and 100")
    return float(speed), float(acceleration)

def _cartesian(point):
    if not isinstance(point, dict):
        raise TypeError("Cartesian target must be a saved point dictionary")
    value = point.get("coordinate", point)
    if not isinstance(value, dict) or not all(axis in value for axis in ("x", "y", "z")):
        raise ValueError("Cartesian point needs x, y, and z coordinates")
    values = (float(value["x"]), float(value["y"]), float(value["z"]), float(value.get("r", 0)))
    if not all(_math.isfinite(v) and abs(v) <= 1000 for v in values):
        raise ValueError("Cartesian point coordinates must be finite and within ±1000 mm/degrees")
    return values

def _joints(point):
    if isinstance(point, dict):
        point = point.get("joint")
    if not isinstance(point, (list, tuple)) or len(point) != 4:
        raise ValueError("JointMovJ needs four saved joint angles in radians")
    result = tuple(float(v) for v in point)
    if not all(_math.isfinite(v) for v in result):
        raise ValueError("Joint angles must be finite")
    return result

async def _finish_motion(command_id, sync):
    if sync:
        await __wait_motion(command_id)
    return command_id

async def mov_j(point, *, cp=0, speed_j=None, acc_j=None, sync=True):
    speed, acc = _options(cp, _speed_j if speed_j is None else speed_j, _acc_j if acc_j is None else acc_j)
    command_id = __queue_cartesian("MovJ", *_cartesian(point), speed, acc, bool(sync))
    return await _finish_motion(command_id, sync)

async def mov_l(point, *, cp=0, speed_l=None, acc_l=None, sync=True):
    speed, acc = _options(cp, _speed_l if speed_l is None else speed_l, _acc_l if acc_l is None else acc_l)
    command_id = __queue_cartesian("MovL", *_cartesian(point), speed, acc, bool(sync))
    return await _finish_motion(command_id, sync)

async def rel_mov_l(offset, *, cp=0, speed_l=None, acc_l=None, sync=True):
    if isinstance(offset, dict):
        values = (offset.get("OffsetX", offset.get("x")), offset.get("OffsetY", offset.get("y")), offset.get("OffsetZ", offset.get("z")), offset.get("OffsetR", offset.get("r", 0)))
    elif isinstance(offset, (list, tuple)) and len(offset) == 4:
        values = tuple(offset)
    else:
        raise ValueError("rel_mov_l needs four X/Y/Z/R offset values")
    x, y, z, r = (float(v) for v in values)
    speed, acc = _options(cp, _speed_l if speed_l is None else speed_l, _acc_l if acc_l is None else acc_l)
    command_id = __queue_relative(x, y, z, r, speed, acc, bool(sync))
    return await _finish_motion(command_id, sync)

async def joint_mov_j(point, *, cp=0, speed_j=None, acc_j=None, sync=True):
    speed, acc = _options(cp, _speed_j if speed_j is None else speed_j, _acc_j if acc_j is None else acc_j)
    command_id = __queue_joint(*_joints(point), speed, acc, bool(sync))
    return await _finish_motion(command_id, sync)

def do(index, status):
    if status not in (0, 1, False, True):
        raise ValueError("DO status must be ON/OFF, true/false, or 1/0")
    __digital_output(int(index), bool(status))

def pick(): __tool_action("pick")
def place(): __tool_action("place")

async def sync(): await __clock("sync", 0)
async def wait(milliseconds):
    value = float(milliseconds)
    if not _math.isfinite(value) or value < 0: raise ValueError("wait requires finite non-negative milliseconds")
    await __clock("wait", value)
async def sleep(milliseconds):
    value = float(milliseconds)
    if not _math.isfinite(value) or value < 0: raise ValueError("sleep requires finite non-negative milliseconds")
    await __clock("sleep", value)
async def get_pose(): return await __read_state("pose")
async def get_angle(): return await __read_state("angles")

def speed_j(value):
    global _speed_j
    _speed_j, _ = _options(0, value, _acc_j)
def speed_l(value):
    global _speed_l
    _speed_l, _ = _options(0, value, _acc_l)
def acc_j(value):
    global _acc_j
    _, _acc_j = _options(0, _speed_j, value)
def acc_l(value):
    global _acc_l
    _, _acc_l = _options(0, _speed_l, value)
`;

async function execute(script: string, points: TeachPoint[]) {
  let pyodide: Awaited<ReturnType<typeof import("pyodide").loadPyodide>> | undefined;
  try {
    const allowedRuntimePrefix = new URL("/pyodide/", scope.location.origin).pathname;
    const originalFetch = scope.fetch.bind(scope);
    let loadingRuntime = true;
    scope.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(typeof input === "string" || input instanceof URL ? input.toString() : input.url, scope.location.origin);
      if (!loadingRuntime || url.origin !== scope.location.origin || !url.pathname.startsWith(allowedRuntimePrefix)) {
        return Promise.reject(new Error("Python network access is disabled in this local simulator."));
      }
      return originalFetch(input, init);
    }) as typeof fetch;

    const runtime = await loadPyodide({ indexURL: "/pyodide/" });
    pyodide = runtime;
    loadingRuntime = false;

    const log = (message: string, level: "info" | "error" = "info") => {
      printCount += 1;
      if (printCount <= MAX_PRINTS) send({ type: "print", message: String(message), level });
      else if (printCount === MAX_PRINTS + 1) send({ type: "print", message: "Additional Python output was suppressed after 500 messages.", level: "warning" });
    };
    runtime.setStdout({ batched: (message: string) => log(message) });
    runtime.setStderr({ batched: (message: string) => log(message, "error") });
    runtime.globals.set("__queue_cartesian", queueCartesian);
    runtime.globals.set("__queue_relative", queueRelative);
    runtime.globals.set("__queue_joint", queueJoint);
    runtime.globals.set("__wait_motion", waitMotion);
    runtime.globals.set("__clock", (mode: "sleep" | "wait" | "sync", milliseconds: number) => askMain("clock", { mode, milliseconds }));
    runtime.globals.set("__read_state", (state: "pose" | "angles") => askMain("state", { state }));
    runtime.globals.set("__digital_output", queueOutput);
    runtime.globals.set("__tool_action", queueToolAction);

    await runtime.runPythonAsync([API_SOURCE, pointSource(points), script].filter(Boolean).join("\n"));
    send({ type: "script-complete" });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    send({ type: "script-error", message });
  } finally {
    pyodide?.globals.destroy();
    scope.close();
  }
}

scope.onmessage = (event: MessageEvent) => {
  const data = event.data as { type?: string; script?: string; points?: TeachPoint[]; requestId?: number; value?: unknown; commandId?: number; message?: string };
  if (data.type === "run" && typeof data.script === "string" && Array.isArray(data.points)) {
    nextCommandId = 1;
    nextRpcId = 1;
    actionCount = 0;
    printCount = 0;
    void execute(data.script, data.points);
    return;
  }
  if (data.type === "rpc-response" && typeof data.requestId === "number") {
    const resolve = pendingRpc.get(data.requestId);
    if (resolve) {
      pendingRpc.delete(data.requestId);
      resolve(data.value);
    }
    return;
  }
  if (data.type === "motion-complete" && typeof data.commandId === "number") {
    const pending = pendingMotions.get(data.commandId);
    if (pending) {
      pendingMotions.delete(data.commandId);
      pending.resolve();
    }
    return;
  }
  if (data.type === "motion-failed" && typeof data.commandId === "number") {
    const pending = pendingMotions.get(data.commandId);
    if (pending) {
      pendingMotions.delete(data.commandId);
      pending.reject(new Error(typeof data.message === "string" ? data.message : "Motion failed."));
    }
  }
};
