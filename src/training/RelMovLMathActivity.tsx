import { useMemo, useState } from "react";
import { activeTcpOffset, type JointAngles, type Pose, type ProjectDocument } from "../domain";
import type { MG400Kinematics } from "../sim/mg400Kinematics";
import { preflightLinearPath } from "../sim/motionPreflight";
import type { CourseLanguage } from "./curriculum";

type Props = {
  language: CourseLanguage;
  project?: ProjectDocument;
  joints?: JointAngles;
  kinematics?: Pick<MG400Kinematics, "solve">;
  modelError?: string;
};
type ObjectKind = "block" | "magnet";
type Pattern = "stack" | "row";
type TargetStatus = "pass" | "fail" | "unchecked";
type TargetCheck = { name: string; status: TargetStatus; detail: string };

const copy = {
  en: {
    title: "See the spacing math",
    diagram: "Open the visual math guide",
    object: "Object",
    pattern: "Pattern",
    pieces: "Pieces",
    block: "Body1 slot block",
    magnet: "Magnetic plate",
    stack: "Stack upward",
    row: "Arrange in a row",
    size: "Object dimensions",
    dimensionStep: "Vertical layer step",
    rowPitch: "Base row pitch before gap",
    increment: "Relative step vector X/Y/Z/R (mm, mm, mm, °)",
    variables: "N = number of pieces; i = target index starting at 0; h = height or thickness per stacked piece; w = width along the row; gap = space between row targets.",
    offsets: "Offsets from first target P₀",
    absoluteTargets: "Absolute target example",
    comparison: "Point-by-point vs repeated step",
    pointList: "Named targets",
    repeat: "RelMovL after P₀",
    gap: "Row gap: 0 mm",
    stackFormula: "ΔZᵢ = i × h; Zᵢ = Z₀ + ΔZᵢ (i = 0…N−1)",
    rowFormula: "ΔYᵢ = i × (w + gap); Yᵢ = Y₀ + ΔYᵢ (i = 0…N−1)",
    lastOffset: "Last-target offset",
    total: "Total stack height",
    lastStackFormula: "(N−1)h",
    lastRowFormula: "(N−1)(w+gap)",
    totalFormula: "N·h",
    rule: "Use RelMovL when each next target has the same fixed offset. Named points with MovL are clearer for unrelated fixed station positions.",
    lua: "Lua example",
    luaCode: "Lua code example",
    pythonCode: "Python code example",
    copyCode: "Copy code",
    scrollHint: "Swipe left or right to view all code.",
    copied: "Copied. Paste into the program editor when ready; pasting does not run the program.",
    copyFailed: "Clipboard unavailable. Select and copy the code manually.",
    pythonTitle: "Python · simulator-only",
    python: "Use a normal function call; do not write await.",
    motionOnly: "Motion-only example: N pieces mean N targets. The program first uses MovJ to reach P₀, then repeats the selected RelMovL step N−1 times. The loaded MG400 model checks P₀ and every later straight segment before you run; the simulator checks each segment again before moving. It does not pick up or release objects. Copy the matching Lua or Python example below; pasting edits the program but does not run it.",
    frame: "The simulator resolves offsets at action start in its base frame. Official docs describe the offset values, but do not establish the real controller frame behavior.",
    graph: "Target offset from the first point by piece index",
    axisX: "Piece index i",
    axisY: "Offset from P₀ (mm)",
    target: "Target P",
    preflightTitle: "Check the generated targets",
    activeMagnet: "active magnet TCP",
    activeFork: "active passive-fork TCP",
    preflightWaiting: "Waiting for the MG400 motion model to load before checking the path.",
    preflightUnavailable: "The MG400 motion model could not load, so these targets cannot be checked.",
    preflightP0Pass: "P₀ endpoint is reachable.",
    preflightPathPass: "Straight path and endpoint are reachable.",
    preflightP0Fail: (error: number) => `P₀ is outside this model's workspace (position error ${error.toFixed(1)} mm).`,
    preflightPathFail: (progress: number, error: number) => `Straight path fails at ${progress.toFixed(0)}% (position error ${error.toFixed(1)} mm).`,
    preflightUnchecked: "Not checked because the earlier target failed.",
    preflightAllPass: "Every generated target and RelMovL straight segment passes the loaded model's reachability check.",
    preflightFirstFail: "Adjust the first failed target or step in the program before running it.",
    preflightCaveat: "Uses the active tool's TCP. This model-based check does not check collisions, tool contact, or physical robot safety.",
  },
  "zh-Hant": {
    title: "看懂間距計算",
    diagram: "開啟步距數學圖解",
    object: "物件",
    pattern: "排列方式",
    pieces: "件數",
    block: "Body1 插槽方塊",
    magnet: "磁吸片",
    stack: "向上堆疊",
    row: "排成一列",
    size: "物件尺寸",
    dimensionStep: "垂直層距",
    rowPitch: "加空隙前的基本列距",
    increment: "相對步進向量 X/Y/Z/R（mm、mm、mm、°）",
    variables: "N = 件數；i = 由 0 起算的目標序號；h = 每件堆疊高度或厚度；w = 列排列方向的物件寬度；gap = 目標間距。",
    offsets: "相對首個目標 P₀ 的偏移",
    absoluteTargets: "絕對目標例子",
    comparison: "逐點列出與重複步進比較",
    pointList: "逐點指定目標",
    repeat: "由 P₀ 開始 RelMovL",
    gap: "列間空隙：0 mm",
    stackFormula: "ΔZᵢ = i × h；Zᵢ = Z₀ + ΔZᵢ（i = 0…N−1）",
    rowFormula: "ΔYᵢ = i ×（w + gap）；Yᵢ = Y₀ + ΔYᵢ（i = 0…N−1）",
    lastOffset: "末目標偏移",
    total: "堆疊總高度",
    lastStackFormula: "(N−1)h",
    lastRowFormula: "(N−1)(w+gap)",
    totalFormula: "N·h",
    rule: "每個後續目標都有相同固定偏移時，RelMovL 較簡潔；互不相關的固定工作站位置，使用命名教點配合 MovL 會更清楚。",
    lua: "Lua 範例",
    luaCode: "Lua 程式碼範例",
    pythonCode: "Python 程式碼範例",
    copyCode: "複製程式碼",
    scrollHint: "向左或向右滑動，查看完整程式碼。",
    copied: "已複製。準備好後貼入程式編輯器；貼上不會自動執行程式。",
    copyFailed: "無法使用剪貼簿，請手動選取並複製程式碼。",
    pythonTitle: "Python · 僅供模擬器使用",
    python: "使用一般函式呼叫；程式不需手寫 await。",
    motionOnly: "純移動示例：N 件即 N 個目標。程式會先以 MovJ 移至首點 P₀，再把所選 RelMovL 步進重複 N−1 次。已載入的 MG400 模型會在執行前檢查 P₀ 及每段直線路徑；模擬器亦會在每段移動前再次檢查。本例不會取件或釋放。請按下方相應按鈕複製 Lua 或 Python 範例；貼入編輯器只會修改程式，不會自動執行。",
    frame: "模擬器在動作開始時，以基座座標計算偏移。官方文件說明偏移值，但未確立實體控制器使用的座標系。",
    graph: "各件目標相對首點的偏移圖",
    axisX: "件數序號 i",
    axisY: "相對 P₀ 的偏移（mm）",
    target: "目標 P",
    preflightTitle: "檢查所有生成目標",
    activeMagnet: "目前磁吸工具 TCP",
    activeFork: "目前被動叉臂 TCP",
    preflightWaiting: "正在等待 MG400 運動學模型載入，載入後便會檢查各段路徑。",
    preflightUnavailable: "MG400 運動學模型未能載入，因此暫時無法檢查這些目標。",
    preflightP0Pass: "首點 P₀ 的端點可達。",
    preflightPathPass: "直線路徑及端點均可達。",
    preflightP0Fail: (error: number) => `P₀ 超出此模型的工作範圍（位置誤差 ${error.toFixed(1)} 毫米）。`,
    preflightPathFail: (progress: number, error: number) => `直線路徑在 ${progress.toFixed(0)}% 處不可達（位置誤差 ${error.toFixed(1)} 毫米）。`,
    preflightUnchecked: "因較早的目標未通過，所以未檢查。",
    preflightAllPass: "所有生成目標及 RelMovL 直線步進均通過已載入模型的可達性檢查。",
    preflightFirstFail: "執行前，先在程式內調整首個未通過的目標或步進。",
    preflightCaveat: "此檢查使用目前啟用工具的 TCP，並根據模型判斷可達性；不檢查碰撞、工具接觸或實體機械臂安全。",
  },
} as const;

export function RelMovLMathActivity({ language, project, joints, kinematics, modelError }: Props) {
  const [object, setObject] = useState<ObjectKind>("block");
  const [pattern, setPattern] = useState<Pattern>("stack");
  const [count, setCount] = useState(3);
  const [copyResult, setCopyResult] = useState<"copied" | "failed" | null>(null);
  const t = copy[language];
  const width = object === "block" ? 40 : 35;
  const height = object === "block" ? 40 : 4;
  const step = pattern === "stack" ? height : width;
  const axis = pattern === "stack" ? "Z" : "Y";
  const stepX = 0;
  const stepY = axis === "Y" ? step : 0;
  const stepZ = axis === "Z" ? step : 0;
  const contactZ = object === "block" ? 135 : 114;
  const contactR = object === "block" ? -90 : 0;
  const baseCoordinate = pattern === "stack" ? contactZ : -80;
  const startPose = pattern === "stack"
    ? { x: 300, y: 80, z: contactZ, r: contactR }
    : { x: 300, y: -80, z: contactZ, r: contactR };
  const targetChecks = useMemo(() => {
    if (!kinematics || !project || !joints) return null;
    const flangeOffset = project.tool.flangeOffset;
    const tcpOffset = activeTcpOffset(project.tool);
    const toleranceMm = project.tool.mode === "fork" && project.scene.blocks.some((block) => block.geometry === "body1") ? 0.01 : 0.5;
    const first = kinematics.solve(startPose, joints, flangeOffset, tcpOffset, toleranceMm);
    const checks: TargetCheck[] = [];
    if (!first.ok) {
      checks.push({ name: "P₀", status: "fail", detail: t.preflightP0Fail(first.positionErrorMm) });
      for (let index = 1; index < count; index += 1) checks.push({ name: `P${index}`, status: "unchecked", detail: t.preflightUnchecked });
      return checks;
    }

    checks.push({ name: "P₀", status: "pass", detail: t.preflightP0Pass });
    let previousPose: Pose = startPose;
    let previousJoints = first.joints;
    for (let index = 1; index < count; index += 1) {
      const targetPose: Pose = {
        x: startPose.x + stepX * index,
        y: startPose.y + stepY * index,
        z: startPose.z + stepZ * index,
        r: startPose.r,
      };
      const result = preflightLinearPath(previousPose, targetPose, previousJoints, kinematics, flangeOffset, tcpOffset, toleranceMm);
      if (!result.ok) {
        checks.push({ name: `P${index}`, status: "fail", detail: t.preflightPathFail(result.progressPercent, result.positionErrorMm) });
        for (let later = index + 1; later < count; later += 1) checks.push({ name: `P${later}`, status: "unchecked", detail: t.preflightUnchecked });
        break;
      }
      checks.push({ name: `P${index}`, status: "pass", detail: t.preflightPathPass });
      previousPose = targetPose;
      previousJoints = result.finalJoints;
    }
    return checks;
  }, [kinematics, project, joints, count, startPose.x, startPose.y, startPose.z, startPose.r, stepX, stepY, stepZ, t]);
  const offsets = Array.from({ length: count }, (_, index) => index * step);
  const absoluteCoordinates = offsets.map((offset) => baseCoordinate + offset);
  const max = Math.max(step * (count - 1), step);
  const coordinates = offsets.map((value, index) => ({
    x: 50 + (index / Math.max(count - 1, 1)) * 240,
    y: 135 - (value / max) * 105,
  }));
  const graphLine = coordinates.map(({ x, y }) => `${x},${y}`).join(" ");
  const formula = pattern === "stack" ? t.stackFormula : t.rowFormula;
  const offset = pattern === "stack" ? `0,0,${step},0` : `0,${step},0,0`;
  const sampleComment = language === "en"
    ? "P0 is a sample first target; teach a reachable point for your selected tool and work area."
    : "P0 是示範首點；請按所選工具及工作區，示教一個可達位置。";
  const lua = [
    `-- ${sampleComment}`,
    `local P0 = {coordinate = {x=${startPose.x}, y=${startPose.y}, z=${startPose.z}, r=${startPose.r}}}`,
    "local function move_to_next_targets()",
    "  MovJ(P0, {CP=0, SYNC=1})",
    `  for i = 1, ${count - 1} do`,
    `    RelMovL({${offset}}, {CP=0, SYNC=1})`,
    "  end",
    "end",
    "move_to_next_targets()",
  ].join("\n");
  const python = [
    `# ${sampleComment}`,
    `P0 = {"coordinate": {"x": ${startPose.x}, "y": ${startPose.y}, "z": ${startPose.z}, "r": ${startPose.r}}}`,
    "def move_to_next_targets():",
    "    mov_j(P0, cp=0)",
    `    for _ in range(${count - 1}):`,
    `        rel_mov_l([${offset}], cp=0)`,
    "move_to_next_targets()",
  ].join("\n");
  const lastOffset = (count - 1) * step;
  const namedTargets = absoluteCoordinates.map((value) => `${axis}${value}`).join(" / ");
  const offsetTargets = offsets.join(" → ");
  const repeatedStep = `+${axis} ${step} mm × ${count - 1}`;
  const targetCoordinateExample = language === "en"
    ? `Assume P₀ starts at ${axis}₀ = ${baseCoordinate} mm: ${axis} targets ${absoluteCoordinates.join(" → ")} mm; offsets from P₀ ${axis} = ${offsets.join(" → ")} mm.`
    : `假設首點 P₀ 的 ${axis}₀ = ${baseCoordinate} mm：絕對目標 ${axis} = ${absoluteCoordinates.join(" → ")} mm；相對偏移 Δ${axis} = ${offsets.join(" → ")} mm。`;
  const graphDescription = offsets.map((value, index) => language === "en"
    ? `${t.target}${index}: ${axis} target ${absoluteCoordinates[index]} mm; offset from P₀ ${value} mm`
    : `目標 P${index}：${axis} 座標 ${absoluteCoordinates[index]} 毫米；相對 P₀ 偏移 ${value} 毫米`).join(language === "en" ? "; " : "；");
  async function copyCode(source: string) {
    try {
      await navigator.clipboard.writeText(source);
      setCopyResult("copied");
    } catch {
      setCopyResult("failed");
    }
  }

  return <section className="relmovl-math" aria-labelledby="relmovl-math-title">
    <h4 id="relmovl-math-title">{t.title}</h4>
    <a className="relmovl-diagram-link" href="/learning/relmovl-math.html" target="_blank" rel="noreferrer">{t.diagram} ↗</a>
    <div className="relmovl-controls">
      <label>{t.object}<select value={object} onChange={(event) => setObject(event.target.value as ObjectKind)}><option value="block">{t.block}</option><option value="magnet">{t.magnet}</option></select></label>
      <label>{t.pattern}<select value={pattern} onChange={(event) => setPattern(event.target.value as Pattern)}><option value="stack">{t.stack}</option><option value="row">{t.row}</option></select></label>
      <label>{t.pieces}<select value={count} onChange={(event) => setCount(Number(event.target.value))}>{[2, 3, 4, 5].map((number) => <option key={number} value={number}>{number}</option>)}</select></label>
    </div>
    <p><strong>{t.size}:</strong> {object === "block" ? "40×40×40 mm" : "35×35×4 mm"} · <strong>{pattern === "stack" ? t.dimensionStep : t.rowPitch}:</strong> {step} mm · <strong>{t.increment}:</strong> ({stepX}, {stepY}, {stepZ}, 0)</p>
    <p className="relmovl-symbols">{t.variables}</p>
    <p className="relmovl-formula"><strong>{formula}</strong>{pattern === "row" && <span> · {t.gap}</span>}</p>
    <p className="relmovl-target-example"><strong>{t.absoluteTargets}:</strong> {targetCoordinateExample}</p>
    <p><strong>{t.offsets}:</strong> Δ{axis} {offsetTargets} mm · <strong>{t.lastOffset}:</strong> {pattern === "stack" ? t.lastStackFormula : t.lastRowFormula} = {lastOffset} mm{pattern === "stack" && <> · <strong>{t.total}:</strong> {t.totalFormula} = {count * height} mm</>}</p>
    <p className="relmovl-comparison"><strong>{t.comparison}:</strong> {t.pointList}: {namedTargets} mm · {t.repeat} {repeatedStep}</p>
    <svg className="relmovl-graph" viewBox="0 0 330 185" role="img" aria-labelledby="relmovl-graph-title relmovl-graph-desc">
      <title id="relmovl-graph-title">{t.graph}</title><desc id="relmovl-graph-desc">{graphDescription}</desc>
      <line x1="38" y1="140" x2="310" y2="140" className="relmovl-axis"/><line x1="38" y1="140" x2="38" y2="24" className="relmovl-axis"/>
      <polyline points={graphLine} className="relmovl-connector"/>
      {coordinates.map((point, index) => <g key={index}><line x1="38" y1={point.y} x2={point.x} y2={point.y} className="relmovl-grid"/><circle cx={point.x} cy={point.y} r="5" className="relmovl-point"/><text x="8" y={point.y + 4}>{offsets[index]}</text><text x={point.x - 3} y="153">{index}</text></g>)}
      <text className="relmovl-y-axis-title" x="42" y="17">Δ{axis} {t.axisY}</text><text x="168" y="178">{t.axisX}</text>
    </svg>
    <p><strong>{t.rule}</strong></p>
    <section className="relmovl-preflight" aria-labelledby="relmovl-preflight-title" aria-live="polite">
      <h5 id="relmovl-preflight-title">{t.preflightTitle}{project && ` · ${project.tool.mode === "fork" ? t.activeFork : t.activeMagnet}`}</h5>
      {!targetChecks && <p>{modelError ? t.preflightUnavailable : t.preflightWaiting}</p>}
      {targetChecks && <>
        <ol>{targetChecks.map((check) => <li key={check.name} className={`relmovl-check-${check.status}`}><strong>{check.name}</strong><span>{check.detail}</span></li>)}</ol>
        <p className={`relmovl-preflight-summary ${targetChecks.every((check) => check.status === "pass") ? "is-pass" : "is-fail"}`}>{targetChecks.every((check) => check.status === "pass") ? t.preflightAllPass : t.preflightFirstFail}</p>
      </>}
      <p className="relmovl-preflight-caveat">{t.preflightCaveat}</p>
    </section>
    <p className="relmovl-example-note">{t.motionOnly}</p>
    <div className="relmovl-examples">
      <div><div className="relmovl-example-heading"><strong>{t.lua}</strong><button type="button" className="relmovl-copy-button" onClick={() => void copyCode(lua)}>{t.copyCode} · Lua</button></div><p className="relmovl-scroll-hint">{t.scrollHint}</p><pre role="region" aria-label={t.luaCode} tabIndex={0}><code>{lua}</code></pre></div>
      <div><div className="relmovl-example-heading"><strong>{t.pythonTitle}</strong><button type="button" className="relmovl-copy-button" onClick={() => void copyCode(python)}>{t.copyCode} · Python</button></div><p>{t.python}</p><p className="relmovl-scroll-hint">{t.scrollHint}</p><pre role="region" aria-label={t.pythonCode} tabIndex={0}><code>{python}</code></pre></div>
    </div>
    {copyResult && <p className="relmovl-copy-status" role="status" aria-live="polite">{copyResult === "copied" ? t.copied : t.copyFailed}</p>}
    <p className="relmovl-note">{t.frame}</p>
  </section>;
}
