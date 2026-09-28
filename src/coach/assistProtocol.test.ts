import { describe, expect, it } from "vitest";
import {
  buildChatCompletionRequest,
  DEFAULT_CHAT_COMPLETIONS_ENDPOINT,
  DEFAULT_CHAT_COMPLETIONS_MODEL,
  readChatCompletionReply,
  validateChatCompletionsEndpoint,
} from "./assistProtocol";

describe("OpenAI-compatible coach protocol", () => {
  it("defaults to the requested OpenRouter model", () => {
    expect(DEFAULT_CHAT_COMPLETIONS_MODEL).toBe("stealth/space-bunny-alpha");
  });

  it("accepts a provider's full HTTPS Chat Completions URL and the local development exception", () => {
    expect(validateChatCompletionsEndpoint(DEFAULT_CHAT_COMPLETIONS_ENDPOINT)).toEqual({
      ok: true,
      value: DEFAULT_CHAT_COMPLETIONS_ENDPOINT,
    });
    expect(validateChatCompletionsEndpoint("https://api.openai.com/v1/chat/completions/")).toEqual({
      ok: true,
      value: "https://api.openai.com/v1/chat/completions",
    });
    expect(validateChatCompletionsEndpoint("http://localhost:1234/v1/chat/completions")).toEqual({
      ok: true,
      value: "http://localhost:1234/v1/chat/completions",
    });
  });

  it.each([
    ["remote HTTP", "http://api.example.com/v1/chat/completions"],
    ["credentials in URL", "https://user:pass@api.example.com/v1/chat/completions"],
    ["query parameters", "https://api.example.com/v1/chat/completions?key=secret"],
    ["wrong endpoint path", "https://api.example.com/v1/responses"],
    ["non-HTTP scheme", "file:///v1/chat/completions"],
  ])("rejects %s before fetch", (_reason, endpoint) => {
    expect(validateChatCompletionsEndpoint(endpoint).ok).toBe(false);
  });

  it("builds bounded, read-only coaching messages for the selected language and tool mode", () => {
    const request = buildChatCompletionRequest({
      question: "Teach me loops",
      code: "for i = 1, 3 do print(i) end",
      language: "lua",
      toolMode: "fork",
      intent: "teach",
      model: "school/robot-tutor",
      endpoint: DEFAULT_CHAT_COMPLETIONS_ENDPOINT,
      setupChecks: [],
      runLog: [],
      points: [],
      history: [],
    });
    expect(request).toMatchObject({ model: "school/robot-tutor", max_tokens: 3072, reasoning_effort: "low", temperature: 0.25, stream: false });
    expect(request.messages[0].content).toContain("finite loop");
    expect(request.messages[0].content).toContain("hint-first scaffolding");
    expect(request.messages[0].content).toContain("Do not invent expected-output transcripts");
    expect(request.messages[0].content).toContain("does not execute it");
    expect(request.messages[0].content).toContain("Do not replace the learner's whole program unless they explicitly request a full solution");
    expect(request.messages[0].content).toContain("read-only educational coding agent");
    expect(request.messages[0].content).toContain("never call DO(...), Pick(), or Place()");
    expect(request.messages[0].content).toContain("never quoted point-name strings");
    expect(request.messages[0].content).toContain("Motion option keys are case-sensitive");
    expect(request.messages[0].content).toContain("The path-blending option is separate (Lua: CP=0; this simulator's Python: cp=0) and is not the TCP location");
    expect(request.messages[0].content).toContain("do not invent a runnable robot-motion script");
    expect(request.messages[0].content).toContain("checks common inline Lua motion point/option/RelMovL offset shapes");
    expect(request.messages[0].content).toContain("does not verify values hidden behind local variables, the fork's approach/under/lift/lower motion order");
    expect(request.messages[0].content).toContain("must never change, insert, apply, or run the learner's program");
    expect(request.messages.at(-1)?.content).toContain("Teach me loops");
    expect(request.messages.at(-1)?.content).toContain("No run log was supplied.");
  });

  it("omits OpenRouter-only reasoning settings for other compatible endpoints and lookalike hosts", () => {
    const baseInput = {
      question: "Explain a loop",
      code: "",
      language: "lua" as const,
      toolMode: "magnet" as const,
      intent: "teach" as const,
      model: "provider/model",
      setupChecks: [],
      runLog: [],
      points: [],
      history: [],
    };
    expect(buildChatCompletionRequest({ ...baseInput, endpoint: "https://api.openai.com/v1/chat/completions" })).not.toHaveProperty("reasoning_effort");
    expect(buildChatCompletionRequest({ ...baseInput, endpoint: "https://openrouter.ai.evil.example/v1/chat/completions" })).not.toHaveProperty("reasoning_effort");
    expect(buildChatCompletionRequest({ ...baseInput, endpoint: "https://relay.openrouter.ai/v1/chat/completions" })).toHaveProperty("reasoning_effort", "low");
  });

  it("passes opt-in deterministic source findings as static evidence, never as execution", () => {
    const request = buildChatCompletionRequest({
      question: "Why does this fork example fail?",
      code: "DO(1, ON)\nMovL(PickPoint)",
      language: "lua",
      toolMode: "fork",
      intent: "review",
      model: "school/robot-tutor",
      endpoint: DEFAULT_CHAT_COMPLETIONS_ENDPOINT,
      setupChecks: [],
      runLog: [],
      points: [],
      history: [],
      programReview: {
        status: "checked",
        language: "lua",
        syntaxOk: true,
        findings: [{ kind: "passive-fork-action", line: 1, message: "The passive fork cannot use DO." }],
        robotCallCount: 2,
        pointTargetCount: 1,
        unresolvedLocalTargetCount: 1,
        pointsStatus: "checked",
      },
    });
    const system = request.messages[0].content;
    const learner = request.messages.at(-1)?.content ?? "";
    expect(system).toContain("deterministic local static review");
    expect(system).toContain("not program execution");
    expect(learner).toContain("Local static review of the shared learner program");
    expect(learner).toContain('"kind":"passive-fork-action"');
    expect(learner).toContain("not execution");
  });

  it("reads standard string and text-block completion responses without accepting malformed payloads", () => {
    expect(readChatCompletionReply({ choices: [{ message: { content: "Helpful explanation." } }] })).toBe("Helpful explanation.");
    expect(readChatCompletionReply({ choices: [{ message: { content: [{ type: "text", text: "First " }, { type: "text", text: "part." }] } }] })).toBe("First part.");
    expect(readChatCompletionReply({ choices: [] })).toBeUndefined();
    expect(readChatCompletionReply({ choices: [{ message: { content: null } }] })).toBeUndefined();
  });
});
