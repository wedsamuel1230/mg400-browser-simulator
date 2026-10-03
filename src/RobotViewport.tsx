import { useEffect, useRef, useState } from "react";
import { AlertTriangle, Crosshair, LoaderCircle } from "lucide-react";
import { cellBlockSize, type JointAngles, type Pose, type ProjectDocument } from "./domain";
import { MODEL_PALETTE, ROBOT_COLOR_GROUPS } from "./sim/modelPalette";
import { SimulatorScene, type LocalToolMeshes, type SceneStatus } from "./sim/SimulatorScene";
import { localizeWorkspaceMessage } from "./localizeWorkspaceMessage";

type Props = {
  joints: JointAngles;
  project: ProjectDocument;
  blockPosition: { x: number; y: number };
  attached: boolean;
  attachedCellBlockId?: string | null;
  target: Pose | null;
  cameraResetToken: number;
  localToolMeshes?: LocalToolMeshes;
  urdfXml: string | null;
  modelError?: string | null;
  uiLanguage?: "zh-Hant" | "en";
  placementArmed?: boolean;
  onTablePlace?: (position: { x: number; y: number }) => void;
  onTableNudge?: (dx: number, dy: number) => void;
  onTableCancel?: () => void;
  onTableConfirm?: () => void;
};

export function RobotViewport({ joints, project, blockPosition, attached, attachedCellBlockId, target, cameraResetToken, localToolMeshes, urdfXml, modelError, uiLanguage = "en", placementArmed = false, onTablePlace, onTableNudge, onTableCancel, onTableConfirm }: Props) {
  const body1 = project.tool.mode === "fork" && localToolMeshes?.blockProfile === "body1" && project.scene.blocks.some((block) => !block.kind || block.kind === "block");
  const size = cellBlockSize(project.scene.blocks[0], project.tool.mode);
  const workpieceName = body1 ? (uiLanguage === "zh-Hant" ? "槽積木 (Body1) · 40 × 40 × 40 mm" : "Grooved block (Body1) · 40 × 40 × 40 mm") : `${size.x} × ${size.y} × ${size.z} mm ${uiLanguage === "zh-Hant" ? (size.z === 4 ? "磁吸片 · 座高 20 mm，取件 Z24" : "工件") : (size.z === 4 ? "magnetic plate · 20 mm stand, contact Z24" : "workpiece")}`;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<SimulatorScene | undefined>(undefined);
  const latest = useRef({ joints, project, blockPosition, attached, attachedCellBlockId, target, localToolMeshes });
  const [status, setStatus] = useState<SceneStatus>({ kind: "loading", message: "Preparing viewport…" });
  const pointerStart = useRef<{ x: number; y: number } | null>(null);
  latest.current = { joints, project, blockPosition, attached, attachedCellBlockId, target, localToolMeshes };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (modelError) {
      setStatus({ kind: "error", message: modelError });
      return;
    }
    if (!canvas || !urdfXml) return;
    let alive = true;
    let created: SimulatorScene | undefined;
    void SimulatorScene.create(canvas, urdfXml, (nextStatus) => { if (alive) setStatus(nextStatus); }).then((scene) => {
      if (!alive) {
        scene.dispose();
        return;
      }
      created = scene;
      sceneRef.current = scene;
      scene.setState(latest.current);
      if (latest.current.localToolMeshes) scene.setLocalToolMeshes(latest.current.localToolMeshes);
    }).catch(() => undefined);
    return () => {
      alive = false;
      sceneRef.current = undefined;
      created?.dispose();
    };
  }, [urdfXml, modelError]);

  useEffect(() => {
    if (localToolMeshes) sceneRef.current?.setLocalToolMeshes(localToolMeshes);
  }, [localToolMeshes]);

  useEffect(() => {
    sceneRef.current?.setState({ joints, project, blockPosition, attached, attachedCellBlockId, target });
  }, [joints, project, blockPosition, attached, attachedCellBlockId, target]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !placementArmed) return;
    canvas.scrollIntoView({ behavior: "auto", block: "start" });
    window.setTimeout(() => {
      const top = canvas.getBoundingClientRect().top + window.scrollY;
      window.scrollTo({ top: Math.max(0, top - 68), behavior: "auto" });
    }, 120);
    canvas.focus({ preventScroll: true });
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); onTableCancel?.(); return; }
      if (event.key === "Enter") { event.preventDefault(); onTableConfirm?.(); return; }
      const step = event.shiftKey ? 10 : 2;
      const delta = event.key === "ArrowLeft" ? [-step, 0] : event.key === "ArrowRight" ? [step, 0] : event.key === "ArrowUp" ? [0, step] : event.key === "ArrowDown" ? [0, -step] : null;
      if (delta) { event.preventDefault(); onTableNudge?.(delta[0], delta[1]); }
    };
    const onPointerDown = (event: PointerEvent) => { pointerStart.current = { x: event.clientX, y: event.clientY }; };
    const onPointerUp = (event: PointerEvent) => {
      const start = pointerStart.current;
      pointerStart.current = null;
      if (!start || Math.hypot(event.clientX - start.x, event.clientY - start.y) > 6) return;
      const position = sceneRef.current?.tablePositionFromPointer(event.clientX, event.clientY);
      if (position) onTablePlace?.(position);
    };
    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("pointerup", onPointerUp);
    canvas.addEventListener("keydown", onKeyDown);
    return () => { canvas.removeEventListener("pointerdown", onPointerDown); canvas.removeEventListener("pointerup", onPointerUp); canvas.removeEventListener("keydown", onKeyDown); };
  }, [placementArmed, onTablePlace, onTableNudge, onTableCancel, onTableConfirm]);

  useEffect(() => {
    if (cameraResetToken > 0) sceneRef.current?.resetCamera();
  }, [cameraResetToken]);

  return (
    <div className="viewport-shell" role="region" aria-label={uiLanguage === "zh-Hant" ? "互動式 MG400 三維模擬" : "Interactive 3D MG400 simulation"}>
      <canvas ref={canvasRef} tabIndex={placementArmed ? 0 : -1} className={`robot-canvas${placementArmed ? " placement-armed" : ""}`} aria-label={placementArmed ? (uiLanguage === "zh-Hant" ? "已聚焦工作台；方向鍵移動，Enter 放置，Escape 取消" : "Worktable focused; arrows move, Enter places, Escape cancels") : (uiLanguage === "zh-Hant" ? "MG400 機械臂、工作台及工件" : "3D MG400 robot, work table, and block")} />
      {placementArmed && <div className="placement-hud" role="status"><strong>{uiLanguage === "zh-Hant" ? "工作台擺放模式" : "Table placement mode"}</strong><span>{uiLanguage === "zh-Hant" ? "點擊工作台放置；方向鍵移動，Enter 確認，Escape 取消。" : "Click the table to place; arrows move, Enter confirms, Escape cancels."}</span><button type="button" onClick={onTableCancel}>{uiLanguage === "zh-Hant" ? "取消／返回物件" : "Cancel / back to object"}</button></div>}
      <div className="viewport-hud viewport-hud-top">
        <div className="hud-chip"><span className="live-dot" /> {uiLanguage === "zh-Hant" ? "即時模擬" : "LIVE SIMULATION"}</div>
        <div className="hud-chip muted-chip">{uiLanguage === "zh-Hant" ? "毫米 · 度 · Z 向上" : "MM · DEG · Z-UP"}</div>
      </div>
      <details className="model-color-guide">
        <summary>{uiLanguage === "zh-Hant" ? "模型顏色" : "Model colors"}</summary>
        <ul>
          {ROBOT_COLOR_GROUPS.map((group) => <li key={group.id}>
            <span className="model-swatch-group" aria-hidden="true">{group.colors.map((color) => <span key={color} className="model-swatch" style={{ backgroundColor: color }} />)}</span>
            {uiLanguage === "zh-Hant" ? ({ Base: "底座", Shoulder: "肩部", "Arms and linkage": "手臂及連桿", "Wrist and flange": "腕部及法蘭" }[group.label] ?? group.label) : group.label}
          </li>)}
          <li><span className="model-swatch-group" aria-hidden="true"><span className="model-swatch" style={{ backgroundColor: MODEL_PALETTE[project.tool.mode] }} /></span>{uiLanguage === "zh-Hant" ? "目前工具：" : "Active tool: "}{project.tool.mode === "magnet" ? (uiLanguage === "zh-Hant" ? "磁吸工具" : "Magnetic pickup tool") : (uiLanguage === "zh-Hant" ? "無動力叉臂" : "Passive fork")}</li>
          <li><span className="model-swatch-group" aria-hidden="true"><span className="model-swatch" style={{ backgroundColor: MODEL_PALETTE.tcp }} /></span>{uiLanguage === "zh-Hant" ? "TCP 參考" : "TCP reference"}</li>
          <li><span className="model-swatch-group" aria-hidden="true"><span className="model-swatch" style={{ backgroundColor: MODEL_PALETTE.target }} /><span className="model-swatch" style={{ backgroundColor: MODEL_PALETTE.targetCenter }} /></span>{uiLanguage === "zh-Hant" ? "所選示教點" : "Selected point"}</li>
          <li><span className="model-swatch-group" aria-hidden="true"><span className="model-swatch" style={{ backgroundColor: MODEL_PALETTE.block }} /></span>{workpieceName}</li>
        </ul>
        <p>{uiLanguage === "zh-Hant" ? "訓練色彩會覆蓋供應商幾何以便示教，不代表出廠塗裝。" : "Training palette overlays the vendor geometry for teaching; it does not represent factory paint."}</p>
      </details>
      <div className="viewport-hud viewport-hud-bottom">
        <div className="scene-caption"><Crosshair size={15} /><span>{project.scene.blocks.length === 0 ? (uiLanguage === "zh-Hant" ? "空工作台 · 可自由加入工件" : "Empty table · add a workpiece") : workpieceName}</span></div>
        <span className="scene-controls">{uiLanguage === "zh-Hant" ? "拖曳旋轉 · 滾動縮放" : "Drag to orbit · scroll to zoom"}</span>
      </div>
      {status.kind !== "ready" && (
        <div className={`viewport-overlay ${status.kind === "error" ? "error-overlay" : ""}`} role="status">
          {status.kind === "loading" ? <LoaderCircle className="spin" size={23} /> : <AlertTriangle size={23} />}
          <div><strong>{status.kind === "loading" ? (uiLanguage === "zh-Hant" ? "正在載入機械臂模型" : "Loading robot model") : (uiLanguage === "zh-Hant" ? "無法載入機械臂模型" : "Model could not load")}</strong><span>{status.kind === "loading" && uiLanguage === "zh-Hant" ? `正在準備三維工作格…${status.progress === undefined ? "" : ` ${status.progress}%`}` : status.kind === "loading" ? `${status.message ?? "Preparing the 3D workcell…"}${status.progress === undefined ? "" : ` ${status.progress}%`}` : localizeWorkspaceMessage(status.message ?? "", uiLanguage)}</span>
            {status.kind === "loading" && <div className="viewport-loading-progress" role="progressbar" aria-label={uiLanguage === "zh-Hant" ? "模型載入進度" : "Model loading progress"} aria-valuemin={0} aria-valuemax={100} aria-valuenow={status.progress ?? 0}><span style={{ width: `${status.progress ?? 0}%` }} /></div>}
          </div>
        </div>
      )}
    </div>
  );
}
