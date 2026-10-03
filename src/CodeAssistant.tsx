import { useMemo, useState } from "react";
import { BookOpen, CheckCircle2, Clipboard, LoaderCircle, ShieldCheck, Sparkles, Trash2 } from "lucide-react";
import type { ProgramLanguage, TeachPoint, ToolMode } from "./domain";
import {
  buildChatCompletionRequest,
  DEFAULT_CHAT_COMPLETIONS_ENDPOINT,
  DEFAULT_CHAT_COMPLETIONS_MODEL,
  isOpenRouterEndpoint,
  readChatCompletionReply,
  validateChatCompletionsEndpoint,
} from "./coach/assistProtocol";
import { localizeCoachTree, type CoachLanguage } from "./coach/coachLanguage";
import type { StaticProgramReview } from "./coach/assistProtocol";

type SetupCheck = { title: string; status: "pass" | "action" | "waiting" | "info"; detail: string };
type VerificationCheck = { label: string; value: string; status: "checked" | "partial" | "problem" | "not-checked" | "informational" };
type VerificationSummary = { title?: string; checks: VerificationCheck[]; findings?: Array<{ line: number; message: string }>; emptyMessage?: string };
type CoachMessage = { role: "user" | "assistant"; content: string; includedProjectContext: boolean; language: ProgramLanguage; toolMode: ToolMode; programVerification?: VerificationSummary; verification?: VerificationSummary };
type CodeAssistantProps = {
  uiLanguage?: CoachLanguage;
  code: string;
  savedPoints: TeachPoint[];
  language: ProgramLanguage;
  toolMode: ToolMode;
  setupReady: boolean;
  setupChecks: SetupCheck[];
  recentRunLog: string[];
  hasCurrentRun: boolean;
  onOpenControlFlowLesson?: (topic: "if-else" | "loops") => void;
};

const REVIEW_PROMPT = "Review this program as a beginner-friendly, read-only coding coach. Check the syntax, simulator API calls, motion order, and selected tool behavior. First state what the supplied local setup checks and recent simulator run log actually report; do not claim that you independently ran or verified the code. If the log contains an error, explain the first useful error and a learner-controlled next step. Then list likely issues and uncertainty with line numbers where possible. Be hint-first: suggest one small change for me to try before showing a short corrected example; do not replace my whole program unless I explicitly ask. Tell me how I can verify it myself in the simulator. Never edit, apply, or run my code.";
const EXPLAIN_PROMPT = "Walk me through this program line by line in beginner-friendly language. Explain the robot commands, variables, and order of operations. Point out one thing I can try changing and how to verify the effect in the simulator.";
const CODE_FENCE = /```([^\s`]+)?[\t ]*\r?\n?([\s\S]*?)```/gi;
const DISPLAY_ONLY_FENCE_LANGUAGES = new Set(["text", "plaintext", "output"]);
const SAFE_INLINE_PRINT_REFERENCE = /^print\(\s*(?:\.\.\.|[A-Za-z_]\w*|[-+]?\d+(?:\.\d+)?|'[^'\n]*'|"[^"\n]*")?\s*\)$/i;
type CodeExample = { source: string; language: ProgramLanguage };
type CodeCheckResult = {
  ok: boolean;
  syntaxOk: boolean;
  error?: string;
  findings?: Array<{ kind?: string; line: number; message: string }>;
  robotCallCount?: number;
  pointTargetCount?: number;
  unresolvedLocalTargetCount?: number;
  pointsStatus?: "checked" | "not-shared" | "local-targets" | "no-targets";
};

function collectCodeExamples(reply: string, defaultLanguage: ProgramLanguage): CodeExample[] {
  return [...reply.matchAll(CODE_FENCE)].flatMap((match) => {
    const tag = (match[1] ?? "").toLowerCase();
    if (DISPLAY_ONLY_FENCE_LANGUAGES.has(tag)) return [];
    const language = tag === "" ? defaultLanguage : tag === "lua" ? "lua" : tag === "python" || tag === "py" ? "python" : null;
    if (!language) throw new Error(`I held back this reply because it included unsupported code language “${tag}”. Ask for Lua or Python simulator code.`);
    return { source: match[2].trim(), language };
  }).filter(({ source }) => source.length > 0);
}

function rejectUnfencedExecutableCode(reply: string): void {
  const prose = reply.replace(CODE_FENCE, "\n");
  const inlineCode = /`([^`\n]+)`/g;
  const pythonCondition = String.raw`(?:if|elif|while)\s+(?:not\s+)?(?:[A-Za-z_]\w*|True|False|None)(?:\s*(?:==|!=|<=|>=|<|>)\s*(?:[A-Za-z_]\w*|\d+(?:\.\d+)?|True|False|None|'[^']*'|"[^"]*"))?(?:\s+(?:and|or)\s+(?:not\s+)?[A-Za-z_]\w*)*\s*:`;
  const looksExecutableSnippet = new RegExp(String.raw`\b[A-Za-z_]\w*\s*\([^)]*\)|\b[A-Za-z_]\w*\s*=(?!=)\s*\S+|\b(?:if|elseif)\s+.+?\bthen\b|\b(?:while|for)\s+.+?\bdo\b|\bfor\s+[A-Za-z_]\w*\s+in\s+.+?:|${pythonCondition}`, "i");
  for (const match of prose.matchAll(inlineCode)) {
    if (SAFE_INLINE_PRINT_REFERENCE.test(match[1].trim())) continue;
    if (looksExecutableSnippet.test(match[1])) {
      throw new Error("I held back this reply because it included code outside a checked code block. Ask the coach to put the complete Lua/Python example in a fenced code block so the browser can check it first.");
    }
  }
  const proseWithoutInlineCode = prose.replace(inlineCode, " ");
  const looksLikeUnformattedCallOrAssignment = /\b[A-Za-z_]\w*\s*\([^)]*\)|\b[A-Za-z_]\w*\s*=(?!=)\s*\S+/i;
  const looksLikeBareCodeLine = new RegExp(String.raw`^\s*(?:else\s*:?|end|(?:await\s+)?[A-Za-z_]\w*\s*\([^)]*\)|[A-Za-z_]\w*\s*=(?!=)\s*\S+|(?:if|elseif)\s+.+?\bthen\b|while\s+.+?\bdo\b|for\s+[A-Za-z_]\w*\s*=.+?\bdo\b|for\s+[A-Za-z_]\w*\s+in\s+.+?:|${pythonCondition})\s*(?:--.*|#.*)?$`, "i");
  if (looksLikeUnformattedCallOrAssignment.test(proseWithoutInlineCode) || proseWithoutInlineCode.split(/\r?\n/).some((line) => looksLikeBareCodeLine.test(line))) {
    throw new Error("I held back this reply because it included code outside a checked code block. Ask the coach to put the complete Lua/Python example in a fenced code block so the browser can check it first.");
  }
}

async function validateCodeExamples(
  examples: CodeExample[],
  savedPoints: TeachPoint[],
  sharePoints: boolean,
  toolMode: ToolMode,
): Promise<VerificationSummary> {
  if (examples.length === 0) return { title: "Suggested code", checks: [], emptyMessage: "No code example to check · the coach did not run your program" };
  if (examples.length > 8 || examples.some(({ source }) => source.length > 8_000)) {
    throw new Error("I could not check this large set of examples locally. Ask for one short Lua/Python example at a time.");
  }
  const languages = [...new Set(examples.map(({ language }) => language))];
  const allResults = await Promise.all(languages.map(async (language) => {
    const sources = examples.filter((example) => example.language === language).map(({ source }) => source);
    const results = await checkCodeLocally(language, sources, savedPoints, sharePoints, toolMode);
    const failed = results.find((result) => !result.syntaxOk || !result.ok);
    if (failed) {
      if (!failed.syntaxOk) {
        throw new Error("I held back the example because the local " + (language === "lua" ? "Lua" : "Python") +
          " syntax check failed" + (failed.error ? ": " + failed.error : ".") + " Ask for a corrected, smaller example.");
      }
      const findings = failed.findings ?? [];
      const details = findings.map((finding) => "Line " + finding.line + ": " + finding.message).join(" ");
      if (findings.some((finding) => finding.kind === "passive-fork-action")) {
        throw new Error("I blocked this reply because its code example used DO, Pick, or Place for the unpowered fork. " +
          "The fork must slide under the block and lift it; no powered output is used. " + details);
      }
      throw new Error("I held back this example because the local " + (language === "lua" ? "Lua" : "Python") +
        " review found a simulator API, saved-point, or tool-mode issue. " +
        (details || "Review the robot command and motion targets, then ask for a correction."));
    }
    return results;
  }));
  const results = allResults.flat();
  const robotCallCount = results.reduce((total, result) => total + (result.robotCallCount ?? 0), 0);
  const pointTargetCount = results.reduce((total, result) => total + (result.pointTargetCount ?? 0), 0);
  const localTargetCount = results.reduce((total, result) => total + (result.unresolvedLocalTargetCount ?? 0), 0);
  const pointCheck: VerificationCheck = pointTargetCount === 0
    ? { label: "Saved point names", value: "no named motion targets", status: "informational" }
    : !sharePoints
      ? { label: "Saved point names", value: "not checked because project context sharing is off", status: "not-checked" }
      : localTargetCount > 0
        ? { label: "Saved point names", value: "local target variables are not type-checked", status: "partial" }
        : { label: "Saved point names", value: "names and point types checked", status: "checked" };
  const commandCheck: VerificationCheck = robotCallCount > 0
    ? { label: "Robot API names", value: "checked against the supported subset", status: "checked" }
    : { label: "Robot API names", value: "no robot commands to check", status: "informational" };
  return {
    title: "Suggested code",
    checks: [
      { label: "Syntax", value: "OK · " + languages.map((item) => item === "lua" ? "Lua" : "Python").join(" + "), status: "checked" },
      commandCheck,
      pointCheck,
      { label: "Reachability", value: "not checked", status: "not-checked" },
      { label: "Simulator run", value: "not run", status: "not-checked" },
      ...(toolMode === "fork" ? [
        { label: "Passive fork", value: "no DO/Pick/Place calls detected", status: "checked" as const },
        { label: "Fork motion order", value: "approach/slide/lift/lower sequence not checked", status: "not-checked" as const },
      ] : []),
    ],
  };
}

async function checkCodeLocally(
  language: ProgramLanguage,
  sources: string[],
  savedPoints: TeachPoint[],
  sharePoints: boolean,
  toolMode: ToolMode,
): Promise<CodeCheckResult[]> {
  const worker = new Worker(new URL("./coach/codeSyntax.worker.ts", import.meta.url), { type: "module" });
  try {
    const results = await new Promise<CodeCheckResult[]>((resolve, reject) => {
      const timeoutId = window.setTimeout(() => reject(new Error("Local code checking took too long.")), 45_000);
      worker.onmessage = (event: MessageEvent<{ type?: string; results?: CodeCheckResult[]; error?: string }>) => {
        window.clearTimeout(timeoutId);
        if (event.data.type === "syntax-check-error") {
          reject(new Error("Local code checking failed" + (event.data.error ? ": " + event.data.error : ".")));
          return;
        }
        if (event.data.type !== "code-review-results" || !Array.isArray(event.data.results)) {
          reject(new Error("The local code checker returned an invalid result."));
          return;
        }
        resolve(event.data.results);
      };
      worker.onerror = () => {
        window.clearTimeout(timeoutId);
        reject(new Error("The local code checker could not start."));
      };
      worker.postMessage({
        type: "check-code",
        language,
        sources,
        points: sharePoints ? savedPoints.map(({ name, kind }) => ({ name, kind })) : [],
        checkPoints: sharePoints,
        toolMode,
      });
    });
    if (results.length !== sources.length) throw new Error("The local code checker did not return a result for every program.");
    return results;
  } finally {
    worker.terminate();
  }
}

function buildProgramVerification(result: CodeCheckResult, language: ProgramLanguage, toolMode: ToolMode): VerificationSummary {
  const findings = result.findings ?? [];
  const unsupported = findings.some((finding) => finding.kind === "unsupported-api" || finding.kind === "api-shadowed");
  const invalidPoints = findings.some((finding) => finding.kind === "missing-point" || finding.kind === "wrong-point-kind");
  const passiveForkIssue = findings.some((finding) => finding.kind === "passive-fork-action");
  const pointCheck: VerificationCheck = (result.pointTargetCount ?? 0) === 0
    ? { label: "Saved point names", value: "no named motion targets", status: "informational" }
    : result.pointsStatus === "not-shared"
      ? { label: "Saved point names", value: "not checked · project points were not shared", status: "not-checked" }
      : invalidPoints
        ? { label: "Saved point names", value: "one or more target names/types need attention", status: "problem" }
        : (result.unresolvedLocalTargetCount ?? 0) > 0
          ? { label: "Saved point names", value: "local target variables are not type-checked", status: "partial" }
          : { label: "Saved point names", value: "names and direct point types checked", status: "checked" };
  return {
    title: "Your shared program",
    checks: [
      { label: "Syntax", value: result.syntaxOk ? `valid ${language === "lua" ? "Lua" : "Python"} syntax` : `needs attention${result.error ? ` · ${result.error}` : ""}`, status: result.syntaxOk ? "checked" : "problem" },
      { label: "Robot API names", value: unsupported ? "unsupported command found" : (result.robotCallCount ?? 0) > 0 ? "known names checked against this subset" : "no robot commands to check", status: unsupported ? "problem" : (result.robotCallCount ?? 0) > 0 ? "checked" : "informational" },
      pointCheck,
      ...(toolMode === "fork" ? [
        { label: "Passive fork", value: passiveForkIssue ? "powered pickup/release command found" : "no DO/Pick/Place call detected", status: passiveForkIssue ? "problem" as const : "checked" as const },
        { label: "Fork motion order", value: "approach/slide/lift/lower sequence not checked", status: "not-checked" as const },
      ] : []),
      { label: "Reachability", value: "not checked", status: "not-checked" },
      { label: "Simulator run", value: "not run", status: "not-checked" },
    ],
    findings: findings.map(({ line, message }) => ({ line, message })),
    emptyMessage: result.syntaxOk ? undefined : "This parser found a syntax problem. The program was not run.",
  };
}

function notCheckedProgramReview(language: ProgramLanguage, reason: string): { review: StaticProgramReview; verification: VerificationSummary } {
  return {
    review: { status: "not-checked", language, findings: [], reason },
    verification: {
      title: "Your shared program",
      checks: [
        { label: "Syntax", value: "not checked", status: "not-checked" },
        { label: "Robot API names", value: "not checked", status: "not-checked" },
        { label: "Saved point names", value: "not checked", status: "not-checked" },
        { label: "Reachability", value: "not checked", status: "not-checked" },
        { label: "Simulator run", value: "not run", status: "not-checked" },
      ],
      emptyMessage: reason,
    },
  };
}

async function reviewSharedProgram(code: string, language: ProgramLanguage, savedPoints: TeachPoint[], toolMode: ToolMode) {
  if (!code.trim()) return notCheckedProgramReview(language, "The shared editor is empty; no source program was checked or run.");
  if (code.length > 8_000) return notCheckedProgramReview(language, "The program is longer than the local checker's 8,000-character limit; shorten it for a local static review.");
  try {
    const [result] = await checkCodeLocally(language, [code], savedPoints, true, toolMode);
    const review: StaticProgramReview = {
      status: "checked",
      language,
      syntaxOk: result.syntaxOk,
      syntaxError: result.syntaxOk ? undefined : result.error,
      findings: (result.findings ?? []).map((finding) => ({ kind: finding.kind ?? "finding", line: finding.line, message: finding.message })),
      robotCallCount: result.robotCallCount,
      pointTargetCount: result.pointTargetCount,
      unresolvedLocalTargetCount: result.unresolvedLocalTargetCount,
      pointsStatus: result.pointsStatus,
    };
    return { review, verification: buildProgramVerification(result, language, toolMode) };
  } catch (cause) {
    const reason = cause instanceof Error ? cause.message : "The local code checker could not complete.";
    return notCheckedProgramReview(language, `${reason} The program was not run; the AI review is still static.`);
  }
}

function renderVerificationSummary(summary: VerificationSummary | undefined) {
  if (!summary) return null;
  const sectionLabel = `${summary.title ?? "Suggested code"} · local static checks`;
  return <section className="ai-response-verification" aria-label={sectionLabel}>
    <div className="ai-response-verification-heading"><ShieldCheck size={13} aria-hidden="true" /><strong>{summary.title ?? "Suggested code"} · local static checks</strong><span>code not run</span></div>
    {summary.checks.length > 0
      ? <ul className="ai-response-checks" aria-label={summary.title === "Your shared program" ? "Shared program check results" : "Code example check results"}>
        {summary.checks.map((check) => <li className="ai-response-check" data-status={check.status} key={check.label}>
          <span>{check.label}</span><strong>{check.value}</strong>
        </li>)}
      </ul>
      : <p className="ai-response-check-empty">{summary.emptyMessage ?? "No code example to check · the coach did not run your program"}</p>}
    {summary.emptyMessage && summary.checks.length > 0 && <p className="ai-response-check-empty">{summary.emptyMessage}</p>}
    {!!summary.findings?.length && <ul className="ai-response-findings" aria-label="Program static findings">
      {summary.findings.map(({ line, message }, index) => <li key={`${line}-${index}`}>Line {line}: {message}</li>)}
    </ul>}
  </section>;
}

function renderNextStep(summary: VerificationSummary | undefined) {
  const codeWasSuggested = Boolean(summary?.checks.length);
  const points = summary?.checks.find((check) => check.label === "Saved point names");
  const pointInstruction = points?.status === "not-checked"
    ? "Because project context sharing is off, check each named point in Teach points and review setup warnings"
    : points?.status === "partial"
      ? "check any local target variables and review setup warnings"
      : "review the setup warnings";
  const instruction = codeWasSuggested
    ? "If you want to try it, copy the example into the editor → " + pointInstruction + " → run it yourself → compare the Run output and any simulator changes with the explanation."
    : "Try one small idea from the explanation in your editor → review setup warnings → run it yourself → compare the Run output and any simulator changes with the explanation.";
  return <section className="ai-next-step" aria-label="Next step">
    <strong>Next step</strong>
    <p>{instruction}</p>
  </section>;
}

function renderCoachReply(content: string) {
  const blocks: Array<{ type: "text"; value: string } | { type: "code"; value: string; language: string }> = [];
  let cursor = 0;
  for (const match of content.matchAll(CODE_FENCE)) {
    const index = match.index ?? cursor;
    if (index > cursor) blocks.push({ type: "text", value: content.slice(cursor, index) });
    blocks.push({ type: "code", value: match[2].trim(), language: match[1] || "code" });
    cursor = index + match[0].length;
  }
  if (cursor < content.length) blocks.push({ type: "text", value: content.slice(cursor) });
  if (blocks.length === 0) blocks.push({ type: "text", value: content });

  return blocks.map((block, index) => block.type === "code"
    ? <div className="ai-reply-code" key={index}><span>{DISPLAY_ONLY_FENCE_LANGUAGES.has(block.language) ? `${block.language} · not run` : block.language}</span><pre><code>{block.value}</code></pre></div>
    : <p className="ai-reply-text" key={index}>{block.value}</p>);
}

export function CodeAssistant({ uiLanguage = "zh-Hant", code, savedPoints, language, toolMode, setupReady, setupChecks, recentRunLog, hasCurrentRun, onOpenControlFlowLesson }: CodeAssistantProps) {
  const [apiKey, setApiKey] = useState("");
  const [endpoint, setEndpoint] = useState(DEFAULT_CHAT_COMPLETIONS_ENDPOINT);
  const [question, setQuestion] = useState("");
  const [model, setModel] = useState(DEFAULT_CHAT_COMPLETIONS_MODEL);
  const [includeProjectContext, setIncludeProjectContext] = useState(false);
  const [messages, setMessages] = useState<CoachMessage[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const setupSummary = useMemo(
    () => setupChecks.slice(0, 12).map(({ title, status, detail }) => `${title}: ${status.toUpperCase()} — ${detail}`.slice(0, 240)),
    [setupChecks],
  );
  const endpointCheck = useMemo(() => validateChatCompletionsEndpoint(endpoint), [endpoint]);
  const usesSpaceBunnyOnOpenRouter = model.trim() === DEFAULT_CHAT_COMPLETIONS_MODEL
    && endpointCheck.ok
    && isOpenRouterEndpoint(endpointCheck.value);
  const lastMessage = messages.at(-1);
  const latestReply = lastMessage?.role === "assistant" ? lastMessage.content : "";

  async function askCoach(prompt = question, intent?: "review" | "explain" | "teach") {
    if (!apiKey.trim() || !prompt.trim() || loading) return;
    if (!endpointCheck.ok) {
      setError(endpointCheck.error);
      return;
    }
    const selectedModel = model.trim();
    if (!selectedModel || selectedModel.length > 120 || /[\u0000-\u001f\u007f]/.test(selectedModel)) {
      setError("Enter a valid model ID from the selected provider (up to 120 characters)." );
      return;
    }
    if (uiLanguage === "zh-Hant" && prompt === REVIEW_PROMPT) prompt = "請以繁體中文檢視我的程式。先解釋本機靜態檢查及執行紀錄的結果，檢查語法、指令、點位和動作次序。先提供一個小提示，再提供短範例和讓我自行驗證的方法。請勿修改或執行程式。";
    if (uiLanguage === "zh-Hant" && prompt === EXPLAIN_PROMPT) prompt = "請以繁體中文逐步解釋此程式的指令、變數、函式與執行次序，提供一個可嘗試的小改動和自行驗證方法。";
    setQuestion(prompt);
    setError("");
    setCopied(false);
    setLoading(true);
    try {
      const submittedKey = apiKey.trim().replace(/^Bearer\s+/i, "");
      const history = messages
        .filter((message) => message.language === language && message.toolMode === toolMode)
        .filter((message) => includeProjectContext || !message.includedProjectContext)
        .slice(-4)
        .map(({ role, content }) => ({ role, content: content.slice(0, 1_800) }));
      const programAssessment = includeProjectContext
        ? await reviewSharedProgram(code, language, savedPoints, toolMode)
        : undefined;
      const requestInput = {
          uiLanguage,
          question: prompt,
          code: includeProjectContext ? code : "",
          language,
          toolMode,
          points: includeProjectContext ? savedPoints.map(({ name, kind }) => ({ name, kind })) : [],
          intent: intent ?? (prompt === REVIEW_PROMPT ? "review" : prompt === EXPLAIN_PROMPT ? "explain" : "teach"),
          model: selectedModel,
          endpoint: endpointCheck.value,
          setupChecks: includeProjectContext ? setupSummary : [],
          runLog: includeProjectContext ? recentRunLog : [],
          history,
          programReview: programAssessment?.review,
        };
      const controller = new AbortController();
      const timeoutId = window.setTimeout(() => controller.abort(), 60_000);
      let response: Response;
      try {
        response = await fetch(endpointCheck.value, {
          method: "POST",
          mode: "cors",
          credentials: "omit",
          cache: "no-store",
          redirect: "error",
          referrerPolicy: "no-referrer",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${submittedKey}`,
          },
          signal: controller.signal,
          body: JSON.stringify(buildChatCompletionRequest(requestInput)),
        });
      } catch (cause) {
        if (cause instanceof Error && cause.name === "AbortError") {
          throw new Error("The request timed out. It may have reached the provider; check its usage page before retrying.");
        }
        if (cause instanceof TypeError) {
          throw new Error("Could not reach this provider from your browser. It may block cross-origin requests (CORS) or have a network problem. The request may have reached the provider; check its usage page before retrying.");
        }
        throw cause;
      } finally {
        window.clearTimeout(timeoutId);
      }
      if (!response.ok) {
        if (response.status === 401 || response.status === 403) throw new Error("The provider rejected this API key or model access. Check the key, endpoint, and account permissions.");
        if (response.status === 404) throw new Error("The endpoint or model was not found. Check that the URL ends with /chat/completions and the model ID is available.");
        if (response.status === 429) throw new Error("The provider is busy or this account reached a request limit. Check provider usage and try again later.");
        throw new Error(`The provider could not complete this request (HTTP ${response.status}). Check its model and account settings.`);
      }
      let payload: unknown;
      try {
        payload = await response.json();
      } catch {
        throw new Error("The provider response was not valid JSON. Check that this is a Chat Completions endpoint.");
      }
      const reply = readChatCompletionReply(payload);
      if (!reply?.trim()) throw new Error("The provider returned an empty response. Try again or check its model settings.");
      rejectUnfencedExecutableCode(reply);
      const codeExamples = collectCodeExamples(reply, language);
      const verification = await validateCodeExamples(codeExamples, savedPoints, includeProjectContext, toolMode);
      setMessages((current) => [...current,
        { role: "user" as const, content: prompt, includedProjectContext: includeProjectContext, language, toolMode },
        { role: "assistant" as const, content: reply, includedProjectContext: includeProjectContext, language, toolMode, programVerification: programAssessment?.verification, verification },
      ].slice(-10));
      setQuestion("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not reach the AI coach.");
    } finally {
      setLoading(false);
    }
  }

  async function copyExample() {
    const fenced = latestReply.match(/```(?:lua|python|py)?\s*\n?([\s\S]*?)```/i);
    if (!fenced) return;
    try {
      await navigator.clipboard.writeText(fenced[1].trim());
      setCopied(true);
    } catch {
      setError("Clipboard access was blocked. Select and copy the code example manually.");
    }
  }

  return localizeCoachTree(
    <section className="ai-coach" aria-label="AI coding coach">
      <div className="ai-coach-heading">
        <div><Sparkles size={14} /><strong>AI coding coach · read-only</strong><span>OpenAI-compatible API</span></div>
        <div className="ai-coach-header-actions">
          {messages.length > 0 && <button type="button" className="ai-clear-chat" onClick={() => { setMessages([]); setQuestion(""); setError(""); }} disabled={loading} aria-label="Clear coach conversation">Clear conversation</button>}
        </div>
      </div>

      <p className="ai-coach-intro">Ask for a code review or explanation. The coach gives a hint first, checks code examples locally, and never edits or runs your program. Open <strong>If / else</strong> or <strong>Loops</strong> for free guided lessons; no API key is needed.</p>

      <details className="ai-provider-setup">
        <summary><span>Connect AI for custom help</span><span className={`ai-key-state ${apiKey.trim() ? "ai-key-set" : ""}`}><span aria-hidden="true" />{apiKey.trim() ? "KEY IN MEMORY" : "KEY NEEDED"}</span></summary>
        <div className="ai-provider-fields">
          <label className="ai-field-label" htmlFor="coach-api-key">Your provider API key</label>
          <form className="ai-key-row" autoComplete="off" onSubmit={(event) => event.preventDefault()}>
            <input
              id="coach-api-key"
              type="password"
              value={apiKey}
              maxLength={512}
              autoComplete="off"
              spellCheck={false}
              placeholder="Enter a key from your selected provider"
              onChange={(event) => setApiKey(event.currentTarget.value)}
            />
            <button type="button" className="ai-clear-key" onClick={() => { setApiKey(""); setMessages([]); setQuestion(""); setError(""); }} disabled={!apiKey || loading} aria-label="Forget provider API key"><Trash2 size={14} /></button>
          </form>
          <label className="ai-field-label" htmlFor="coach-endpoint">OpenAI-compatible Chat Completions URL</label>
          <input
            id="coach-endpoint"
            className="ai-model-input"
            type="url"
            value={endpoint}
            maxLength={512}
            spellCheck={false}
            autoComplete="off"
            aria-invalid={!endpointCheck.ok}
            aria-describedby="coach-endpoint-help"
            onChange={(event) => {
              setEndpoint(event.currentTarget.value);
              setMessages([]);
              setError("");
              setCopied(false);
            }}
          />
          <small id="coach-endpoint-help" className={endpointCheck.ok ? "ai-model-help" : "ai-endpoint-error"} role={endpointCheck.ok ? undefined : "status"}>
            {endpointCheck.ok
              ? "Use the full URL ending in /chat/completions. Your key and question go directly to this URL; use a provider you trust. Browser CORS must be allowed. Changing it clears the conversation."
              : endpointCheck.error}
          </small>
          <label className="ai-field-label" htmlFor="coach-model">Model ID at this provider</label>
          <input
            id="coach-model"
            className="ai-model-input"
            value={model}
            maxLength={120}
            spellCheck={false}
            onChange={(event) => setModel(event.currentTarget.value)}
          />
          <small className="ai-model-help">Default: stealth/space-bunny-alpha. Availability and pricing depend on your provider.</small>
          {usesSpaceBunnyOnOpenRouter && (
            <small className="ai-model-help ai-model-privacy" role="note">
              This model's third-party provider may retain prompts and replies. Avoid student names or personal details. <a href="https://openrouter.ai/stealth/space-bunny-alpha" target="_blank" rel="noopener noreferrer">Read the model data terms</a>.
            </small>
          )}
        </div>
      </details>

      <div className="ai-presets" role="group" aria-label="Suggested questions">
        <button type="button" onClick={() => void askCoach(REVIEW_PROMPT, "review")} disabled={!apiKey.trim() || !endpointCheck.ok || loading || !includeProjectContext || !code.trim()}><CheckCircle2 size={13} /> Review my code</button>
        <button type="button" onClick={() => void askCoach(EXPLAIN_PROMPT, "explain")} disabled={!apiKey.trim() || !endpointCheck.ok || loading || !includeProjectContext || !code.trim()}><BookOpen size={13} /> Explain code</button>
        <button type="button" onClick={() => { if (onOpenControlFlowLesson) onOpenControlFlowLesson("if-else"); else setQuestion(uiLanguage === "zh-Hant" ? "請教我條件判斷，提供一個簡短完整的範例。" : language === "lua" ? "Teach me Lua if / elseif / else / end with a tiny simulator-related example." : "Teach me Python if / elif / else with a tiny simulator-related example."); }}><BookOpen size={13} /> If / else</button>
        <button type="button" onClick={() => { if (onOpenControlFlowLesson) onOpenControlFlowLesson("loops"); else setQuestion(uiLanguage === "zh-Hant" ? "請教我 for 與 while 迴圈，使用有限次數的短範例。" : language === "lua" ? "Teach me Lua for and while loops with safe beginner-sized examples for this simulator." : "Teach me Python for and while loops with safe beginner-sized examples for this simulator."); }}><BookOpen size={13} /> Loops</button>
      </div>

      <details className="ai-local-functions">
        <summary>{uiLanguage === "zh-Hant" ? "函式與呼叫 · 免費導學" : "Functions and calls · free lesson"}</summary>
        <p>{uiLanguage === "zh-Hant" ? "先定義函式，再呼叫它。函式可接收參數及回傳值；把函式放進清單後，可按選項呼叫。Python 學生程式毋須 await，內部會逐步等待動作完成。" : "Define a function, then call it. Functions accept arguments and return values. A list can select which function to call. Student Python needs no await; the simulator waits for motions internally."}</p>
        <pre><code>{language === "python" ? "def task():\n    print('training')\n    return 1\n\nfunctions = [task]\nselected_value = functions[0]\nselected_value()" : "local function task()\n  print('training')\n  return 1\nend\n\nlocal functions = {task}\nlocal selected_value = functions[1]\nselected_value()"}</code></pre>
        <p>{uiLanguage === "zh-Hant" ? "支援一般函式與有限迴圈；不支援呼叫式註解、next/iter/StopIteration 或迭代器協定。指令速查：需使用已儲存點位。以下只列出模擬器支援的子集；不是完整 Dobot SDK。被動叉工具只靠路徑拾放，不可使用 DO/pick/place。" : "Functions and finite loops are supported; callable annotations and next/iter/StopIteration iterator protocols are excluded. Command reference: use saved points. This is the simulator subset, not the full Dobot SDK. The passive fork uses its path and cannot use DO/pick/place."}</p>
        <pre><code>{language === "python" ? "mov_j(P) / mov_l(P)\nrel_mov_l([x, y, z, r])\njoint_mov_j(J)\nsync() / wait(milliseconds)\nget_pose() / get_angle()\ndo(1, ON) / do(1, OFF)" : "MovJ(P) / MovL(P)\nRelMovL({x, y, z, r})\nJointMovJ(J)\nSync() / Wait(milliseconds)\nGetPose() / GetAngle()\nDO(1, ON) / DO(1, OFF)"}</code></pre>
      </details>
      <label className="ai-question-label" htmlFor="ai-coach-question">What would you like help with?</label>
      <textarea
        id="ai-coach-question"
        value={question}
        maxLength={3_000}
        rows={3}
        placeholder="Describe what you expect, what happened, or a concept you want to learn…"
        onChange={(event) => setQuestion(event.currentTarget.value)}
      />
      <label className="ai-include-code"><input name="share-code-context" type="checkbox" checked={includeProjectContext} onChange={(event) => setIncludeProjectContext(event.currentTarget.checked)} /> Share current {language} program, saved point names, setup checks, and recent run log <span>(off by default)</span></label>
      {!includeProjectContext && <p className="ai-sharing-help">Your program, saved point names, setup checks, and run log stay on this device unless you turn sharing on. Enable it to use “Review my code” or “Explain code”.</p>}
      {includeProjectContext && !hasCurrentRun && <p className="ai-sharing-help">No run log is available for this exact project state. The coach will receive the current program, saved point names, and setup checks only; run this version yourself first to include results.</p>}

      <div className="ai-coach-actions">
        <button type="button" className="ai-ask-button" onClick={() => void askCoach()} disabled={!apiKey.trim() || !endpointCheck.ok || !question.trim() || loading}>
          {loading ? <LoaderCircle className="spin" size={14} /> : <Sparkles size={14} />}{loading ? "Reviewing…" : "Ask the coach"}
        </button>
        <span>Setup checks: {setupReady ? "ready" : "needs attention"}</span>
      </div>

      <details className="ai-transparency">
        <summary>Privacy and how suggestions are checked</summary>
        <p className="ai-privacy-note"><ShieldCheck size={13} /> The key stays in this page's memory until you clear it or refresh, then is sent directly from your browser to the endpoint shown above. Only use a provider you trust; the provider may process or retain the question and anything you share, and may charge your account. The key is not saved by this app. Your program, saved point names, setup checks, and recent run log are sent only when you opt in; run logs may contain program output. Follow-up chat messages stay in page memory until cleared or refreshed.</p>
      <p className="ai-verify-note"><ShieldCheck size={13} /> Before showing a code example, a local worker parses Lua/Python syntax, checks known robot-command names, blocks common unsupported robot-style commands, and rejects DO/Pick/Place calls for the passive fork. If you opt in to sharing project context, it also checks direct motion targets against saved point names and Cartesian/joint types. It does not execute code, check reachability, path collisions, timing, or full program behavior. You choose whether to copy or run it; simulator results describe this virtual scene, not a physical robot.</p>
      </details>

      {error && <p className="ai-error" role="alert">{error}</p>}
      {messages.length > 0 && <div className="ai-conversation" role="log" aria-label="AI coach conversation" aria-busy={loading}>
        {messages.map((message, index) => <article className={`ai-message ai-message-${message.role}`} key={`${index}-${message.role}`}>
          <strong>{message.role === "user" ? "You" : "Coach"}</strong>
          {message.role === "assistant"
            ? <>{renderVerificationSummary(message.programVerification)}<div className="ai-reply-content">{renderCoachReply(message.content)}</div>{renderVerificationSummary(message.verification)}{renderNextStep(message.verification)}</>
            : <p className="ai-message-user-text">{message.content}</p>}
          {message.role === "assistant" && index === messages.length - 1 && /```(?:lua|python|py)?\s*\n?([\s\S]*?)```/i.test(latestReply) && <button type="button" className="ai-copy-example" onClick={() => void copyExample()}><Clipboard size={12} />{copied ? "Copied example" : "Copy code example"}</button>}
        </article>)}
      </div>}
    </section>, uiLanguage
  );
}
