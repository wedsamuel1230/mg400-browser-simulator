import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CodeAssistant } from "./CodeAssistant";
import type { TeachPoint } from "./domain";
import { DEFAULT_CHAT_COMPLETIONS_ENDPOINT, DEFAULT_CHAT_COMPLETIONS_MODEL } from "./coach/assistProtocol";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  localStorage.clear();
});

const setupChecks = [{ title: "Workspace", status: "pass" as const, detail: "Saved points are reachable." }];
const savedPoints: TeachPoint[] = [{ id: "pick", name: "PickPoint", kind: "cartesian", pose: { x: 250, y: -80, z: 20, r: 0 } }];
const completion = (content: string) => ({ choices: [{ message: { content } }] });

type WorkerRequest = {
  type: string;
  language: string;
  sources: string[];
  points: Array<{ name: string; kind: string }>;
  checkPoints: boolean;
  toolMode: string;
};

function stubSyntaxWorker(
  ok = true,
  requests?: WorkerRequest[],
  findings: Array<{ kind?: string; line: number; message: string }> = [],
  pointTargetCount = 0,
) {
  class MockSyntaxWorker {
    onmessage: ((event: MessageEvent) => void) | null = null;
    onerror: (() => void) | null = null;
    postMessage(message: WorkerRequest) {
      requests?.push(message);
      queueMicrotask(() => this.onmessage?.({ data: {
        type: "code-review-results",
        results: message.sources.map(() => ({
          ok: ok && findings.length === 0,
          syntaxOk: ok,
          error: ok ? undefined : "unexpected symbol near 'end'",
          findings,
          robotCallCount: pointTargetCount > 0 ? 1 : 0,
          pointTargetCount,
          unresolvedLocalTargetCount: pointTargetCount,
        })),
      } } as MessageEvent));
    }
    terminate() {}
  }
  vi.stubGlobal("Worker", MockSyntaxWorker);
}

describe("AI coding coach", () => {
  it("defaults to the requested model while leaving the provider key blank", () => {
    render(<CodeAssistant uiLanguage="en" code="" savedPoints={[]} language="lua" toolMode="magnet" setupReady setupChecks={[]} recentRunLog={[]} hasCurrentRun={false} />);
    fireEvent.click(screen.getByText("Connect AI for custom help"));

    expect(screen.getByLabelText("Model ID at this provider")).toHaveValue("stealth/space-bunny-alpha");
    expect(screen.getByLabelText("Your provider API key")).toHaveValue("");
    expect(screen.getByText(/third-party provider may retain prompts and replies/i)).toBeVisible();
  });

  it("labels the feature as a read-only coach and withholds executable inline snippets", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => completion("Try `MovL(PickPoint)` to move to the block, then check the simulation."),
    });
    vi.stubGlobal("fetch", fetchMock);
    render(<CodeAssistant uiLanguage="en" code="" savedPoints={[]} language="lua" toolMode="magnet" setupReady setupChecks={[]} recentRunLog={[]} hasCurrentRun={false} />);

    expect(screen.getByText("AI coding coach · read-only")).toBeVisible();
    expect(screen.getByText(/gives a hint first, checks code examples locally, and never edits or runs your program/i)).toBeVisible();
    fireEvent.click(screen.getByText("Connect AI for custom help"));
    fireEvent.change(screen.getByLabelText("Your provider API key"), { target: { value: "temporary-key" } });
    fireEvent.change(screen.getByLabelText("What would you like help with?"), { target: { value: "How do I move to the block?" } });
    fireEvent.click(screen.getByRole("button", { name: "Ask the coach" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/code outside a checked code block.*complete lua\/python example in a fenced code block/i);
    expect(screen.queryByText("MovL(PickPoint)")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Copy code example" })).not.toBeInTheDocument();
  });

  it("allows inline Lua operator and keyword explanations that are not executable examples", async () => {
    const reply = "In Lua, `==` tests equality and `~=` means not equal. An `if` statement chooses a branch. If you do, the loop will run again.";
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => completion(reply) });
    vi.stubGlobal("fetch", fetchMock);
    render(<CodeAssistant uiLanguage="en" code="" savedPoints={[]} language="lua" toolMode="magnet" setupReady setupChecks={[]} recentRunLog={[]} hasCurrentRun={false} />);
    fireEvent.click(screen.getByText("Connect AI for custom help"));
    fireEvent.change(screen.getByLabelText("Your provider API key"), { target: { value: "temporary-key" } });
    fireEvent.change(screen.getByLabelText("What would you like help with?"), { target: { value: "What do these Lua operators mean?" } });
    fireEvent.click(screen.getByRole("button", { name: "Ask the coach" }));

    expect(await screen.findByText(reply)).toBeVisible();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("allows safe inline print and display-only text while checking the complete fenced Lua example", async () => {
    const reply = "The `print(...)` function displays a value.\nTry this finite loop:\n```lua\nfor count = 1, 3 do\n  print(count)\nend\n```\nExpected output:\n```text\n1\n2\n3\n```";
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => completion(reply) });
    vi.stubGlobal("fetch", fetchMock);
    const workerRequests: WorkerRequest[] = [];
    stubSyntaxWorker(true, workerRequests);
    const { container } = render(<CodeAssistant uiLanguage="en" code="" savedPoints={[]} language="lua" toolMode="magnet" setupReady setupChecks={[]} recentRunLog={[]} hasCurrentRun={false} />);
    fireEvent.click(screen.getByText("Connect AI for custom help"));
    fireEvent.change(screen.getByLabelText("Your provider API key"), { target: { value: "temporary-key" } });
    fireEvent.change(screen.getByLabelText("What would you like help with?"), { target: { value: "Explain a Lua for loop" } });
    fireEvent.click(screen.getByRole("button", { name: "Ask the coach" }));

    expect(await screen.findByRole("list", { name: "Code example check results" })).toHaveTextContent("SyntaxOK · Lua");
    expect(screen.getByText(/The `print\(\.\.\.\)` function displays a value\./)).toBeVisible();
    const renderedBlocks = container.querySelectorAll(".ai-reply-code code");
    expect(renderedBlocks).toHaveLength(2);
    expect(renderedBlocks[0]).toHaveTextContent("for count = 1, 3 do");
    expect(renderedBlocks[1]).toHaveTextContent("1 2 3");
    expect(container.querySelectorAll(".ai-reply-code span")[1]).toHaveTextContent("text · not run");
    expect(workerRequests.flatMap((request) => request.sources)).toEqual(["for count = 1, 3 do\n  print(count)\nend"]);
    expect(screen.getByRole("region", { name: "Next step" })).toHaveTextContent(/compare the Run output and any simulator changes/i);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("allows natural language lead-ins followed by a fenced, locally checked example", async () => {
    const reply = "If you do, then the loop will run again.\nIf you are new to Lua:\nFor example, in Lua:\n```lua\nif ready then print('go') end\n```";
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => completion(reply) });
    vi.stubGlobal("fetch", fetchMock);
    stubSyntaxWorker();
    render(<CodeAssistant uiLanguage="en" code="" savedPoints={[]} language="lua" toolMode="fork" setupReady setupChecks={[]} recentRunLog={[]} hasCurrentRun={false} />);
    fireEvent.click(screen.getByText("Connect AI for custom help"));
    fireEvent.change(screen.getByLabelText("Your provider API key"), { target: { value: "temporary-key" } });
    fireEvent.change(screen.getByLabelText("What would you like help with?"), { target: { value: "Show an if example" } });
    fireEvent.click(screen.getByRole("button", { name: "Ask the coach" }));

    expect(await screen.findByRole("list", { name: "Code example check results" })).toHaveTextContent("SyntaxOK · Lua");
    expect(screen.getByRole("list", { name: "Code example check results" })).toHaveTextContent("Fork motion orderapproach/slide/lift/lower sequence not checked");
    expect(screen.getByText(/If you do, then the loop will run again/)).toBeVisible();
    expect(screen.getByText("if ready then print('go') end")).toBeVisible();
  });

  it("withholds executable code lines even when the provider omits backticks and fences", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => completion("Move to the saved target:\nMovL(PickPoint)"),
    });
    vi.stubGlobal("fetch", fetchMock);
    render(<CodeAssistant uiLanguage="en" code="" savedPoints={[]} language="lua" toolMode="magnet" setupReady setupChecks={[]} recentRunLog={[]} hasCurrentRun={false} />);
    fireEvent.click(screen.getByText("Connect AI for custom help"));
    fireEvent.change(screen.getByLabelText("Your provider API key"), { target: { value: "temporary-key" } });
    fireEvent.change(screen.getByLabelText("What would you like help with?"), { target: { value: "How do I move to a point?" } });
    fireEvent.click(screen.getByRole("button", { name: "Ask the coach" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/code outside a checked code block/i);
    expect(screen.queryByText("MovL(PickPoint)")).not.toBeInTheDocument();
  });

  it("sends only opted-in project context directly to the selected provider and never writes the key to storage", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => completion("Try this small pattern:\n```lua\nif ready then print('go') end\n```"),
    });
    vi.stubGlobal("fetch", fetchMock);
    render(<CodeAssistant uiLanguage="en" code="MovL(PickPoint)" savedPoints={savedPoints} language="lua" toolMode="fork" setupReady setupChecks={setupChecks} recentRunLog={["ERROR: Unsupported option SpeedJ"]} hasCurrentRun />);

    const shareCode = screen.getByRole("checkbox", { name: /share current lua program/i });
    expect(shareCode).not.toBeChecked();
    expect(screen.getByText(/your program, saved point names, setup checks, and run log stay on this device/i)).toBeVisible();
    stubSyntaxWorker();
    fireEvent.click(screen.getByText("Connect AI for custom help"));
    fireEvent.change(screen.getByLabelText("Your provider API key"), { target: { value: "sk-or-test-only" } });
    fireEvent.change(screen.getByLabelText("What would you like help with?"), { target: { value: "Why is this not working?" } });
    expect(screen.getByRole("button", { name: "Review my code" })).toBeDisabled();
    fireEvent.click(shareCode);
    fireEvent.click(screen.getByRole("button", { name: "Ask the coach" }));

    await screen.findByText(/Try this small pattern/);
    expect(screen.getByText("if ready then print('go') end")).toBeVisible();
    const checkList = screen.getByRole("list", { name: "Code example check results" });
    expect(checkList).toHaveTextContent("SyntaxOK · Lua");
    expect(checkList).toHaveTextContent("Robot API namesno robot commands to check");
    expect(checkList).toHaveTextContent("Reachabilitynot checked");
    expect(checkList).toHaveTextContent("Simulator runnot run");
    expect(screen.getByRole("region", { name: "Next step" })).toHaveTextContent(/copy the example into the editor.*review the setup warnings.*run it yourself.*compare the Run output and any simulator changes/i);
    const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(DEFAULT_CHAT_COMPLETIONS_ENDPOINT);
    expect(new Headers(options.headers).get("Authorization")).toBe("Bearer sk-or-test-only");
    expect(options).toMatchObject({ credentials: "omit", cache: "no-store", redirect: "error", referrerPolicy: "no-referrer" });
    const body = JSON.parse(String(options.body)) as { model: string; messages: Array<{ role: string; content: string }> };
    expect(body.model).toBe(DEFAULT_CHAT_COMPLETIONS_MODEL);
    const learnerMessage = body.messages.at(-1)?.content ?? "";
    expect(learnerMessage).toContain("MovL(PickPoint)");
    expect(learnerMessage).toContain('"name":"PickPoint","kind":"cartesian"');
    expect(learnerMessage).toContain("Workspace: PASS — Saved points are reachable.");
    expect(learnerMessage).toContain("ERROR: Unsupported option SpeedJ");
    expect(JSON.stringify(body)).not.toContain("sk-or-test-only");
    expect(localStorage.length).toBe(0);
    expect(screen.queryByRole("button", { name: /apply/i })).not.toBeInTheDocument();

    fireEvent.click(shareCode);
    fireEvent.change(screen.getByLabelText("What would you like help with?"), { target: { value: "What should I try next?" } });
    fireEvent.click(screen.getByRole("button", { name: "Ask the coach" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    const followUp = JSON.parse(String(fetchMock.mock.calls[1][1].body)) as { messages: Array<{ role: string; content: string }> };
    expect(followUp.messages).toHaveLength(2);
    expect(followUp.messages.at(-1)?.content).toContain("No program was shared.");
    expect(followUp.messages.at(-1)?.content).not.toContain("MovL(PickPoint)");
    expect(followUp.messages.at(-1)?.content).not.toContain("Unsupported option SpeedJ");
  });

  it("supports a user-selected OpenAI-compatible URL and model without sending the key in the body", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => completion("Use a finite loop first.") });
    vi.stubGlobal("fetch", fetchMock);
    render(<CodeAssistant uiLanguage="en" code="" savedPoints={[]} language="lua" toolMode="magnet" setupReady setupChecks={[]} recentRunLog={[]} hasCurrentRun={false} />);
    fireEvent.click(screen.getByText("Connect AI for custom help"));
    fireEvent.change(screen.getByLabelText("Your provider API key"), { target: { value: "private-provider-key" } });
    fireEvent.change(screen.getByLabelText("OpenAI-compatible Chat Completions URL"), { target: { value: "https://api.example.test/v1/chat/completions" } });
    fireEvent.change(screen.getByLabelText("Model ID at this provider"), { target: { value: "school/robot-tutor" } });
    fireEvent.change(screen.getByLabelText("What would you like help with?"), { target: { value: "Teach me a Lua loop" } });
    fireEvent.click(screen.getByRole("button", { name: "Ask the coach" }));

    await screen.findByText("Use a finite loop first.");
    const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.example.test/v1/chat/completions");
    expect(new Headers(options.headers).get("Authorization")).toBe("Bearer private-provider-key");
    const body = JSON.parse(String(options.body)) as { model: string; reasoning_effort?: string; messages: Array<{ role: string; content: string }> };
    expect(body.model).toBe("school/robot-tutor");
    expect(body).not.toHaveProperty("reasoning_effort");
    expect(body.messages.at(-1)?.content).toContain("Teach me a Lua loop");
    expect(screen.queryByText(/third-party provider may retain prompts and replies/i)).not.toBeInTheDocument();
    expect(String(options.body)).not.toContain("private-provider-key");
    expect(localStorage.length).toBe(0);
  });

  it("checks an opted-in learner program before provider fetch and labels findings as static, separate from suggested code", async () => {
    const order: string[] = [];
    const fetchMock = vi.fn().mockImplementation(async () => {
      order.push("provider-request");
      return { ok: true, status: 200, json: async () => completion("Use this only after you review it:\n```lua\nprint('safe example')\n```") };
    });
    vi.stubGlobal("fetch", fetchMock);
    class OrderedSyntaxWorker {
      onmessage: ((event: MessageEvent) => void) | null = null;
      onerror: (() => void) | null = null;
      postMessage(message: WorkerRequest) {
        order.push("local-static-check");
        const isLearnerProgram = message.sources[0]?.includes("DO(1, ON)");
        const result = isLearnerProgram
          ? {
              ok: false,
              syntaxOk: true,
              findings: [{ kind: "passive-fork-action", line: 1, message: "The unpowered fork cannot use DO." }],
              robotCallCount: 2,
              pointTargetCount: 1,
              unresolvedLocalTargetCount: 0,
              pointsStatus: "checked",
            }
          : { ok: true, syntaxOk: true, findings: [], robotCallCount: 0, pointTargetCount: 0, unresolvedLocalTargetCount: 0, pointsStatus: "no-targets" };
        queueMicrotask(() => this.onmessage?.({ data: { type: "code-review-results", results: [result] } } as MessageEvent));
      }
      terminate() {}
    }
    vi.stubGlobal("Worker", OrderedSyntaxWorker);
    render(<CodeAssistant uiLanguage="en" code="DO(1, ON)\nMovL(PickPoint)" savedPoints={savedPoints} language="lua" toolMode="fork" setupReady setupChecks={setupChecks} recentRunLog={[]} hasCurrentRun={false} />);

    fireEvent.click(screen.getByText("Connect AI for custom help"));
    fireEvent.change(screen.getByLabelText("Your provider API key"), { target: { value: "temporary-key" } });
    fireEvent.click(screen.getByRole("checkbox", { name: /share current lua program/i }));
    fireEvent.change(screen.getByLabelText("What would you like help with?"), { target: { value: "Can I use this with the passive fork?" } });
    fireEvent.click(screen.getByRole("button", { name: "Ask the coach" }));

    const programChecks = await screen.findByRole("list", { name: "Shared program check results" });
    expect(order.slice(0, 2)).toEqual(["local-static-check", "provider-request"]);
    expect(programChecks).toHaveTextContent("Passive forkpowered pickup/release command found");
    expect(screen.getByRole("region", { name: "Your shared program · local static checks" })).toHaveTextContent(/code not run/i);
    expect(screen.getByText("Line 1: The unpowered fork cannot use DO.")).toBeVisible();
    expect(await screen.findByRole("list", { name: "Code example check results" })).toHaveTextContent("SyntaxOK · Lua");
    expect(screen.queryByRole("button", { name: /apply/i })).not.toBeInTheDocument();

    const body = JSON.parse(String(fetchMock.mock.calls[0][1].body)) as { messages: Array<{ role: string; content: string }> };
    const userContext = body.messages.at(-1)?.content ?? "";
    expect(userContext).toContain('"status":"checked"');
    expect(userContext).toContain('"kind":"passive-fork-action"');
    expect(userContext).toContain("Local static review of the shared learner program");
    expect(userContext).toContain("The unpowered fork cannot use DO");
  });

  it("blocks an insecure non-local endpoint before sending the key", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    render(<CodeAssistant uiLanguage="en" code="" savedPoints={[]} language="lua" toolMode="magnet" setupReady setupChecks={[]} recentRunLog={[]} hasCurrentRun={false} />);
    fireEvent.click(screen.getByText("Connect AI for custom help"));
    fireEvent.change(screen.getByLabelText("Your provider API key"), { target: { value: "private-provider-key" } });
    fireEvent.change(screen.getByLabelText("OpenAI-compatible Chat Completions URL"), { target: { value: "http://provider.example.test/v1/chat/completions" } });
    fireEvent.change(screen.getByLabelText("What would you like help with?"), { target: { value: "Explain if" } });

    expect(screen.getByText(/Use HTTPS for remote providers/)).toBeVisible();
    expect(screen.getByRole("button", { name: "Ask the coach" })).toBeDisabled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("clears the old conversation when the endpoint changes", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => completion("Provider one reply.") });
    vi.stubGlobal("fetch", fetchMock);
    render(<CodeAssistant uiLanguage="en" code="" savedPoints={[]} language="lua" toolMode="magnet" setupReady setupChecks={[]} recentRunLog={[]} hasCurrentRun={false} />);
    fireEvent.click(screen.getByText("Connect AI for custom help"));
    fireEvent.change(screen.getByLabelText("Your provider API key"), { target: { value: "temporary-key" } });
    fireEvent.change(screen.getByLabelText("What would you like help with?"), { target: { value: "First provider-only question" } });
    fireEvent.click(screen.getByRole("button", { name: "Ask the coach" }));
    await screen.findByText("Provider one reply.");

    fireEvent.change(screen.getByLabelText("OpenAI-compatible Chat Completions URL"), { target: { value: "https://second.example.test/v1/chat/completions" } });
    expect(screen.queryByText("Provider one reply.")).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("What would you like help with?"), { target: { value: "New provider question" } });
    fireEvent.click(screen.getByRole("button", { name: "Ask the coach" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    const secondRequest = JSON.parse(String(fetchMock.mock.calls[1][1].body)) as { messages: Array<{ role: string; content: string }> };
    expect(secondRequest.messages).toHaveLength(2);
    expect(secondRequest.messages.at(-1)?.content).toContain("New provider question");
    expect(secondRequest.messages.at(-1)?.content).not.toContain("First provider-only question");
    expect(secondRequest.messages.at(-1)?.content).not.toContain("Provider one reply.");
  });

  it("explains CORS and possible provider billing when a direct browser request fails", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new TypeError("Failed to fetch"));
    vi.stubGlobal("fetch", fetchMock);
    render(<CodeAssistant uiLanguage="en" code="" savedPoints={[]} language="lua" toolMode="magnet" setupReady setupChecks={[]} recentRunLog={[]} hasCurrentRun={false} />);
    fireEvent.click(screen.getByText("Connect AI for custom help"));
    fireEvent.change(screen.getByLabelText("Your provider API key"), { target: { value: "temporary-key" } });
    fireEvent.change(screen.getByLabelText("What would you like help with?"), { target: { value: "Explain if" } });
    fireEvent.click(screen.getByRole("button", { name: "Ask the coach" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/CORS.*request may have reached the provider.*check its usage page/i);
  });

  it("supports general Lua syntax lessons without including the editor buffer", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => completion("An if statement chooses between branches.") });
    vi.stubGlobal("fetch", fetchMock);
    render(<CodeAssistant uiLanguage="en" code="local privateCode = true" savedPoints={savedPoints} language="lua" toolMode="magnet" setupReady setupChecks={setupChecks} recentRunLog={["ERROR: secret from printed output"]} hasCurrentRun={false} />);

    expect(screen.getByRole("checkbox", { name: /share current lua program/i })).not.toBeChecked();
    expect(screen.getByText(/your program, saved point names, setup checks, and run log stay on this device/i)).toBeVisible();
    fireEvent.click(screen.getByText("Connect AI for custom help"));
    fireEvent.change(screen.getByLabelText("Your provider API key"), { target: { value: "temporary-key" } });
    fireEvent.click(screen.getByRole("button", { name: "If / else" }));
    fireEvent.click(screen.getByRole("button", { name: "Ask the coach" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const body = JSON.parse(String(fetchMock.mock.calls[0][1].body)) as { messages: Array<{ role: string; content: string }> };
    expect(body.messages).toHaveLength(2);
    expect(body.messages.at(-1)?.content).toContain("No program was shared.");
    expect(body.messages.at(-1)?.content).not.toContain("privateCode");
    expect(body.messages.at(-1)?.content).not.toContain("secret from printed output");
    expect(body.messages.at(-1)?.content).toContain("No local program review was supplied.");
    expect(screen.getByRole("region", { name: "Next step" })).toHaveTextContent(/try one small idea from the explanation.*run it yourself.*compare the Run output and any simulator changes/i);

    expect(screen.getByText(/No code example to check · the coach did not run your program/)).toBeVisible();
    expect(body.messages.at(-1)?.content).toContain("Lua if / elseif / else / end");
    expect(body.messages[0].content).toContain("Assistance goal: teach");

    fireEvent.change(screen.getByLabelText("What would you like help with?"), { target: { value: "What does ~= mean?" } });
    fireEvent.click(screen.getByRole("button", { name: "Ask the coach" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    const followUp = JSON.parse(String(fetchMock.mock.calls[1][1].body)) as { messages: { role: string; content: string }[] };
    expect(followUp.messages.slice(1, -1)).toEqual([
      { role: "user", content: "Teach me Lua if / elseif / else / end with a tiny simulator-related example." },
      { role: "assistant", content: "An if statement chooses between branches." },
    ]);
  });

  it("opens the requested no-key syntax lesson directly", () => {
    const onOpenControlFlowLesson = vi.fn();
    render(<CodeAssistant uiLanguage="en" code="" savedPoints={[]} language="lua" toolMode="magnet" setupReady setupChecks={[]} recentRunLog={[]} hasCurrentRun={false} onOpenControlFlowLesson={onOpenControlFlowLesson} />);

    fireEvent.click(screen.getByRole("button", { name: "If / else" }));
    fireEvent.click(screen.getByRole("button", { name: "Loops" }));

    expect(onOpenControlFlowLesson.mock.calls).toEqual([["if-else"], ["loops"]]);
    expect(screen.getByRole("button", { name: "Ask the coach" })).toBeDisabled();
  });

  it("blocks unsafe DO, Pick, or Place calls in a passive-fork code example", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => completion("```lua\nDO(1, ON)\nPlace()\n```"),
    });
    vi.stubGlobal("fetch", fetchMock);
    stubSyntaxWorker(true, undefined, [{ kind: "passive-fork-action", line: 1, message: "The unpowered fork cannot use “DO”." }]);
    render(<CodeAssistant uiLanguage="en" code="" savedPoints={[]} language="lua" toolMode="fork" setupReady setupChecks={[]} recentRunLog={[]} hasCurrentRun={false} />);
    fireEvent.click(screen.getByText("Connect AI for custom help"));
    fireEvent.change(screen.getByLabelText("Your provider API key"), { target: { value: "temporary-key" } });
    fireEvent.change(screen.getByLabelText("What would you like help with?"), { target: { value: "Give me a pickup example" } });
    fireEvent.click(screen.getByRole("button", { name: "Ask the coach" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/blocked this reply/i);
    expect(screen.queryByText("DO(1, ON)")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Copy code example" })).not.toBeInTheDocument();
  });

  it("withholds a passive-fork example with quoted points, wrong option case, or incomplete RelMovL offsets", async () => {
    const reply = "```lua\nMovJ(\"PLACEHOLDER_APPROACH_BEFORE\", {cp=0})\nMovL(200, 0, 150, 0)\nRelMovL({z=10}, {cp=0})\n```";
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => completion(reply) });
    vi.stubGlobal("fetch", fetchMock);
    stubSyntaxWorker(true, undefined, [
      { kind: "invalid-motion-target", line: 1, message: "Motion commands need a saved point variable or point table, not a quoted name or raw numeric coordinate list." },
      { kind: "invalid-motion-option", line: 1, message: "Use the exact case-sensitive option name CP for this simulator command." },
      { kind: "invalid-motion-target", line: 2, message: "Motion commands need a saved point variable or point table, not a quoted name or raw numeric coordinate list." },
      { kind: "invalid-motion-option", line: 3, message: "Use the exact case-sensitive option name CP for this simulator command." },
      { kind: "invalid-relative-offset", line: 3, message: "RelMovL needs X, Y, and Z values in its offset table (or a positional X/Y/Z list); R is optional." },
    ]);
    render(<CodeAssistant uiLanguage="en" code="" savedPoints={[]} language="lua" toolMode="fork" setupReady setupChecks={[]} recentRunLog={[]} hasCurrentRun={false} />);
    fireEvent.click(screen.getByText("Connect AI for custom help"));
    fireEvent.change(screen.getByLabelText("Your provider API key"), { target: { value: "temporary-key" } });
    fireEvent.change(screen.getByLabelText("What would you like help with?"), { target: { value: "Show a passive fork pickup example" } });
    fireEvent.click(screen.getByRole("button", { name: "Ask the coach" }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(/raw numeric coordinate list/i);
    expect(alert).toHaveTextContent(/case-sensitive option name CP/i);
    expect(alert).toHaveTextContent(/needs X, Y, and Z values/i);
    expect(screen.queryByText(/PLACEHOLDER_APPROACH_BEFORE/)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Copy code example" })).not.toBeInTheDocument();
  });

  it("withholds a code example when a shared motion target is absent or its command is unsupported", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => completion("```lua\nMovR(PikPoint)\n```"),
    });
    const checked: WorkerRequest[] = [];
    vi.stubGlobal("fetch", fetchMock);
    stubSyntaxWorker(true, checked, [{ kind: "unsupported-api", line: 1, message: "“MovR” is unsupported." }, { kind: "missing-point", line: 1, message: "Motion target “PikPoint” was not found in the shared saved points." }]);
    render(<CodeAssistant uiLanguage="en" code="" savedPoints={savedPoints} language="lua" toolMode="magnet" setupReady setupChecks={[]} recentRunLog={[]} hasCurrentRun={false} />);
    fireEvent.click(screen.getByText("Connect AI for custom help"));
    fireEvent.change(screen.getByLabelText("Your provider API key"), { target: { value: "temporary-key" } });
    fireEvent.change(screen.getByLabelText("What would you like help with?"), { target: { value: "Show the move command" } });
    fireEvent.click(screen.getByRole("checkbox", { name: /share current lua program/i }));
    fireEvent.click(screen.getByRole("button", { name: "Ask the coach" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/MovR.*unsupported.*PikPoint/i);
    expect(screen.queryByText("MovR(PikPoint)")).not.toBeInTheDocument();
    expect(checked[0]).toMatchObject({
      points: [{ name: "PickPoint", kind: "cartesian" }],
      checkPoints: true,
      toolMode: "magnet",
    });
  });

  it("keeps saved point names out of the AI and local checker while project sharing is off", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => completion("```lua\nMovL(PickPoint, {CP=0})\n```"),
    });
    const checked: WorkerRequest[] = [];
    vi.stubGlobal("fetch", fetchMock);
    stubSyntaxWorker(true, checked, [], 1);
    render(<CodeAssistant uiLanguage="en" code="MovL(PickPoint)" savedPoints={savedPoints} language="lua" toolMode="magnet" setupReady setupChecks={setupChecks} recentRunLog={[]} hasCurrentRun={false} />);
    fireEvent.click(screen.getByText("Connect AI for custom help"));
    fireEvent.change(screen.getByLabelText("Your provider API key"), { target: { value: "temporary-key" } });
    fireEvent.change(screen.getByLabelText("What would you like help with?"), { target: { value: "Show a small movement example" } });
    fireEvent.click(screen.getByRole("button", { name: "Ask the coach" }));

    const checkList = await screen.findByRole("list", { name: "Code example check results" });
    expect(checkList).toHaveTextContent("Saved point namesnot checked because project context sharing is off");
    expect(checkList).toHaveTextContent("Reachabilitynot checked");
    expect(checkList).toHaveTextContent("Simulator runnot run");
    expect(screen.getByRole("region", { name: "Next step" })).toHaveTextContent(/because project context sharing is off, check each named point in teach points.*run it yourself/i);
    expect(checked[0]).toMatchObject({ points: [], checkPoints: false });
    const body = JSON.parse(String(fetchMock.mock.calls[0][1].body)) as { messages: Array<{ role: string; content: string }> };
    expect(body.messages.at(-1)?.content).toContain('[]');
    expect(body.messages.at(-1)?.content).toContain("No program was shared.");
    expect(body.messages.at(-1)?.content).not.toContain("PickPoint");
  });

  it("holds back code examples that fail local syntax checking", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => completion("```lua\nif ready then\n  print('ready')\n```"),
    });
    vi.stubGlobal("fetch", fetchMock);
    stubSyntaxWorker(false);
    render(<CodeAssistant uiLanguage="en" code="" savedPoints={[]} language="lua" toolMode="magnet" setupReady setupChecks={[]} recentRunLog={[]} hasCurrentRun={false} />);
    fireEvent.click(screen.getByText("Connect AI for custom help"));
    fireEvent.change(screen.getByLabelText("Your provider API key"), { target: { value: "temporary-key" } });
    fireEvent.change(screen.getByLabelText("What would you like help with?"), { target: { value: "Give me a condition example" } });
    fireEvent.click(screen.getByRole("button", { name: "Ask the coach" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/syntax check failed/i);
    expect(screen.queryByText("print('ready')")).not.toBeInTheDocument();
  });

  it("syntax-checks each declared language instead of trusting the editor language", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => completion("```lua\nif ready then print('go') end\n```\n```python\nif ready:\n    print('go')\n```"),
    });
    const checked: WorkerRequest[] = [];
    vi.stubGlobal("fetch", fetchMock);
    stubSyntaxWorker(true, checked);
    render(<CodeAssistant uiLanguage="en" code="" savedPoints={[]} language="lua" toolMode="magnet" setupReady setupChecks={[]} recentRunLog={[]} hasCurrentRun={false} />);
    fireEvent.click(screen.getByText("Connect AI for custom help"));
    fireEvent.change(screen.getByLabelText("Your provider API key"), { target: { value: "temporary-key" } });
    fireEvent.change(screen.getByLabelText("What would you like help with?"), { target: { value: "Show both syntaxes" } });
    fireEvent.click(screen.getByRole("button", { name: "Ask the coach" }));

    expect(await screen.findByRole("list", { name: "Code example check results" })).toHaveTextContent("OK · Lua + Python");
    expect(checked).toEqual([
      { type: "check-code", language: "lua", sources: ["if ready then print('go') end"], points: [], checkPoints: false, toolMode: "magnet" },
      { type: "check-code", language: "python", sources: ["if ready:\n    print('go')"], points: [], checkPoints: false, toolMode: "magnet" },
    ]);
  });

  it("withholds unsupported code languages rather than displaying unchecked code", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => completion("```javascript\nalert('unchecked')\n```"),
    });
    vi.stubGlobal("fetch", fetchMock);
    render(<CodeAssistant uiLanguage="en" code="" savedPoints={[]} language="lua" toolMode="magnet" setupReady setupChecks={[]} recentRunLog={[]} hasCurrentRun={false} />);
    fireEvent.click(screen.getByText("Connect AI for custom help"));
    fireEvent.change(screen.getByLabelText("Your provider API key"), { target: { value: "temporary-key" } });
    fireEvent.change(screen.getByLabelText("What would you like help with?"), { target: { value: "Show code" } });
    fireEvent.click(screen.getByRole("button", { name: "Ask the coach" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/unsupported code language “javascript”/i);
    expect(screen.queryByText("alert('unchecked')")).not.toBeInTheDocument();
  });
});

it("defaults all coach controls/privacy and free function teaching to Traditional Chinese and switches to English", async () => {
  const props = { code: "", savedPoints: [], language: "python" as const, toolMode: "fork" as const, setupReady: true, setupChecks: [], recentRunLog: [], hasCurrentRun: false };
  const { rerender, container } = render(<CodeAssistant {...props} />);
  expect(screen.getByText("AI 程式教練 · 只提供建議")).toBeInTheDocument();
  expect(screen.getByText("函式與呼叫 · 免費導學")).toBeInTheDocument();
  expect(screen.getByText("私隱與建議檢查方式")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "詢問教練" })).toBeDisabled();
  expect(screen.getByPlaceholderText("描述預期結果、實際情況，或想學習的概念…")).toBeInTheDocument();
  expect(container.textContent).toContain("def task():");
  expect(container.textContent).toContain("selected_value()");
  expect(container.textContent).not.toContain("await mov_");
  expect(container.textContent).not.toContain("Your provider API key");
  rerender(<CodeAssistant {...props} uiLanguage="en" />);
  expect(screen.getByText("AI coding coach · read-only")).toBeInTheDocument();
  expect(screen.getByText("Functions and calls · free lesson")).toBeInTheDocument();
  expect(screen.getByPlaceholderText("Describe what you expect, what happened, or a concept you want to learn…")).toBeInTheDocument();
});

it("sends the selected Chinese language instruction without leaking the key into context and shows Chinese checks/errors", async () => {
  stubSyntaxWorker();
  const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => completion("請先試一個小改動。\n```python\ndef task():\n    print('測試')\ntask()\n```") });
  vi.stubGlobal("fetch", fetchMock);
  render(<CodeAssistant code="" savedPoints={[]} language="python" toolMode="magnet" setupReady setupChecks={[]} recentRunLog={[]} hasCurrentRun={false} />);
  fireEvent.change(screen.getByLabelText("供應商 API key"), { target: { value: "private-test-key" } });
  fireEvent.change(screen.getByLabelText("你想了解甚麼？"), { target: { value: "如何呼叫函式？" } });
  fireEvent.click(screen.getByRole("button", { name: "詢問教練" }));
  await waitFor(() => expect(screen.getByText("建議範例 · 本機靜態檢查")).toBeInTheDocument());
  expect(screen.getByText("未執行程式")).toBeInTheDocument();
  expect(screen.getByText("機械臂 API 名稱")).toBeInTheDocument();
  const body = JSON.parse(fetchMock.mock.calls[0][1].body);
  expect(body.messages[0].content).toContain("Traditional Chinese (繁體中文)");
  expect(body.messages[0].content).toContain("student code needs no await");
  expect(JSON.stringify(body)).not.toContain("private-test-key");
});
