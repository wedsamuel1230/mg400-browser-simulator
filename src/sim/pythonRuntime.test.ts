import { afterEach, expect, it, vi } from "vitest";
import { PythonRuntime } from "./pythonRuntime";
const workers: FakeWorker[] = [];
class FakeWorker {
  onmessage?: (event: MessageEvent) => void;
  onerror?: (event: ErrorEvent) => void;
  postMessage = vi.fn();
  terminate = vi.fn();
  constructor() { workers.push(this); }
}
afterEach(() => { vi.unstubAllGlobals(); workers.length = 0; });
it("Stop terminates the worker even if student code is stuck, and a new run starts fresh", () => {
  vi.stubGlobal("Worker", FakeWorker);
  const runtime = new PythonRuntime();
  const callbacks = { onMessage: vi.fn(), onError: vi.fn() };
  runtime.run("def task():\n    while True: pass\ntask()", [], callbacks);
  runtime.motionFailed(5, "nested motion failed");
  expect(workers[0].postMessage).toHaveBeenLastCalledWith({ type: "motion-failed", commandId: 5, message: "nested motion failed" });
  runtime.stop();
  expect(workers[0].terminate).toHaveBeenCalledOnce();
  runtime.run("print('fresh')", [], callbacks);
  expect(workers).toHaveLength(2);
  expect(workers[1].postMessage).toHaveBeenCalledWith({ type: "run", script: "print('fresh')", points: [] });
});
