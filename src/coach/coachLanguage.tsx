import { Children, cloneElement, isValidElement, type ReactNode } from "react";
export type CoachLanguage = "zh-Hant" | "en";
const ZH: Record<string, string> = {
  "AI coding coach": "AI 程式教練", "AI coding coach · read-only": "AI 程式教練 · 只提供建議",
  "OpenAI-compatible API": "兼容 OpenAI 的 API", "Clear conversation": "清除對話", "Clear coach conversation": "清除教練對話",
  "Ask for a code review or explanation. The coach gives a hint first, checks code examples locally, and never edits or runs your program. Open": "可請教練檢視或解釋程式。教練會先提供提示，並在本機檢查範例。它不會編輯或執行你的程式。開啟",
  "If / else": "條件判斷", "Loops": "迴圈", "or": "或", "for free guided lessons; no API key is needed.": "免費導學課程，毋須 API key。",
  "Connect AI for custom help": "連接 AI 取得個人化指導", "KEY IN MEMORY": "密鑰暫存於本頁", "KEY NEEDED": "需要密鑰",
  "Your provider API key": "供應商 API key", "Enter a key from your selected provider": "輸入所選供應商的 API key", "Forget provider API key": "清除供應商 API key",
  "OpenAI-compatible Chat Completions URL": "兼容 OpenAI 的 Chat Completions 網址", "Model ID at this provider": "供應商模型 ID",
  "Use the full URL ending in /chat/completions. Your key and question go directly to this URL; use a provider you trust. Browser CORS must be allowed. Changing it clears the conversation.": "使用以 /chat/completions 結尾的完整網址。密鑰及問題會直接傳送至該網址，請選擇可信任的供應商。供應商須允許瀏覽器 CORS；更改網址會清除對話。",
  "Default: stealth/space-bunny-alpha. Availability and pricing depend on your provider.": "預設：stealth/space-bunny-alpha。可用性及收費由供應商決定。",
  "This model's third-party provider may retain prompts and replies. Avoid student names or personal details.": "此模型的第三方供應商可能保留問題及回覆。請勿提供學生姓名或個人資料。",
  "Read the model data terms": "閱讀模型資料條款", "Suggested questions": "建議問題", "Review my code": "檢視我的程式", "Explain code": "解釋程式",
  "What would you like help with?": "你想了解甚麼？", "Describe what you expect, what happened, or a concept you want to learn…": "描述預期結果、實際情況，或想學習的概念…",
  "Share current": "分享目前的", "program, saved point names, setup checks, and recent run log": "程式、已儲存點位名稱、設定檢查及最近執行紀錄", "(off by default)": "（預設關閉）",
  "Your program, saved point names, setup checks, and run log stay on this device unless you turn sharing on. Enable it to use “Review my code” or “Explain code”.": "除非開啟分享，程式、點位名稱、設定檢查及執行紀錄只會留在此裝置。開啟分享後可使用「檢視我的程式」或「解釋程式」。",
  "No run log is available for this exact project state. The coach will receive the current program, saved point names, and setup checks only; run this version yourself first to include results.": "目前專案狀態沒有執行紀錄。教練只會收到程式、點位名稱及設定檢查；自行執行此版本後才可分享結果。",
  "Reviewing…": "檢視中…", "Ask the coach": "詢問教練", "Setup checks:": "設定檢查：", "ready": "準備就緒", "needs attention": "需要處理",
  "Privacy and how suggestions are checked": "私隱與建議檢查方式",
  "The key stays in this page's memory until you clear it or refresh, then is sent directly from your browser to the endpoint shown above. Only use a provider you trust; the provider may process or retain the question and anything you share, and may charge your account. The key is not saved by this app. Your program, saved point names, setup checks, and recent run log are sent only when you opt in; run logs may contain program output. Follow-up chat messages stay in page memory until cleared or refreshed.": "密鑰只暫存於此頁記憶體，清除或重新整理後即消失；請求會由瀏覽器直接傳送至上述網址。請選擇可信任的供應商；供應商可能處理或保留問題及分享內容，並向帳戶收費。本程式不會儲存密鑰。只有你開啟分享後才會傳送程式、點位名稱、設定檢查及最近執行紀錄，紀錄可能包含程式輸出。後續對話亦只暫存於此頁記憶體。",
  "Before showing a code example, a local worker parses Lua/Python syntax, checks known robot-command names, blocks common unsupported robot-style commands, and rejects DO/Pick/Place calls for the passive fork. If you opt in to sharing project context, it also checks direct motion targets against saved point names and Cartesian/joint types. It does not execute code, check reachability, path collisions, timing, or full program behavior. You choose whether to copy or run it; simulator results describe this virtual scene, not a physical robot.": "顯示範例前，本機 worker 會解析 Lua/Python 語法、檢查機械臂指令名稱、攔截常見不支援指令，並拒絕被動叉工具使用 DO/Pick/Place。開啟專案分享後，也會檢查直接使用的點位名稱及 Cartesian/joint 類型。它不會執行程式，也不會驗證可達性、碰撞、時間或完整行為。是否複製或執行由你決定；結果只描述虛擬場景。",
  "AI coach conversation": "AI 教練對話", "You": "你", "Coach": "教練", "Copied example": "已複製範例", "Copy code example": "複製程式範例",
  "Suggested code": "建議範例", "Your shared program": "你分享的程式", "local static checks": "本機靜態檢查", "code not run": "未執行程式",
  "Shared program check results": "分享程式檢查結果", "Code example check results": "範例檢查結果", "Program static findings": "程式靜態檢查發現", "Line": "行",
  "Syntax": "語法", "Saved point names": "已儲存點位名稱", "Robot API names": "機械臂 API 名稱", "Reachability": "可達性", "Simulator run": "模擬器執行", "Passive fork": "被動叉工具", "Fork motion order": "叉工具動作次序",
  "not checked": "未檢查", "not run": "未執行", "no named motion targets": "沒有具名動作點位", "names and point types checked": "已檢查名稱及點位類型", "names and direct point types checked": "已檢查名稱及直接點位類型",
  "not checked because project context sharing is off": "未檢查：專案分享已關閉", "not checked · project points were not shared": "未檢查：未分享專案點位", "local target variables are not type-checked": "未檢查區域點位變數類型",
  "checked against the supported subset": "已按支援的指令子集檢查", "known names checked against this subset": "已按此子集檢查已知名稱", "no robot commands to check": "沒有機械臂指令可檢查", "unsupported command found": "發現不支援指令",
  "no DO/Pick/Place calls detected": "未發現 DO/Pick/Place 呼叫", "no DO/Pick/Place call detected": "未發現 DO/Pick/Place 呼叫", "powered pickup/release command found": "發現帶動力的拾取或釋放指令", "approach/slide/lift/lower sequence not checked": "未檢查接近、插入、抬升及放下次序", "one or more target names/types need attention": "一個或以上點位名稱或類型需要處理",
  "No code example to check · the coach did not run your program": "沒有範例可檢查；教練沒有執行你的程式", "Next step": "下一步",
  "Try one small idea from the explanation in your editor → review setup warnings → run it yourself → compare the Run output and any simulator changes with the explanation.": "在編輯器嘗試一個小改動 → 檢視設定提示 → 自行執行 → 比較輸出及模擬器變化。",
  "Enter a valid model ID from the selected provider (up to 120 characters).": "請輸入供應商的有效模型 ID（最多 120 字元）。",
  "The request timed out. It may have reached the provider; check its usage page before retrying.": "請求逾時。供應商可能已收到請求，重試前請先查看用量頁面。",
  "Could not reach this provider from your browser. It may block cross-origin requests (CORS) or have a network problem. The request may have reached the provider; check its usage page before retrying.": "瀏覽器無法聯絡供應商，可能被 CORS 阻擋或網絡出現問題。供應商可能已收到請求，重試前請查看用量。",
  "The provider rejected this API key or model access. Check the key, endpoint, and account permissions.": "供應商拒絕 API key 或模型存取權，請檢查密鑰、網址及帳戶權限。",
  "The endpoint or model was not found. Check that the URL ends with /chat/completions and the model ID is available.": "找不到網址或模型。請確認網址以 /chat/completions 結尾，且模型 ID 可用。",
  "The provider is busy or this account reached a request limit. Check provider usage and try again later.": "供應商繁忙或帳戶已達請求上限，請查看用量並稍後再試。",
  "The provider response was not valid JSON. Check that this is a Chat Completions endpoint.": "供應商回覆並非有效 JSON，請確認使用 Chat Completions 網址。",
  "The provider returned an empty response. Try again or check its model settings.": "供應商回覆空白，請查看模型設定後再試。",
  "Could not reach the AI coach.": "無法聯絡 AI 教練。",
  "Clipboard access was blocked. Select and copy the code example manually.": "剪貼簿存取被阻擋，請手動選取並複製範例。",
  "Enter the provider's full Chat Completions URL.": "請輸入供應商的完整 Chat Completions 網址。",
  "Enter a complete URL, including https:// and /chat/completions.": "請輸入包含 https:// 及 /chat/completions 的完整網址。",
  "Use an HTTPS provider URL. HTTP is allowed only for a local development service.": "請使用 HTTPS 網址；HTTP 只可用於本機開發服務。",
  "Use HTTPS for remote providers. Plain HTTP is allowed only for localhost.": "遠端供應商須使用 HTTPS；HTTP 只適用於 localhost。",
  "Do not put credentials, query parameters, or fragments in the endpoint URL.": "網址不可包含認證資料、查詢參數或片段。",
  "Enter the full endpoint URL ending in /chat/completions.": "請輸入以 /chat/completions 結尾的完整網址。",
  "Local code checking took too long.": "本機程式檢查逾時。",
  "The local code checker returned an invalid result.": "本機程式檢查回傳無效結果。",
  "The local code checker could not start.": "無法啟動本機程式檢查。",
  "The local code checker did not return a result for every program.": "本機檢查未能提供每段程式的結果。",
  "I could not check this large set of examples locally. Ask for one short Lua/Python example at a time.": "範例太多，未能完成本機檢查。請每次要求一個短 Lua/Python 範例。",
  "I held back this reply because it included code outside a checked code block. Ask the coach to put the complete Lua/Python example in a fenced code block so the browser can check it first.": "回覆包含未放進程式碼區塊的可執行內容，已暫停顯示。請要求教練把完整 Lua/Python 範例放進程式碼區塊，以便瀏覽器先檢查。",
  "The shared editor is empty; no source program was checked or run.": "分享的編輯器沒有內容；未檢查或執行任何程式。",
  "The program is longer than the local checker's 8,000-character limit; shorten it for a local static review.": "程式超出本機檢查的 8,000 字元上限，請縮短後再進行靜態檢查。",
  "This parser found a syntax problem. The program was not run.": "解析器發現語法問題。程式未有執行。",

};
export function coachText(text: string, language: CoachLanguage): string {
  if (language === "en") return text;
  const trimmed = text.trim();
  if (ZH[trimmed]) return text.replace(trimmed, ZH[trimmed]);
  if (text.includes("If you want to try it, copy the example into the editor")) return "如想嘗試：複製範例至編輯器 → 檢查點位及設定提示 → 自行執行 → 比較輸出及場景變化。";
  if (/^(?:text|plaintext|output) · not run$/.test(text)) return "顯示內容 · 未執行";
  if (text.startsWith("valid ")) return text.replace("valid ", "有效的 ").replace(" syntax", " 語法");
  if (text.startsWith("needs attention")) return text.replace("needs attention", "需要處理");
  if (text.includes(" · local static checks")) return coachText(text.replace(" · local static checks", ""), language) + " · 本機靜態檢查";
  if (text.startsWith("The endpoint must be")) return "網址最多可有 512 字元。";
  if (text.startsWith("The provider could not complete this request")) return "供應商未能完成請求" + (text.match(/\(HTTP \d+\)/)?.[0] ?? "") + "，請檢查模型及帳戶設定。";
  if (text.startsWith("I held back this reply because it included unsupported code language")) return "回覆包含不支援的程式語言，已暫停顯示；請要求 Lua 或 Python 模擬器範例。";
  if (text.startsWith("I held back the example because the local")) return "本機語法檢查失敗，範例已暫停顯示。請要求修正後的較短範例。" + (text.match(/<student-program>.*$/s)?.[0] ?? "");
  if (text.startsWith("I blocked this reply because")) return "範例使用被動叉工具不允許的 DO/Pick/Place，已攔截。請改用插入、抬升及放下路徑。";
  if (text.startsWith("I held back this example because")) return "本機檢查發現 API、點位或工具模式問題，範例已暫停顯示。請要求修正。";
  if (text.startsWith("Local code checking failed")) return "本機程式檢查失敗；程式未有執行。";
  if (text.includes("The program was not run; the AI review is still static.")) return "本機檢查未完成；程式未有執行，AI 回覆只屬靜態建議。";
  if (text.includes("Motion target “")) return text.replace("Motion target “", "動作點位「").replace(/” was not found.*$/, "」不在分享的已儲存點位內；請分享點位或在範例定義。");
  if (text.includes("” is unsupported.")) return text.replace(/” is unsupported\..*$/, "」不受此模擬器支援。請使用已記錄的指令子集。").replace("“", "「");
  if (text.includes("The unpowered fork cannot use")) return text.replace("The unpowered fork cannot use “", "被動叉工具不可使用「").replace(/”\..*$/, "」。請用插入、抬升、放下及退出路徑。");
  if (text.includes("shadows the simulator command")) return "範例重新定義了模擬器指令名稱，請更改函式或變數名稱。";
  if (text.startsWith("Motion commands need")) return "動作指令須使用已儲存點位變數或點位資料，不能使用加引號的名稱或原始座標串列。";
  if (text.startsWith("Use the exact case-sensitive")) return "請使用大小寫完全相符的指令選項名稱。";
  if (text.startsWith("RelMovL needs")) return "RelMovL 偏移資料需要 X、Y、Z；R 可選。";
  if (text.includes("” needs a ")) return "指令與已儲存點位的 Cartesian/joint 類型不符，請選用相應類型。";
  if (text.includes("must be called as a documented global")) return "請使用模擬器全域指令；不支援此物件方法形式。";
  return text;
}
// Translate only app-authored UI; code blocks and remote/user prose remain literal.
export function localizeCoachTree(node: ReactNode, language: CoachLanguage): ReactNode {
  if (typeof node === "string") return coachText(node, language);
  if (!isValidElement<Record<string, unknown>>(node)) return node;
  if (node.type === "pre" || node.type === "code" || node.props.className === "ai-reply-text" || node.props.className === "ai-message-user-text") return node;
  const props: Record<string, unknown> = {};
  for (const key of ["aria-label", "placeholder", "title"]) if (typeof node.props[key] === "string") props[key] = coachText(node.props[key], language);
  return cloneElement(node, props, Children.map(node.props.children as ReactNode, (child) => localizeCoachTree(child, language)));
}
