import { loadEnv } from "vite";
import { configDefaults, defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import { handleOpenRouterAssist, type AssistEnvironment, type AssistRequestContext } from "./api/assist.ts";

const monacoPackage = new URL("./node_modules/monaco-editor/esm/vs/editor/", import.meta.url);
const monacoApiPath = fileURLToPath(new URL("editor.api.js", monacoPackage));

type NodeRequest = {
  method?: string;
  headers: Record<string, string | string[] | undefined>;
  on: {
    (event: "data", listener: (chunk: Uint8Array | string) => void): void;
    (event: "end", listener: () => void): void;
    (event: "error", listener: (error: Error) => void): void;
  };
};
type NodeResponse = {
  statusCode: number;
  setHeader: (name: string, value: string) => void;
  end: (body?: string) => void;
};
type MiddlewareServer = {
  middlewares: { use: (path: string, handler: (request: NodeRequest, response: NodeResponse, next: () => void) => void) => void };
};

function requestContext(request: NodeRequest): AssistRequestContext {
  const first = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] : value;
  return {
    origin: first(request.headers.origin),
    host: first(request.headers.host),
    clientId: first(request.headers["x-forwarded-for"]),
    authorization: first(request.headers.authorization),
  };
}

function sendJson(response: NodeResponse, status: number, payload: Record<string, unknown>) {
  response.statusCode = status;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("Cache-Control", "no-store");
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.end(JSON.stringify(payload));
}

function parseRequestBody(request: NodeRequest): Promise<unknown> {
  return new Promise((resolve, reject) => {
    let raw = "";
    let size = 0;
    let settled = false;
    const decoder = new TextDecoder();
    request.on("data", (chunk) => {
      if (settled) return;
      const part = typeof chunk === "string" ? chunk : decoder.decode(chunk, { stream: true });
      size += typeof chunk === "string" ? new TextEncoder().encode(chunk).byteLength : chunk.byteLength;
      if (size > 32_000) {
        settled = true;
        reject(new Error("Request is too large."));
        return;
      }
      raw += part;
    });
    request.on("end", () => {
      if (settled) return;
      try {
        raw += decoder.decode();
        resolve(raw ? JSON.parse(raw) as unknown : undefined);
      } catch {
        reject(new Error("Request body must be valid JSON."));
      }
    });
    request.on("error", (error) => {
      if (settled) return;
      settled = true;
      reject(error);
    });
  });
}

function assistantApi(environment: AssistEnvironment) {
  return async (request: NodeRequest, response: NodeResponse, next: () => void) => {
    if (request.method === "POST") {
      const contentType = request.headers["content-type"];
      if (typeof contentType !== "string" || !contentType.toLowerCase().startsWith("application/json")) {
        sendJson(response, 415, { error: "Send code coach requests as JSON." });
        return;
      }
    }
    let body: unknown;
    try {
      if (request.method === "POST") body = await parseRequestBody(request);
    } catch (error) {
      sendJson(response, error instanceof Error && error.message === "Request is too large." ? 413 : 400, {
        error: error instanceof Error ? error.message : "Could not read the request.",
      });
      return;
    }
    const result = await handleOpenRouterAssist(request.method, body, environment, requestContext(request));
    if (result.status === 405 && request.method === undefined) {
      next();
      return;
    }
    sendJson(response, result.status, result.payload);
  };
}

export default defineConfig(({ mode }) => {
  const serverEnvironment = loadEnv(mode, ".", "OPENROUTER_MODEL");
  const assistantEnvironment = { model: serverEnvironment.OPENROUTER_MODEL };
  const assistantPlugin = {
    name: "mg400-openrouter-assistant-api",
    configureServer(server: MiddlewareServer) {
      server.middlewares.use("/api/assist", assistantApi(assistantEnvironment));
    },
    configurePreviewServer(server: MiddlewareServer) {
      server.middlewares.use("/api/assist", assistantApi(assistantEnvironment));
    },
  };

  return {
    plugins: [react(), assistantPlugin],
    resolve: {
      alias: [
        // Use the editor API entry directly instead of the package root, which
        // eagerly registers every Monaco language for this Lua/Python product.
        { find: /^monaco-editor$/, replacement: monacoApiPath },
      ],
    },
    worker: { format: "es" },
    test: {
      environment: "jsdom",
      setupFiles: ["./src/test/setup.ts"],
      clearMocks: true,
      exclude: [...configDefaults.exclude, "**/.scratch/**"],
    },
  };
});
