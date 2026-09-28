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
};

export function RobotViewport({ joints, project, blockPosition, attached, attachedCellBlockId, target, cameraResetToken, localToolMeshes }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<SimulatorScene | undefined>(undefined);
  const latest = useRef({ joints, project, blockPosition, attached, attachedCellBlockId, target });
  const [status, setStatus] = useState<SceneStatus>({ kind: "loading", message: "Preparing viewport…" });
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
    if (cameraResetToken > 0) sceneRef.current?.resetCamera();
  }, [cameraResetToken]);

  return (
    <div className="viewport-shell" role="region" aria-label="Interactive 3D MG400 simulation">
      <canvas ref={canvasRef} className="robot-canvas" aria-label="3D MG400 robot, work table, and block" />
      <div className="viewport-hud viewport-hud-top">
        <div className="hud-chip"><span className="live-dot" /> LIVE SIMULATION</div>
        <div className="hud-chip muted-chip">MM · DEG · Z-UP</div>
      </div>
      <details className="model-color-guide">
        <summary>Model colors</summary>
        <ul>
          {ROBOT_COLOR_GROUPS.map((group) => <li key={group.id}>
            <span className="model-swatch-group" aria-hidden="true">{group.colors.map((color) => <span key={color} className="model-swatch" style={{ backgroundColor: color }} />)}</span>
            {group.label}
          </li>)}
          <li><span className="model-swatch-group" aria-hidden="true"><span className="model-swatch" style={{ backgroundColor: MODEL_PALETTE[project.tool.mode] }} /></span>Active tool: {project.tool.mode === "magnet" ? "Magnet" : "Fork"}</li>
          <li><span className="model-swatch-group" aria-hidden="true"><span className="model-swatch" style={{ backgroundColor: MODEL_PALETTE.tcp }} /></span>TCP reference</li>
          <li><span className="model-swatch-group" aria-hidden="true"><span className="model-swatch" style={{ backgroundColor: MODEL_PALETTE.target }} /><span className="model-swatch" style={{ backgroundColor: MODEL_PALETTE.targetCenter }} /></span>Selected point</li>
          <li><span className="model-swatch-group" aria-hidden="true"><span className="model-swatch" style={{ backgroundColor: MODEL_PALETTE.block }} /></span>40 × 40 × 15 mm workpiece</li>
        </ul>
        <p>Training palette overlays the vendor geometry for teaching; it does not represent factory paint.</p>
      </details>
      <div className="viewport-hud viewport-hud-bottom">
        <div className="scene-caption"><Crosshair size={15} /><span>Reference cell · 40 × 40 × 15 mm workpiece</span></div>
        <span className="scene-controls">Drag to orbit · scroll to zoom</span>
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
