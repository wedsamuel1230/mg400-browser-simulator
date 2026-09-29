import { useEffect, useRef, useState } from "react";
import { AlertTriangle, Crosshair, LoaderCircle } from "lucide-react";
import type { JointAngles, Pose, ProjectDocument } from "./domain";
import { MODEL_PALETTE, ROBOT_COLOR_GROUPS } from "./sim/modelPalette";
import { SimulatorScene, type LocalToolMeshes, type SceneStatus } from "./sim/SimulatorScene";

type Props = {
  joints: JointAngles;
  project: ProjectDocument;
  blockPosition: { x: number; y: number };
  attached: boolean;
  attachedCellBlockId?: string | null;
  target: Pose | null;
  cameraResetToken: number;
  localToolMeshes?: LocalToolMeshes;
  uiLanguage?: "zh-Hant" | "en";
  placementArmed?: boolean;
  onTablePlace?: (position: { x: number; y: number }) => void;
  onTableNudge?: (dx: number, dy: number) => void;
  onTableCancel?: () => void;
  onTableConfirm?: () => void;
};

export function RobotViewport({ joints, project, blockPosition, attached, attachedCellBlockId, target, cameraResetToken, localToolMeshes, uiLanguage = "en", placementArmed = false, onTablePlace, onTableNudge, onTableCancel, onTableConfirm }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<SimulatorScene | undefined>(undefined);
  const latest = useRef({ joints, project, blockPosition, attached, attachedCellBlockId, target });
  const [status, setStatus] = useState<SceneStatus>({ kind: "loading", message: "Preparing viewport…" });
  const pointerStart = useRef<{ x: number; y: number } | null>(null);
  latest.current = { joints, project, blockPosition, attached, attachedCellBlockId, target };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let alive = true;
    let created: SimulatorScene | undefined;
    void SimulatorScene.create(canvas, setStatus, localToolMeshes).then((scene) => {
      if (!alive) {
        scene.dispose();
        return;
      }
      created = scene;
      sceneRef.current = scene;
      scene.setState(latest.current);
      setStatus({ kind: "ready" });
    }).catch(() => undefined);
    return () => {
      alive = false;
      sceneRef.current = undefined;
      created?.dispose();
    };
  }, [localToolMeshes]);

  useEffect(() => {
    sceneRef.current?.setState({ joints, project, blockPosition, attached, attachedCellBlockId, target });
  }, [joints, project, blockPosition, attached, attachedCellBlockId, target]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !placementArmed) return;
    canvas.scrollIntoView({ behavior: "smooth", block: "center" });
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
    <div className="viewport-shell" role="region" aria-label="Interactive 3D MG400 simulation">
      <canvas ref={canvasRef} tabIndex={placementArmed ? 0 : -1} className={`robot-canvas${placementArmed ? " placement-armed" : ""}`} aria-label={placementArmed ? (uiLanguage === "zh-Hant" ? "已聚焦工作台；方向鍵移動，Enter 放置，Escape 取消" : "Worktable focused; arrows move, Enter places, Escape cancels") : "3D MG400 robot, work table, and block"} />
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
            {group.label}
          </li>)}
          <li><span className="model-swatch-group" aria-hidden="true"><span className="model-swatch" style={{ backgroundColor: MODEL_PALETTE[project.tool.mode] }} /></span>{uiLanguage === "zh-Hant" ? "目前工具：" : "Active tool: "}{project.tool.mode === "magnet" ? (uiLanguage === "zh-Hant" ? "磁吸" : "Magnet") : (uiLanguage === "zh-Hant" ? "叉" : "Fork")}</li>
          <li><span className="model-swatch-group" aria-hidden="true"><span className="model-swatch" style={{ backgroundColor: MODEL_PALETTE.tcp }} /></span>{uiLanguage === "zh-Hant" ? "TCP 參考" : "TCP reference"}</li>
          <li><span className="model-swatch-group" aria-hidden="true"><span className="model-swatch" style={{ backgroundColor: MODEL_PALETTE.target }} /><span className="model-swatch" style={{ backgroundColor: MODEL_PALETTE.targetCenter }} /></span>{uiLanguage === "zh-Hant" ? "所選示教點" : "Selected point"}</li>
          <li><span className="model-swatch-group" aria-hidden="true"><span className="model-swatch" style={{ backgroundColor: MODEL_PALETTE.block }} /></span>40 × 40 × 15 mm {uiLanguage === "zh-Hant" ? "工件" : "workpiece"}</li>
        </ul>
        <p>{uiLanguage === "zh-Hant" ? "訓練色彩會覆蓋供應商幾何以便示教，不代表出廠塗裝。" : "Training palette overlays the vendor geometry for teaching; it does not represent factory paint."}</p>
      </details>
      <div className="viewport-hud viewport-hud-bottom">
        <div className="scene-caption"><Crosshair size={15} /><span>{uiLanguage === "zh-Hant" ? "參考工作格 · 40 × 40 × 15 mm 工件" : "Reference cell · 40 × 40 × 15 mm workpiece"}</span></div>
        <span className="scene-controls">{uiLanguage === "zh-Hant" ? "拖曳旋轉 · 滾動縮放" : "Drag to orbit · scroll to zoom"}</span>
      </div>
      {status.kind !== "ready" && (
        <div className={`viewport-overlay ${status.kind === "error" ? "error-overlay" : ""}`} role="status">
          {status.kind === "loading" ? <LoaderCircle className="spin" size={23} /> : <AlertTriangle size={23} />}
          <div><strong>{status.kind === "loading" ? "Loading robot model" : "Model could not load"}</strong><span>{status.message}</span></div>
        </div>
      )}
    </div>
  );
}
