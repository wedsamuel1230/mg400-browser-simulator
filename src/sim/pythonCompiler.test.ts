import { beforeAll, afterAll, expect, it } from "vitest";
import { loadPyodide, type PyodideInterface } from "pyodide";
import { PYTHON_COMPILER, PYTHON_COMPILER_CHECK } from "./pythonCompiler";
let runtime: PyodideInterface;
beforeAll(async () => { runtime = await loadPyodide(); runtime.setStdout({ batched: () => {} }); }, 60000);
afterAll(() => runtime?.globals.destroy());
async function run(source: string, api = "") {
  await runtime.runPythonAsync(`events=[]\n${api}`);
  runtime.globals.set("_student_source", source);
  await runtime.runPythonAsync(PYTHON_COMPILER);
  return runtime.runPython("str(events)");
}
it("preserves pure functions, math, nested commands, return values, loops and menu selection", async () => {
  expect(await run(`import math\ndef pure(x):\n    return math.sqrt(x)\ndef move_task():\n    mov_l(pure(9))\n    return 7\ndef task():\n    for i in range(2):\n        if move_task() == 7:\n            print(i)\n        else:\n            raise ValueError('wrong return')\nfunctions=[task]\nselected_value=functions[0]\nselected_value()`, `async def mov_l(value):\n    events.append(value)`)).toBe("[3.0, 3.0]");
});
it("keeps explicit awaits valid", async () => {
  expect(await run("async def task():\n    await mov_l(1)\nawait task()", "async def mov_l(v): events.append(v)")).toBe("[1]");
});
it("runs interactively and waits before reading observed state or issuing another motion", async () => {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  const events: string[] = [];
  let started!: () => void;
  const motionStarted = new Promise<void>((resolve) => { started = resolve; });
  runtime.globals.set("motion_gate", () => { events.push("start"); started(); return gate; });
  runtime.globals.set("state_value", () => { events.push("state"); return 4; });
  const running = run("def task():\n    mov_l(1)\n    mov_l(get_pose())\ntask()", "async def mov_l(v):\n    await motion_gate()\n    events.append(v)\ndef get_pose(): return state_value()");
  await motionStarted;
  expect(events).toEqual(["start"]);
  release();
  expect(await running).toBe("[1, 4]");
  expect(events).toEqual(["start", "state", "start"]);
});
it("maps nested motion failures to student lines and stops later commands", async () => {
  await expect(run("def inner():\n    mov_l(1)\ndef outer():\n    inner()\n    events.append('later')\nouter()", "async def mov_l(v): raise RuntimeError('motion failed')")).rejects.toThrow(/student-program.*line 2/s);
  expect(runtime.runPython("str(events)")).toBe("[]");
});
it("bounds infinite nested loops", async () => {
  await expect(run("def inner():\n    while True:\n        pass\ndef task():\n    inner()\ntask()")).rejects.toThrow("100,000 loop-iteration limit");
});
it.each(["lambda: 1", "class Task: pass", "[f() for x in range(2)]", "def task():\n    yield 1"])("rejects unsupported construct %s clearly", async (source) => {
  await expect(run(source)).rejects.toThrow("Unsupported simulator Python");
});

it("accepts an empty program or assignments with no awaitable calls", async () => {
  expect(await run("x = 1")).toBe("[]");
  expect(await run("")).toBe("[]");
});

it("coach compilation checks the same subset without executing any student code", () => {
  runtime.runPython("events=[]");
  runtime.globals.set("_student_source", "def task():\n    mov_l(Home)\nevents.append('must not execute')\ntask()");
  runtime.runPython(PYTHON_COMPILER_CHECK);
  expect(runtime.runPython("str(events)")).toBe("[]");
  runtime.globals.set("_student_source", "class Task: pass");
  expect(() => runtime.runPython(PYTHON_COMPILER_CHECK)).toThrow("Unsupported simulator Python: classes");
});

it.each([
  "def tag(): return int\ndef task(x: tag()): return x",
  "def tag(): return int\ndef task() -> tag(): return 1",
  "def task(): raise StopIteration\ntry:\n    task()\nexcept StopIteration:\n    pass",
  "next(iter([1,2]))",
])("rejects annotation calls and iterator protocol with a student-facing explanation: %s", async (source) => {
  await expect(run(source)).rejects.toThrow("Unsupported simulator Python:");
});
