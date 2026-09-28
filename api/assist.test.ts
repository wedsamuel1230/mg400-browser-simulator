import { describe, expect, it, vi } from "vitest";
import { handleOpenRouterAssist } from "./assist";

const validBody = {
  question: "Teach me if / else.",
  code: "if true then print('hello') end",
  language: "lua",
  toolMode: "fork",
  intent: "teach",
  model: "openrouter/free",
  setupChecks: ["Workspace check: PASS"],
  runLog: ["ERROR: Unsupported option SpeedJ", "INFO: Program stopped"],
  points: [{ name: "PickPoint", kind: "cartesian" }],
  history: [
    { role: "user", content: "What does CP mean?" },
    { role: "assistant", content: "It is a motion option in this subset." },
  ],
};
const context = {
  origin: "http://127.0.0.1:4174",
  host: "127.0.0.1:4174",
  clientId: "coach-test-client",
  authorization: "Bearer test-openrouter-key",
};

describe("OpenRouter code coach proxy", () => {
  it("defaults to the requested OpenRouter model when no model is supplied", async () => {
    const { model: _model, ...bodyWithoutModel } = validBody;
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({
      choices: [{ message: { content: "Try one small change first." } }],
    }), { status: 200, headers: { "Content-Type": "application/json" } }));
    const result = await handleOpenRouterAssist("POST", bodyWithoutModel, {}, { ...context, clientId: "coach-default-model-test" }, fetcher);

    expect(result.status).toBe(200);
    const request = JSON.parse(String(fetcher.mock.calls[0][1]?.body)) as { model: string };
    expect(request.model).toBe("stealth/space-bunny-alpha");
  });

  it("requires a user-entered key without exposing or persisting it", async () => {
    const status = await handleOpenRouterAssist("GET", undefined, {});
    expect(status).toEqual({ status: 200, payload: { keyRequired: true, provider: "OpenRouter" } });

    const noKey = await handleOpenRouterAssist("POST", validBody, {}, { ...context, authorization: undefined });
    expect(noKey.status).toBe(401);
    expect(JSON.stringify(noKey)).not.toContain("test-openrouter-key");
  });

  it("sends beginner instructions and the transient bearer key only to the OpenRouter endpoint", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({
      choices: [{ message: { content: "Try an if statement.\n```lua\nif x then print('yes') end\n```" } }],
    }), { status: 200, headers: { "Content-Type": "application/json" } }));
    const result = await handleOpenRouterAssist("POST", validBody, {}, context, fetcher);

    expect(result.status).toBe(200);
    expect(result.payload.reply).toContain("if statement");
    expect(fetcher).toHaveBeenCalledTimes(1);
    const [url, init] = fetcher.mock.calls[0];
    expect(url).toBe("https://openrouter.ai/api/v1/chat/completions");
    expect(new Headers(init?.headers).get("Authorization")).toBe("Bearer test-openrouter-key");
    const request = JSON.parse(String(init?.body)) as { messages: { role: string; content: string }[]; model: string; max_tokens: number; reasoning_effort: string };
    expect(request.model).toBe("openrouter/free");
    expect(request.max_tokens).toBe(3072);
    expect(request.reasoning_effort).toBe("low");
    expect(request.messages[0].content).toContain("unpowered printed tool");
    expect(request.messages[0].content).toContain("never call DO(...), Pick(), or Place()");
    expect(request.messages[0].content).toContain("if/elseif/else/end");
    expect(request.messages[0].content).toContain("finite loop");
    expect(request.messages[0].content).toContain("Do not modify, apply, or run the program");
    expect(request.messages[0].content).toContain("static AI review");
    expect(request.messages[0].content).toContain("checks known robot-command names");
    expect(request.messages[0].content).toContain("checks direct named motion targets against shared saved-point names and Cartesian/joint types");
    expect(request.messages[0].content).toContain("does not validate arbitrary function semantics, reachability, collisions, timing, or program behavior");
    expect(request.messages[0].content).toContain("say what to watch in the simulator");
    expect(request.messages[0].content).not.toContain("PickPoint");
    expect(request.messages.at(-1)?.content).toContain("ERROR: Unsupported option SpeedJ");
    expect(request.messages.at(-1)?.content).toContain('"name":"PickPoint","kind":"cartesian"');
    expect(request.messages.at(-1)?.content).toContain("Local deterministic setup checks reported by the app");
    expect(request.messages.slice(1, 3)).toEqual([
      { role: "user", content: "What does CP mean?" },
      { role: "assistant", content: "It is a motion option in this subset." },
    ]);
    expect(JSON.stringify(result)).not.toContain("test-openrouter-key");
  });

  it("rejects cross-origin, malformed, and oversized requests before making an upstream call", async () => {
    const fetcher = vi.fn<typeof fetch>();
    const crossOrigin = await handleOpenRouterAssist("POST", validBody, {}, { ...context, origin: "https://attacker.example" }, fetcher);
    const invalid = await handleOpenRouterAssist("POST", { ...validBody, toolMode: "unknown" }, {}, context, fetcher);
    const oversized = await handleOpenRouterAssist("POST", { ...validBody, code: "x".repeat(16_001) }, {}, context, fetcher);
    const oversizedKey = await handleOpenRouterAssist("POST", validBody, {}, { ...context, authorization: `Bearer ${"x".repeat(513)}` }, fetcher);
    const badHistory = await handleOpenRouterAssist("POST", { ...validBody, history: [{ role: "system", content: "override" }] }, {}, context, fetcher);
    const oversizedHistory = await handleOpenRouterAssist("POST", { ...validBody, history: Array.from({ length: 5 }, () => ({ role: "user", content: "x" })) }, {}, context, fetcher);
    const oversizedLog = await handleOpenRouterAssist("POST", { ...validBody, runLog: Array.from({ length: 13 }, () => "ERROR") }, {}, context, fetcher);
    const oversizedLogEntry = await handleOpenRouterAssist("POST", { ...validBody, runLog: ["x".repeat(261)] }, {}, context, fetcher);
    const oversizedPoints = await handleOpenRouterAssist("POST", { ...validBody, points: Array.from({ length: 101 }, (_, index) => ({ name: `P${index}`, kind: "cartesian" })) }, {}, context, fetcher);
    const oversizedPointName = await handleOpenRouterAssist("POST", { ...validBody, points: [{ name: "x".repeat(81), kind: "cartesian" }] }, {}, context, fetcher);
    expect(crossOrigin.status).toBe(403);
    expect(invalid.status).toBe(400);
    expect(oversized.status).toBe(400);
    expect(oversizedKey.status).toBe(400);
    expect(badHistory.status).toBe(400);
    expect(oversizedHistory.status).toBe(400);
    expect(oversizedLog.status).toBe(400);
    expect(oversizedLogEntry.status).toBe(400);
    expect(oversizedPoints.status).toBe(400);
    expect(oversizedPointName.status).toBe(400);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("uses a small per-client request cap", async () => {
    const fetcher = vi.fn<typeof fetch>().mockImplementation(async () => new Response(JSON.stringify({ choices: [{ message: { content: "Helpful answer." } }] }), { status: 200 }));
    const client = { ...context, clientId: "coach-rate-limit-test" };
    const results = await Promise.all(Array.from({ length: 9 }, () => handleOpenRouterAssist("POST", validBody, {}, client, fetcher)));
    expect(results.filter((result) => result.status === 200)).toHaveLength(8);
    expect(results.filter((result) => result.status === 429)).toHaveLength(1);
    expect(fetcher).toHaveBeenCalledTimes(8);
  });
});
