import type { ProgramLanguage, TeachPoint, ToolMode } from "../domain";

export type SavedPointDescriptor = Pick<TeachPoint, "name" | "kind">;

export type RobotCall = {
  name: string;
  line: number;
  targetName?: string | null;
  memberCall?: boolean;
  invalidMotionTarget?: boolean;
  invalidMotionOptions?: string[];
  invalidRelativeOffset?: boolean;
};

export type CodeReviewFinding = {
  kind: "unsupported-api" | "api-shadowed" | "passive-fork-action" | "missing-point" | "wrong-point-kind" |
    "invalid-motion-target" | "invalid-motion-option" | "invalid-relative-offset";
  line: number;
  message: string;
};

export type CodeReviewReport = {
  findings: CodeReviewFinding[];
  robotCallCount: number;
  pointTargetCount: number;
  unresolvedLocalTargetCount: number;
  pointsStatus: "checked" | "not-shared" | "local-targets" | "no-targets";
};

type Token = { value: string; kind: "identifier" | "symbol" | "string" | "number"; line: number };

const LUA_TARGET_KIND: Record<string, "cartesian" | "joint"> = {
  MovJ: "cartesian",
  MovL: "cartesian",
  JointMovJ: "joint",
};

const PYTHON_TARGET_KIND: Record<string, "cartesian" | "joint"> = {
  mov_j: "cartesian",
  mov_l: "cartesian",
  joint_mov_j: "joint",
};

const LUA_APIS = new Set([
  "MovJ", "MovL", "JointMovJ", "RelMovL", "Wait", "Sleep", "Sync", "DO", "Pick", "Place",
  "GetPose", "GetAngle", "SpeedJ", "SpeedL", "AccJ", "AccL", "print",
]);

const PYTHON_APIS = new Set([
  "mov_j", "mov_l", "joint_mov_j", "rel_mov_l", "wait", "sleep", "sync", "do", "pick", "place",
  "get_pose", "get_angle", "speed_j", "speed_l", "acc_j", "acc_l", "print",
]);

const LUA_OPTION_CASE: Record<string, string> = {
  cp: "CP",
  speedj: "SpeedJ",
  accj: "AccJ",
  speedl: "SpeedL",
  accl: "AccL",
  sync: "SYNC",
};

function luaRobotCallName(name: string): boolean {
  return /^(?:mov|jointmov|relmov|do|pick|place|speed|acc|get|arc|circle|jump|servo|set)/i.test(name);
}

function skipLongBracket(source: string, start: number): number | null {
  const opening = source.slice(start).match(/^\[(=*)\[/);
  if (!opening) return null;
  const closing = "]" + opening[1] + "]";
  const end = source.indexOf(closing, start + opening[0].length);
  return end < 0 ? source.length : end + closing.length;
}

function tokenizeLua(source: string): Token[] {
  const tokens: Token[] = [];
  let index = 0;
  let line = 1;

  while (index < source.length) {
    const char = source[index];
    if (/\s/.test(char)) {
      if (char === "\n") line += 1;
      index += 1;
      continue;
    }

    if (source.startsWith("--", index)) {
      const longEnd = skipLongBracket(source, index + 2);
      if (longEnd !== null) {
        line += (source.slice(index, longEnd).match(/\n/g) ?? []).length;
        index = longEnd;
      } else {
        const end = source.indexOf("\n", index + 2);
        index = end < 0 ? source.length : end;
      }
      continue;
    }

    if (char === "'" || char === '"') {
      const quote = char;
      const startLine = line;
      index += 1;
      while (index < source.length) {
        if (source[index] === "\\") {
          if (source[index + 1] === "\n") line += 1;
          index += 2;
        } else if (source[index] === quote) {
          index += 1;
          break;
        } else {
          if (source[index] === "\n") line += 1;
          index += 1;
        }
      }
      tokens.push({ value: "<string>", kind: "string", line: startLine });
      continue;
    }

    if (char === "[") {
      const longEnd = skipLongBracket(source, index);
      if (longEnd !== null) {
        line += (source.slice(index, longEnd).match(/\n/g) ?? []).length;
        index = longEnd;
        continue;
      }
    }

    if (/\d/.test(char) || (char === "." && /\d/.test(source[index + 1] ?? ""))) {
      const number = source.slice(index).match(/^(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/)?.[0];
      if (number) {
        tokens.push({ value: number, kind: "number", line });
        index += number.length;
        continue;
      }
    }

    if (/[A-Za-z_]/.test(char)) {
      const start = index;
      while (/[A-Za-z0-9_]/.test(source[index] ?? "")) index += 1;
      tokens.push({ value: source.slice(start, index), kind: "identifier", line });
      continue;
    }

    tokens.push({ value: char, kind: "symbol", line });
    index += 1;
  }
  return tokens;
}

function collectLuaDefinitions(tokens: Token[]): Set<string> {
  const definitions = new Set<string>();
  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (token.value === "local") {
      let next = index + 1;
      if (tokens[next]?.value === "function") next += 1;
      if (tokens[next]?.kind === "identifier") {
        definitions.add(tokens[next].value);
        next += 1;
        while (tokens[next]?.value === "," && tokens[next + 1]?.kind === "identifier") {
          definitions.add(tokens[next + 1].value);
          next += 2;
        }
      }
    }
    if (token.value === "function") {
      if (tokens[index + 1]?.kind === "identifier") definitions.add(tokens[index + 1].value);
      let open = index + 1;
      while (open < tokens.length && tokens[open].value !== "(" && tokens[open].value !== "end") open += 1;
      if (tokens[open]?.value === "(") {
        for (let cursor = open + 1; cursor < tokens.length && tokens[cursor].value !== ")"; cursor += 1) {
          if (tokens[cursor].kind === "identifier" && (tokens[cursor - 1]?.value === "(" || tokens[cursor - 1]?.value === ",")) {
            definitions.add(tokens[cursor].value);
          }
        }
      }
    }
    if (token.kind === "identifier" && tokens[index + 1]?.value === "=") definitions.add(token.value);
  }
  return definitions;
}

function luaTarget(tokens: Token[], index: number): string | undefined {
  if (tokens[index + 1]?.value !== "(") return undefined;
  const first = tokens[index + 2];
  if (first?.kind !== "identifier") return undefined;
  return tokens[index + 3]?.value === "," || tokens[index + 3]?.value === ")" ? first.value : undefined;
}

function splitLuaList(tokens: Token[]): Token[][] {
  const items: Token[][] = [];
  let current: Token[] = [];
  const stack: string[] = [];
  const closingFor: Record<string, string> = { "(": ")", "{": "}", "[": "]" };
  for (const token of tokens) {
    if (closingFor[token.value]) stack.push(closingFor[token.value]);
    else if ([")", "}", "]"].includes(token.value) && stack.at(-1) === token.value) stack.pop();
    if (token.value === "," && stack.length === 0) {
      items.push(current);
      current = [];
    } else {
      current.push(token);
    }
  }
  if (current.length > 0 || items.length > 0) items.push(current);
  return items;
}

function luaCallArguments(tokens: Token[], callIndex: number): Token[][] {
  if (tokens[callIndex + 1]?.value !== "(") return [];
  const args: Token[][] = [];
  let current: Token[] = [];
  const stack: string[] = [];
  const closingFor: Record<string, string> = { "(": ")", "{": "}", "[": "]" };
  for (let index = callIndex + 2; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (token.value === ")" && stack.length === 0) {
      if (current.length > 0 || args.length > 0) args.push(current);
      return args;
    }
    if (closingFor[token.value]) stack.push(closingFor[token.value]);
    else if ([")", "}", "]"].includes(token.value) && stack.at(-1) === token.value) stack.pop();
    if (token.value === "," && stack.length === 0) {
      args.push(current);
      current = [];
    } else {
      current.push(token);
    }
  }
  return args;
}

function namedLuaField(item: Token[]): string | undefined {
  return item[0]?.kind === "identifier" && item[1]?.value === "=" ? item[0].value : undefined;
}

function luaOptionCaseIssues(optionTokens: Token[] | undefined): string[] {
  if (!optionTokens || optionTokens[0]?.value !== "{" || optionTokens.at(-1)?.value !== "}") return [];
  return splitLuaList(optionTokens.slice(1, -1))
    .map(namedLuaField)
    .filter((field): field is string => Boolean(field))
    .flatMap((field) => {
      const canonical = LUA_OPTION_CASE[field.toLowerCase()];
      return canonical && canonical !== field ? [canonical] : [];
    });
}

function hasInvalidRelMovLOffset(offsetTokens: Token[] | undefined): boolean {
  if (!offsetTokens || offsetTokens[0]?.value !== "{" || offsetTokens.at(-1)?.value !== "}") return false;
  const items = splitLuaList(offsetTokens.slice(1, -1));
  if (items.length === 0) return true;
  const fields = items.map(namedLuaField);
  if (!fields.some(Boolean)) {
    return items.length < 4 && items.every((item) =>
      (item.length === 1 && item[0].kind === "number") ||
      (item.length === 2 && ["-", "+"].includes(item[0].value) && item[1].kind === "number"));
  }
  if (fields.some((field) => !field)) return true;
  const names = new Set(fields as string[]);
  const hasAxis = (long: string, short: string) => names.has(long) || names.has(short);
  return !hasAxis("OffsetX", "x") || !hasAxis("OffsetY", "y") || !hasAxis("OffsetZ", "z") || !hasAxis("OffsetR", "r");
}

export function inspectLuaCalls(source: string): { calls: RobotCall[]; definitions: Set<string> } {
  const tokens = tokenizeLua(source);
  const definitions = collectLuaDefinitions(tokens);
  const calls: RobotCall[] = [];
  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (token.kind !== "identifier" || !luaRobotCallName(token.value)) continue;
    const next = tokens[index + 1]?.value;
    if (next !== "(" && next !== "{") continue;
    const memberCall = tokens[index - 1]?.value === "." || tokens[index - 1]?.value === ":";
    if (LUA_APIS.has(token.value) || !definitions.has(token.value) || memberCall) {
      const args = luaCallArguments(tokens, index);
      const firstTargetToken = args[0]?.[0]?.value === "-" || args[0]?.[0]?.value === "+" ? args[0]?.[1] : args[0]?.[0];
      calls.push({
        name: token.value,
        line: token.line,
        targetName: luaTarget(tokens, index),
        memberCall,
        invalidMotionTarget: Boolean(expectedKind("lua", token.value) && (
          firstTargetToken?.kind === "string" || firstTargetToken?.kind === "number" ||
          ["true", "false", "nil"].includes(firstTargetToken?.value ?? "")
        )),
        invalidMotionOptions: luaOptionCaseIssues(args[1]),
        invalidRelativeOffset: token.value === "RelMovL" && hasInvalidRelMovLOffset(args[0]),
      });
    }
  }
  return { calls, definitions };
}

function expectedKind(language: ProgramLanguage, name: string): "cartesian" | "joint" | undefined {
  return language === "lua" ? LUA_TARGET_KIND[name] : PYTHON_TARGET_KIND[name];
}

function supportedApi(language: ProgramLanguage, name: string): boolean {
  return language === "lua" ? LUA_APIS.has(name) : PYTHON_APIS.has(name);
}

export function reviewRobotCalls(
  language: ProgramLanguage,
  calls: RobotCall[],
  definitions: Set<string>,
  points: SavedPointDescriptor[],
  checkSavedPoints: boolean,
  toolMode: ToolMode,
): CodeReviewReport {
  const findings: CodeReviewFinding[] = [];
  const pointMap = new Map(points.map((point) => [point.name, point.kind]));
  let pointTargetCount = 0;
  let unresolvedLocalTargetCount = 0;

  for (const call of calls) {
    const supported = supportedApi(language, call.name);
    const passiveAction = language === "lua"
      ? ["DO", "Pick", "Place"].includes(call.name)
      : ["do", "pick", "place"].includes(call.name);

    if (!supported && !definitions.has(call.name)) {
      const detail = call.memberCall
        ? "Method-style calls are not part of this simulator API; use the documented global command."
        : "This robot-style command is not in the simulator's supported API.";
      findings.push({ kind: "unsupported-api", line: call.line, message: "“" + call.name + "” is unsupported. " + detail });
      continue;
    }
    if (!supported) continue;
    if (call.memberCall) {
      findings.push({ kind: "unsupported-api", line: call.line, message: "“" + call.name + "” must be called as a documented global simulator command, not as an object method." });
      continue;
    }
    if (definitions.has(call.name)) {
      findings.push({ kind: "api-shadowed", line: call.line, message: "The snippet defines “" + call.name + "”, which shadows the simulator command." });
    }
    if (call.invalidMotionTarget) {
      findings.push({
        kind: "invalid-motion-target",
        line: call.line,
        message: "Motion commands need a saved point variable or point table, not a quoted name or raw numeric coordinate list.",
      });
    }
    for (const expectedOption of call.invalidMotionOptions ?? []) {
      findings.push({
        kind: "invalid-motion-option",
        line: call.line,
        message: `Use the exact case-sensitive option name ${expectedOption} for this simulator command.`,
      });
    }
    if (call.invalidRelativeOffset) {
      findings.push({
        kind: "invalid-relative-offset",
        line: call.line,
        message: "RelMovL needs X, Y, Z, and R offset values, either positional or named; use R=0 when no rotation is needed.",
      });
    }
    if (toolMode === "fork" && passiveAction) {
      findings.push({
        kind: "passive-fork-action",
        line: call.line,
        message: "The unpowered fork cannot use “" + call.name + "”. Slide beneath the block, lift it, then lower it onto the support pads.",
      });
    }

    const expected = expectedKind(language, call.name);
    if (!expected || !call.targetName) continue;
    pointTargetCount += 1;
    if (!checkSavedPoints) {
      unresolvedLocalTargetCount += 1;
      continue;
    }
    if (definitions.has(call.targetName)) {
      unresolvedLocalTargetCount += 1;
      continue;
    }
    const kind = pointMap.get(call.targetName);
    if (!kind) {
      findings.push({
        kind: "missing-point",
        line: call.line,
        message: "Motion target “" + call.targetName + "” was not found in the shared saved points. Share the project's points or define this target in the example.",
      });
    } else if (kind !== expected) {
      const expectedLabel = expected === "cartesian" ? "Cartesian" : "joint";
      findings.push({
        kind: "wrong-point-kind",
        line: call.line,
        message: "“" + call.name + "” needs a " + expectedLabel + " point, but “" + call.targetName + "” is saved as " + kind + ".",
      });
    }
  }

  let pointsStatus: CodeReviewReport["pointsStatus"] = "no-targets";
  if (pointTargetCount > 0) {
    if (!checkSavedPoints) pointsStatus = "not-shared";
    else if (unresolvedLocalTargetCount > 0) pointsStatus = "local-targets";
    else pointsStatus = "checked";
  }
  return { findings, robotCallCount: calls.length, pointTargetCount, unresolvedLocalTargetCount, pointsStatus };
}

export function reviewLuaSnippet(
  source: string,
  points: SavedPointDescriptor[],
  checkSavedPoints: boolean,
  toolMode: ToolMode,
): CodeReviewReport {
  const { calls, definitions } = inspectLuaCalls(source);
  return reviewRobotCalls("lua", calls, definitions, points, checkSavedPoints, toolMode);
}
