/// <reference lib="webworker" />
import { LuaFactory } from "wasmoon";
import type { JointAngles, TeachPoint } from "../domain";
import type { LuaWorkerMessage, MotionCommand } from "./luaTypes";

const scope = self as DedicatedWorkerGlobalScope;
const MAX_ACTIONS = 2000;
const MAX_PRINTS = 500;
let nextCommandId = 1;
let nextRpcId = 1;
let printCount = 0;
let actionCount = 0;
let engine: Awaited<ReturnType<LuaFactory["createEngine"]>> | undefined;
const pendingRpc = new Map<number, (value: unknown) => void>();
const pendingMotions = new Map<number, { resolve: () => void; reject: (reason: Error) => void }>();

function send(message: LuaWorkerMessage) {
  scope.postMessage(message);
}

function askMain(type: "clock" | "state", payload: Record<string, unknown>): Promise<unknown> {
  const requestId = nextRpcId++;
  return new Promise((resolve) => {
    pendingRpc.set(requestId, resolve);
    scope.postMessage({ type, requestId, ...payload });
  });
}

function luaNumber(value: number): string {
  if (!Number.isFinite(value)) throw new Error("A saved point contains a non-finite number.");
  return String(value);
}

function luaIdentifier(value: string): string {
  const reserved = new Set([
    "and", "break", "do", "else", "elseif", "end", "false", "for", "function", "goto",
    "if", "in", "local", "nil", "not", "or", "repeat", "return", "then", "true", "until", "while",
    "MovJ", "MovL", "JointMovJ", "RelMovL", "Wait", "Sleep", "Sync", "DO", "Pick", "Place",
    "GetPose", "GetAngle", "SpeedJ", "SpeedL", "AccJ", "AccL", "ON", "OFF",
    "assert", "dofile", "error", "getmetatable", "ipairs", "load", "loadfile", "next", "pairs",
    "pcall", "print", "rawequal", "rawget", "rawlen", "rawset", "select", "setmetatable", "tonumber",
    "tostring", "type", "xpcall", "coroutine", "string", "table", "math", "utf8", "io", "os",
    "package", "debug", "_G", "_VERSION",
  ]);
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(value) || reserved.has(value)) {
    throw new Error("Point names used by Lua must be valid, non-reserved identifiers.");
  }
  return value;
}

function reserveAction() {
  actionCount += 1;
  if (actionCount > MAX_ACTIONS) throw new Error("Program exceeded the 2,000 simulator-action limit.");
}

function pointSource(points: TeachPoint[]): string {
  const identifiers = new Set<string>();
  return points
    .map((point) => {
      const name = luaIdentifier(point.name);
      if (identifiers.has(name.toLowerCase())) {
        throw new Error("Saved point names collide after Lua identifier conversion.");
      }
      identifiers.add(name.toLowerCase());
      if (point.kind === "cartesian") {
        const p = point.pose;
        return (
          "local " + name + " = {coordinate={x=" + luaNumber(p.x) +
          ",y=" + luaNumber(p.y) + ",z=" + luaNumber(p.z) +
          ",r=" + luaNumber(p.r) + "}}"
        );
      }
      return (
        "local " + name + " = {joint={" +
        point.joints.map(luaNumber).join(",") + "}}"
      );
    })
    .join("\n");
}

function apiSource() {
  return [
    "for _, name in ipairs({'io','os','package','debug','dofile','loadfile','load','require','collectgarbage'}) do _G[name]=nil end",
    "ON, OFF = 1, 0",
    "local defaultSpeedJ, defaultSpeedL = 50, 50",
    "local defaultAccJ, defaultAccL = 20, 20",
    "local function validOptionRatio(value, name)",
    "  if type(value) ~= 'number' or value < 1 or value > 100 then error(name .. ' motion option must be between 1 and 100') end",
    "  return value",
    "end",
    "local function validSettingRatio(value, name)",
    "  if type(value) ~= 'number' or value < 0 or value > 100 then error(name .. ' setting must be between 0 and 100') end",
    "  return value",
    "end",
    "local function checkedOptions(options, speedName, accName, commandName)",
    "  options = options or {}",
    "  if type(options) ~= 'table' then error('Motion options must be a table') end",
    "  for key in pairs(options) do",
    "    if key ~= 'CP' and key ~= 'SYNC' and key ~= speedName and key ~= accName then error('UNSUPPORTED_OPTION: ' .. commandName .. ' does not support option ' .. tostring(key)) end",
    "  end",
    "  local cp = options.CP",
    "  if cp == nil then __log('CP omitted; this simulator uses CP=0. DobotStudio Pro documents CP=1 by default.', 'warning')",
    "  elseif cp ~= 0 then error('UNSUPPORTED_OPTION: continuous-path blending requires CP=0 in this version') end",
    "  local sync = options.SYNC or 0",
    "  if sync ~= 0 and sync ~= 1 then error('SYNC must be 0 or 1') end",
    "  local speed = options[speedName] or (speedName == 'SpeedJ' and defaultSpeedJ or defaultSpeedL)",
    "  local acc = options[accName] or (accName == 'AccJ' and defaultAccJ or defaultAccL)",
    "  return validOptionRatio(speed, speedName), validOptionRatio(acc, accName), sync == 1",
    "end",
    "local function coordinate(point)",
    "  if type(point) ~= 'table' then error('Cartesian target must be a point table') end",
    "  local value = point.coordinate or point",
    "  if type(value) ~= 'table' or type(value.x) ~= 'number' or type(value.y) ~= 'number' or type(value.z) ~= 'number' then",
    "    error('Cartesian point needs coordinate.x, coordinate.y, and coordinate.z')",
    "  end",
    "  return value.x, value.y, value.z, value.r or 0",
    "end",
    "function MovJ(point, options)",
    "  local x,y,z,r = coordinate(point)",
    "  local speed,acc,sync = checkedOptions(options,'SpeedJ','AccJ','MovJ')",
    "  local id = __queueCartesian('MovJ',x,y,z,r,speed,acc,sync)",
    "  if sync then __waitMotion(id):await() end",
    "end",
    "function MovL(point, options)",
    "  local x,y,z,r = coordinate(point)",
    "  local speed,acc,sync = checkedOptions(options,'SpeedL','AccL','MovL')",
    "  local id = __queueCartesian('MovL',x,y,z,r,speed,acc,sync)",
    "  if sync then __waitMotion(id):await() end",
    "end",
    "function RelMovL(offset, options)",
    "  if type(offset) ~= 'table' then error('RelMovL offset must be a table') end",
    "  local x,y,z,r",
    "  if offset[1] ~= nil then x,y,z,r=offset[1],offset[2],offset[3],offset[4]",
    "  else x,y,z,r=offset.OffsetX or offset.x,offset.OffsetY or offset.y,offset.OffsetZ or offset.z,offset.OffsetR or offset.r end",
    "  if type(x) ~= 'number' or type(y) ~= 'number' or type(z) ~= 'number' or type(r) ~= 'number' then error('RelMovL needs X, Y, Z, and R offset values') end",
    "  local speed,acc,sync = checkedOptions(options,'SpeedL','AccL','RelMovL')",
    "  local id = __queueRelative(x,y,z,r,speed,acc,sync)",
    "  if sync then __waitMotion(id):await() end",
    "end",
    "function JointMovJ(point, options)",
    "  if type(point) ~= 'table' or type(point.joint) ~= 'table' then error('JointMovJ needs a point with joint={j1,j2,j3,j4}') end",
    "  local j = point.joint",
    "  if #j ~= 4 then error('JointMovJ needs four joint angles in radians') end",
    "  local speed,acc,sync = checkedOptions(options,'SpeedJ','AccJ','JointMovJ')",
    "  local id = __queueJoint(j[1],j[2],j[3],j[4],speed,acc,sync)",
    "  if sync then __waitMotion(id):await() end",
    "end",
    "function Sync() __clock('sync',0):await() end",
    "function Wait(milliseconds)",
    "  if type(milliseconds) ~= 'number' or milliseconds < 0 or milliseconds ~= milliseconds or milliseconds == math.huge then error('Wait requires a finite, non-negative millisecond value') end",
    "  __clock('wait',milliseconds):await()",
    "end",
    "function Sleep(milliseconds)",
    "  if type(milliseconds) ~= 'number' or milliseconds < 0 or milliseconds ~= milliseconds or milliseconds == math.huge then error('Sleep requires a finite, non-negative millisecond value') end",
    "  __clock('sleep',milliseconds):await()",
    "end",
    "function DO(index,status)",
    "  if type(index) ~= 'number' or index < 1 or index > 8 or index % 1 ~= 0 then error('Virtual DO index must be an integer from 1 to 8') end",
    "  if status ~= 0 and status ~= 1 and status ~= true and status ~= false then error('DO status must be ON/OFF, true/false, or 1/0') end",
    "  __digitalOutput(index,status == 1 or status == true)",
    "end",
    "function Pick() __toolAction('pick') end",
    "function Place() __toolAction('place') end",
    "function GetPose()",
    "  local p = __readState('pose'):await()",
    "  return {coordinate={x=p.x,y=p.y,z=p.z,r=p.r}}",
    "end",
    "function GetAngle()",
    "  local a = __readState('angles'):await()",
    "  return {joint={a.j1,a.j2,a.j3,a.j4}}",
    "end",
    "function SpeedJ(value) defaultSpeedJ=validSettingRatio(value,'SpeedJ') end",
    "function SpeedL(value) defaultSpeedL=validSettingRatio(value,'SpeedL') end",
    "function AccJ(value) defaultAccJ=validSettingRatio(value,'AccJ') end",
    "function AccL(value) defaultAccL=validSettingRatio(value,'AccL') end",
    "function print(...)",
    "  local out = {}",
    "  for i=1,select('#',...) do out[#out+1]=tostring(select(i,...)) end",
    "  __log(table.concat(out,'\\t'),'info')",
    "end",
  ].join("\n");
}

function queueCartesian(
  command: MotionCommand,
  x: number,
  y: number,
  z: number,
  r: number,
  speed: number,
  acceleration: number,
  sync: boolean,
) {
  reserveAction();
  if (![x, y, z, r, speed, acceleration].every(Number.isFinite)) {
    throw new Error("Motion target contains a non-finite number.");
  }
  const commandId = nextCommandId++;
  send({
    type: "motion",
    motion: {
      commandId,
      command,
      targetPose: { x, y, z, r },
      speed,
      acceleration,
      sync,
    },
  });
  return commandId;
}

function queueJoint(
  j1: number,
  j2: number,
  j3: number,
  j4: number,
  speed: number,
  acceleration: number,
  sync: boolean,
) {
  reserveAction();
  const joints = [j1, j2, j3, j4];
  if (!joints.every(Number.isFinite)) throw new Error("Joint target contains a non-finite number.");
  const commandId = nextCommandId++;
  send({
    type: "motion",
    motion: {
      commandId,
      command: "JointMovJ",
      targetJoints: joints as JointAngles,
      speed,
      acceleration,
      sync,
    },
  });
  return commandId;
}

function queueRelative(x: number, y: number, z: number, r: number, speed: number, acceleration: number, sync: boolean) {
  reserveAction();
  if (![x, y, z, r, speed, acceleration].every(Number.isFinite) || [x, y, z, r].some((n) => Math.abs(n) > 1000)) {
    throw new Error("RelMovL offset or motion setting is outside the supported finite range.");
  }
  const commandId = nextCommandId++;
  send({
    type: "motion",
    motion: {
      commandId,
      command: "RelMovL",
      relativeOffset: { x, y, z, r },
      speed,
      acceleration,
      sync,
    },
  });
  return commandId;
}

async function execute(script: string, points: TeachPoint[]) {
  try {
    const factory = new LuaFactory("/wasmoon/glue.wasm");
    engine = await factory.createEngine({ openStandardLibs: true, injectObjects: true, traceAllocations: true });
    engine.global.setMemoryMax(64 * 1024 * 1024);
    engine.global.set("__queueCartesian", queueCartesian);
    engine.global.set("__queueRelative", queueRelative);
    engine.global.set("__queueJoint", queueJoint);
    engine.global.set("__waitMotion", (commandId: number) =>
      new Promise<void>((resolve, reject) => pendingMotions.set(commandId, { resolve, reject })),
    );
    engine.global.set("__clock", (mode: "sleep" | "wait" | "sync", milliseconds: number) =>
      askMain("clock", { mode, milliseconds }),
    );
    engine.global.set("__readState", (state: "pose" | "angles") => askMain("state", { state }));
    engine.global.set("__digitalOutput", (index: number, value: boolean) => {
      reserveAction();
      send({ type: "io", index, value });
    });
    engine.global.set("__toolAction", (action: "pick" | "place") => {
      reserveAction();
      send({ type: "tool", action });
    });
    engine.global.set("__log", (message: string, level: "info" | "warning" | "error") => {
      printCount += 1;
      if (printCount <= MAX_PRINTS) send({ type: "print", message: String(message), level });
      else if (printCount === MAX_PRINTS + 1) send({ type: "print", message: "Additional Lua output was suppressed after 500 messages.", level: "warning" });
    });

    const program = [apiSource(), pointSource(points), script].join("\n");
    await engine.doString(program);
    send({ type: "script-complete" });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    send({ type: "script-error", message });
  } finally {
    engine?.global.close();
    engine = undefined;
    scope.close();
  }
}

scope.onmessage = (event: MessageEvent) => {
  const data = event.data as { type?: string; script?: string; points?: TeachPoint[]; requestId?: number; value?: unknown; commandId?: number; message?: string };
  if (data.type === "run" && typeof data.script === "string" && Array.isArray(data.points)) {
    nextCommandId = 1;
    nextRpcId = 1;
    printCount = 0;
    actionCount = 0;
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
