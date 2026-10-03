/// <reference lib="webworker" />
import type { ProgramLanguage, ToolMode } from "../domain";
import { LuaFactory } from "wasmoon";
import { loadPyodide } from "pyodide";
import { reviewLuaSnippet, reviewRobotCalls, type CodeReviewFinding, type RobotCall, type SavedPointDescriptor } from "./codeReview";
import { PYTHON_COMPILER_CHECK } from "../sim/pythonCompiler";
import { PYTHON_ANALYSIS } from "./pythonAnalysis";

const scope = self as DedicatedWorkerGlobalScope;
type Request = { type?: string; language?: ProgramLanguage; sources?: unknown[]; points?: unknown[]; checkPoints?: boolean; toolMode?: ToolMode };
type Result = {
  ok: boolean;
  syntaxOk: boolean;
  error?: string;
  findings?: CodeReviewFinding[];
  robotCallCount?: number;
  pointTargetCount?: number;
  unresolvedLocalTargetCount?: number;
  pointsStatus?: "checked" | "not-shared" | "local-targets" | "no-targets";
};

function errorText(error: unknown): string {
  return (error instanceof Error ? error.message : String(error)).slice(0, 300);
}

function reviewedResult(report: ReturnType<typeof reviewLuaSnippet>): Result {
  return {
    ok: report.findings.length === 0,
    syntaxOk: true,
    findings: report.findings,
    robotCallCount: report.robotCallCount,
    pointTargetCount: report.pointTargetCount,
    unresolvedLocalTargetCount: report.unresolvedLocalTargetCount,
    pointsStatus: report.pointsStatus,
  };
}

async function checkLua(sources: string[], points: SavedPointDescriptor[], checkPoints: boolean, toolMode: ToolMode): Promise<Result[]> {
  const factory = new LuaFactory("/wasmoon/glue.wasm");
  const engine = await factory.createEngine({ openStandardLibs: false, injectObjects: false });
  try {
    return sources.map((source) => {
      try {
        engine.global.loadString(source, "<ai-suggestion>");
        engine.global.setTop(0);
        return reviewedResult(reviewLuaSnippet(source, points, checkPoints, toolMode));
      } catch (error) {
        engine.global.setTop(0);
        return { ok: false, syntaxOk: false, error: errorText(error) };
      }
    });
  } finally {
    engine.global.close();
  }
}

async function checkPython(
  sources: string[],
  points: SavedPointDescriptor[],
  checkPoints: boolean,
  toolMode: ToolMode,
): Promise<Result[]> {
  const allowedRuntimePrefix = new URL("/pyodide/", scope.location.origin).pathname;
  const originalFetch = scope.fetch.bind(scope);
  scope.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(typeof input === "string" || input instanceof URL ? input.toString() : input.url, scope.location.origin);
    if (url.origin !== scope.location.origin || !url.pathname.startsWith(allowedRuntimePrefix)) {
      return Promise.reject(new Error("Local syntax checker blocked a non-local Python runtime request."));
    }
    return originalFetch(input, init);
  }) as typeof fetch;

  const runtime = await loadPyodide({ indexURL: "/pyodide/" });
  try {
    return sources.map((source) => {
      try {
        runtime.globals.set("__ai_source", source);
        runtime.globals.set("_student_source", source);
        runtime.runPython(PYTHON_COMPILER_CHECK);
        const raw = runtime.runPython(PYTHON_ANALYSIS);
        if (typeof raw !== "string") throw new Error("Python AST review returned an invalid result.");
        const inventory = JSON.parse(raw) as { calls: RobotCall[]; definitions: string[] };
        const report = reviewRobotCalls("python", inventory.calls, new Set(inventory.definitions), points, checkPoints, toolMode);
        return reviewedResult(report);
      } catch (error) {
        return { ok: false, syntaxOk: false, error: errorText(error) };
      } finally {
        runtime.globals.set("__ai_source", "");
        runtime.globals.set("_student_source", "");
      }
    });
  } finally {
    runtime.globals.destroy();
  }
}

scope.onmessage = (event: MessageEvent<Request>) => {
  const data = event.data;
  if (data.type !== "check-code" || (data.language !== "lua" && data.language !== "python") ||
    (data.toolMode !== "magnet" && data.toolMode !== "fork") || typeof data.checkPoints !== "boolean" ||
    !Array.isArray(data.sources) || !Array.isArray(data.points)) return;
  const sources = data.sources.filter((source): source is string => typeof source === "string" && source.length <= 8_000);
  const points = data.points.filter((point): point is SavedPointDescriptor =>
    typeof point === "object" && point !== null && !Array.isArray(point) &&
    "name" in point && typeof point.name === "string" && point.name.length <= 80 &&
    "kind" in point && (point.kind === "cartesian" || point.kind === "joint"));
  if (sources.length !== data.sources.length || sources.length === 0 || sources.length > 8 ||
    points.length !== data.points.length || points.length > 100 || (!data.checkPoints && points.length > 0)) {
    scope.postMessage({ type: "code-review-results", results: [] });
    return;
  }
  void (data.language === "lua"
    ? checkLua(sources, points, data.checkPoints, data.toolMode)
    : checkPython(sources, points, data.checkPoints, data.toolMode))
    .then((results) => scope.postMessage({ type: "code-review-results", results }))
    .catch((error: unknown) => scope.postMessage({ type: "syntax-check-error", error: errorText(error) }));
};
