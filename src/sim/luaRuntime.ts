import type { TeachPoint } from "../domain";
import type { LuaWorkerMessage } from "./luaTypes";

export type LuaRuntimeCallbacks = {
  onMessage: (message: LuaWorkerMessage) => void;
  onError: (message: string) => void;
};

export class LuaRuntime {
  private worker?: Worker;

  run(script: string, points: TeachPoint[], callbacks: LuaRuntimeCallbacks): void {
    this.stop();
    this.worker = new Worker(new URL("./lua.worker.ts", import.meta.url), { type: "module" });
    this.worker.onmessage = (event: MessageEvent<LuaWorkerMessage>) => callbacks.onMessage(event.data);
    this.worker.onerror = (event) => {
      event.preventDefault();
      callbacks.onError(event.message || "Lua worker failed.");
    };
    this.worker.postMessage({ type: "run", script, points });
  }

  reply(requestId: number, value: unknown): void {
    this.worker?.postMessage({ type: "rpc-response", requestId, value });
  }

  motionComplete(commandId: number): void {
    this.worker?.postMessage({ type: "motion-complete", commandId });
  }

  motionFailed(commandId: number, message: string): void {
    this.worker?.postMessage({ type: "motion-failed", commandId, message });
  }

  stop(): void {
    this.worker?.terminate();
    this.worker = undefined;
  }
}
