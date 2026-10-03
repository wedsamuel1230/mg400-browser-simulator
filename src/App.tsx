import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { readWorkspaceTheme, saveWorkspaceTheme, type WorkspaceTheme } from "./theme";
import {
  Activity,
  AlertCircle,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Box,
  BookOpenCheck,
  ChevronDown,
  Check,
  Code2,
  Crosshair,
  Download,
  Gauge,
  HardDrive,
  LoaderCircle,
  Moon,
  Sun,
  Maximize2,
  Pause,
  Play,
  Plus,
  RotateCcw,
  Save,
  Sparkles,
  Settings2,
  Square,
  Target,
  Trash2,
  Upload,
  Wrench,
} from "lucide-react";
import {
  cellBlockSize,
  cellBlockTopZ,
  platformHeight,
  magneticSurfaceHeight,
  FORK_SUPPORT_HEIGHT_MM,
  BODY1_FORK_CONTACT,
  effectiveForkContactProfile,
  forkProfileAfterImport,
  type ForkContactProfile,
  activeTcpOffset,
  getStarterProgram,
  JOINT_LIMITS_DEG,
  deg,
  rad,
  type JointAngles,
  type BlockColor,
  type BlockSource,
  type CellObjectKind,
  type CellBlock,
  type Pose,
  type ProjectDocument,
  type TeachPoint,
} from "./domain";
import {
  exportProject,
  loadProject,
  containsRemovedRoundWorkpieces,
  STORAGE_KEY,
  makeCartesianPoint,
  makeJointPoint,
  parseProjectFile,
  saveProject,
} from "./projectStore";
import { assessRobotTask, newTaskEvidence, observeTaskFrame } from "./sim/taskAssessment";
import { SimulationController, type RunStatus } from "./sim/SimulationController";
import type { LocalToolMeshes } from "./sim/SimulatorScene";
import type { MG400Kinematics } from "./sim/mg400Kinematics";
import { TrainingCenter } from "./training/TrainingCenter";
import { LESSONS } from "./training/curriculum";
import { DEFAULT_PROJECT } from "./data/defaultProject";
import type { ProgramLanguage } from "./domain";
import { recommendPickAndPlace, recommendedProgram } from "./sim/codeRecommendation";
import { FORK_INSERTION_DISTANCE_MM, forkContactPose, forkEntryPose } from "./sim/forkTool";
import { DEFAULT_CELL_BLOCKS, resetCell } from "./sim/multiBlockCell";
import { CodeAssistant } from "./CodeAssistant";
import { getRovingFocusIndex } from "./accessibility/rovingFocus";
import { isLikelyStl } from "./sim/toolImport";
import { localizeWorkspaceMessage } from "./localizeWorkspaceMessage";

const Editor = lazy(async () => {
  const [editorModule, monaco] = await Promise.all([import("@monaco-editor/react"), import("monaco-editor")]);
  editorModule.loader.config({ monaco });
  return { default: editorModule.default };
});
const RobotViewport = lazy(async () => ({ default: (await import("./RobotViewport")).RobotViewport }));

type LogEntry = { id: string; time: string; message: string; level: "info" | "warning" | "error" };
type NumericFieldProps = {
  label: string;
  value: number;
  suffix?: string;
  step?: number;
  min?: number;
  max?: number;
  disabled?: boolean;
  onChange: (value: number) => void;
};

const initialProject = loadProject();
const FREE_MODE_KEY = "mg400-free-mode-v1";
const FREE_SCENE_KEY = "mg400-free-scene-v1";
const GUIDED_SCENE_KEY = "mg400-guided-scene-v1";
const UI_LANGUAGE_KEY = "mg400-ui-language-v1";
const initialHome = initialProject.points.find((point) => point.name === "Home" && point.kind === "joint");
const initialJoints: JointAngles = initialHome?.kind === "joint"
  ? [...initialHome.joints]
  : [rad(0), rad(30), rad(45), rad(0)];

function NumericField({ label, value, suffix, step = 1, min, max, disabled = false, onChange }: NumericFieldProps) {
  const name = `simulator-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`;
  return (
    <label className="numeric-field">
      <span>{label}</span>
      <div className="numeric-input-wrap">
        <input
          name={name}
          aria-label={label}
          type="number"
          value={Number.isFinite(value) ? Number(value.toFixed(2)) : 0}
          step={step}
          min={min}
          max={max}
          disabled={disabled}
          onChange={(event) => {
            const number = Number(event.target.value);
            if (Number.isFinite(number)) onChange(number);
          }}
        />
        {suffix && <small>{suffix}</small>}
      </div>
    </label>
  );
}

function format(value: number, places = 1) {
  return Number.isFinite(value) ? value.toFixed(places) : "—";
}

function getPointPose(point: TeachPoint | undefined, kin: MG400Kinematics | null, project: ProjectDocument): Pose | null {
  if (!point) return null;
  if (point.kind === "cartesian") return point.pose;
  return kin?.forward(point.joints, project.tool.flangeOffset, activeTcpOffset(project.tool)) ?? null;
}

function editorOptions(ariaLabel: string) {
  return {
    automaticLayout: true,
    ariaLabel,
    fontFamily: "'SFMono-Regular', 'Cascadia Code', 'Roboto Mono', monospace",
    fontSize: 16,
    lineHeight: 26,
    minimap: { enabled: false },
    padding: { top: 16, bottom: 18 },
    scrollBeyondLastLine: false,
    smoothScrolling: true,
    wordWrap: "on" as const,
    tabSize: 2,
    renderLineHighlight: "gutter" as const,
    overviewRulerBorder: false,
    lineNumbersMinChars: 3,
    glyphMargin: false,
  };
}

function editorBeforeMount(monaco: typeof import("monaco-editor")) {
  if (!monaco.languages.getLanguages().some((language) => language.id === "lua")) {
    monaco.languages.register({ id: "lua" });
    monaco.languages.setMonarchTokensProvider("lua", {
      keywords: ["and", "break", "do", "else", "elseif", "end", "false", "for", "function", "goto", "if", "in", "local", "nil", "not", "or", "repeat", "return", "then", "true", "until", "while"],
      tokenizer: {
        root: [
          [/--.*$/, "comment"],
          [/[a-zA-Z_][\w]*/, { cases: { "@keywords": "keyword", "@default": "identifier" } }],
          [/[{}()[\]]/, "@brackets"],
          [/[0-9]+(\.[0-9]+)?/, "number"],
          [/"([^"\\]|\\.)*$/, "string.invalid"],
          [/"([^"\\]|\\.)*"/, "string"],
          [/'([^'\\]|\\.)*$/, "string.invalid"],
          [/'([^'\\]|\\.)*'/, "string"],
          [/[=<>~!]+/, "operator"],
        ],
      },
    });
  }
  if (!monaco.languages.getLanguages().some((language) => language.id === "python")) {
    monaco.languages.register({ id: "python" });
    monaco.languages.setMonarchTokensProvider("python", {
      keywords: ["and", "as", "assert", "async", "await", "break", "class", "continue", "def", "del", "elif", "else", "except", "finally", "for", "from", "global", "if", "import", "in", "is", "lambda", "nonlocal", "not", "or", "pass", "raise", "return", "try", "while", "with", "yield"],
      tokenizer: {
        root: [
          [/#.*$/, "comment"],
          [/\b(?:True|False|None)\b/, "constant"],
          [/[a-zA-Z_][\w]*(?=\s*\()/, "function"],
          [/[a-zA-Z_][\w]*/, { cases: { "@keywords": "keyword", "@default": "identifier" } }],
          [/[{}()[\]]/, "@brackets"],
          [/[0-9]+(\.[0-9]+)?/, "number"],
          [/"""[^]*?"""|'''[^]*?'''/, "string"],
          [/"([^"\\]|\\.)*$/, "string.invalid"],
          [/"([^"\\]|\\.)*"/, "string"],
          [/'([^'\\]|\\.)*$/, "string.invalid"],
          [/'([^'\\]|\\.)*'/, "string"],
          [/[:.,]/, "delimiter"],
          [/[=<>!+\-*/%]+/, "operator"],
        ],
      },
    });
  }
  monaco.editor.defineTheme("mg400-light", { base: "vs", inherit: true, rules: [{ token: "comment", foreground: "477540" }], colors: { "editor.background": "#ffffff" } });
  monaco.editor.defineTheme("mg400-dark", {
    base: "vs-dark",
    inherit: true,
    rules: [{ token: "comment", foreground: "71975F" }],
    colors: { "editor.background": "#1E1E1E" },
  });
}

export default function App() {
  const taskEvidenceRef = useRef(newTaskEvidence());
  const taskStartProjectRef = useRef<ProjectDocument | null>(null);
  const [convertedRoundPieces, setConvertedRoundPieces] = useState(() => { try { return containsRemovedRoundWorkpieces(JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "null")); } catch { return false; } });
  const [workspaceTheme, setWorkspaceTheme] = useState<WorkspaceTheme>(readWorkspaceTheme);
  useEffect(() => { document.documentElement.dataset.theme = workspaceTheme; document.documentElement.style.colorScheme = workspaceTheme; }, [workspaceTheme]);
  const [project, setProject] = useState<ProjectDocument>(initialProject);
  const [joints, setJoints] = useState<JointAngles>(initialJoints);
  const [blockPosition, setBlockPosition] = useState({ ...initialProject.scene.block });
  const [attached, setAttached] = useState(false);
  const [attachedCellBlockId, setAttachedCellBlockId] = useState<string | null>(null);
  const attachedCellBlockIdRef = useRef<string | null>(null);
  const [cellBlocks, setCellBlocks] = useState(() => structuredClone(initialProject.scene.blocks));
  const [selectedId, setSelectedId] = useState<string | null>(initialProject.points[0]?.id ?? null);
  const [kinematics, setKinematics] = useState<MG400Kinematics | null>(null);
  const [kinematicsUrdf, setKinematicsUrdf] = useState<string | null>(null);
  const [modelError, setModelError] = useState("");
  const [failedToolModels, setFailedToolModels] = useState<string[]>([]);
  const [status, setStatus] = useState<RunStatus>("ready");
  const [lastRunContext, setLastRunContext] = useState<string | null>(null);
  const [latestPrintOutput, setLatestPrintOutput] = useState<string | null>(null);
  const [programRunLog, setProgramRunLog] = useState<LogEntry[]>([]);
  const activeProgramRunRef = useRef(false);
  const [logs, setLogs] = useState<LogEntry[]>([
    { id: "welcome", time: "READY", message: "Local simulator ready. No robot hardware is connected.", level: "info" },
  ]);
  const [outputs, setOutputs] = useState<Record<number, boolean>>({ 1: false });
  const [saved, setSaved] = useState(true);
  const [showToolSettings, setShowToolSettings] = useState(false);
  const [showWorkshop, setShowWorkshop] = useState(false);
  const [workbenchView, setWorkbenchView] = useState<"practice" | "program" | "points" | "objects" | "settings">("practice");
  const [practiceLessonId, setPracticeLessonId] = useState<string | null>(null);
  const [practicePrepared, setPracticePrepared] = useState(false);
  const [runLessonCue, setRunLessonCue] = useState(false);
  const runButtonRef = useRef<HTMLButtonElement>(null);
  const [showTraining, setShowTraining] = useState(false);
  const [freeMode, setFreeMode] = useState(() => window.localStorage.getItem(FREE_MODE_KEY) === "true");
  const [freeSelectedId, setFreeSelectedId] = useState<string | null>(null);
  const [placementArmed, setPlacementArmed] = useState(false);
  const [placementMessage, setPlacementMessage] = useState("");
  const [uiLanguage, setUiLanguage] = useState<"zh-Hant" | "en">(() => window.localStorage.getItem(UI_LANGUAGE_KEY) === "en" ? "en" : "zh-Hant");
  const guidedSceneRef = useRef<ProjectDocument["scene"] | null>(null);
  const ui = uiLanguage === "zh-Hant" ? {
    subtitle: "MG400 虛擬訓練工作格", title: "取放 · 訓練工作格 01", local: "僅限本機", training: "訓練中心", lesson: "開始第 1 課",
    guided: "訓練模式", free: "自由模式", import: "匯入專案", export: "匯出專案", chooseLesson: "選課", loadExample: "載入範例", run: "執行程式", seeResult: "查看結果",
    tool: "工具與取件", everyday: "日常操作", advanced: "進階設定", calibration: "校準、容差及模型匯入",
    language: "切換介面語言", pause: "暫停模擬", resume: "繼續模擬", stop: "停止模擬", resetRobot: "重設機械臂與工作格",
    teachPoints: "示教點", jointPoint: "儲存關節點", deletePoint: "刪除示教點", jogControls: "點動及示教點控制",
    cartesianStep: "笛卡兒點動步距（毫米）", jointStep: "關節點動步距（度）",
    programmingLanguage: "程式語言", exportProject: "匯出專案", toolMeshTitle: "工具外觀模型",
    toolMeshDescription: "磁吸工具、無動力叉臂及槽積木會自動載入，毋須手動匯入。你亦可匯入其他 STL；自訂檔案只留在此瀏覽器，不會加入專案匯出。",
    importMagnet: "匯入磁吸工具 STL", importFork: "匯入叉臂工具 STL", activeTool: "目前工具",
    flangeToTcp: "法蘭至 TCP", robotWrist: "機械臂腕部", flange: "法蘭", toolLocalX: "工具局部 +X",
    flangeExplanation: "法蘭：安裝工具的機械臂端面。TCP：移動指令所到達的工具參考點。圖示沿工具自身 X 軸，不代表螢幕方向。",
    toolBehavior: "工具安裝於法蘭下方。模擬器以規則處理拾取：叉臂滑入方塊下方並抬起後連接工件，放回支撐墊時釋放。這不是接觸或抓取物理模型；程式不會連接實體機械臂。磁吸工具的 DO1 也只供模擬。",
    flangeOffset: "法蘭偏移", magnetTcp: "磁吸接觸 TCP", forkTcp: "叉臂支撐 TCP", pickupTolerance: "拾取容差", referencePositions: "參考工作格位置",
    cellState: "多工件工作格狀態", multiBlockCell: "多工件工作格", feederOrder: "供料次序", supplyBlock: "加入供料方塊",
    cellStateNote: "顏色及供料次序是預設的模擬狀態；沒有攝影機、顏色感測器或視覺辨識功能。",
    toolModeChanged: "執行前請重新示教拾取及放置點組。",
    freeCellHeading: "自由模式 · 自訂工作格", guidedCellHeading: "訓練模式 · 導引工作格",
    freeCellDescription: "可加入、移動、刪除方塊或35×35×4 mm 磁吸片；位置以 mm 儲存。", guidedCellDescription: "課程任務使用固定教學供料；切換到自由模式可另存自訂工作格。",
    simulationOnly: "僅供模擬", vendorModelLocalLua: "MG400 供應商外觀模型 · 本機 Lua · 未連接硬體",
    limitsSource: "關節限制依據 Dobot MG400 User Guide V1.7",
    modelLoadHeading: "MG400 模型載入失敗",
    modelLoadDetail: "無法載入隨附的 MG400 運動學模型。",
  } : {
    subtitle: "MG400 VIRTUAL TRAINING CELL", title: "Pick & place · Training cell 01", local: "LOCAL ONLY", training: "Training", lesson: "Start lesson 1", guided: "Training mode", free: "Free mode", import: "Import project", export: "Export project", chooseLesson: "Choose a lesson", loadExample: "Load example", run: "Run program", seeResult: "See result", tool: "Tool & pickup", everyday: "Everyday controls", advanced: "Advanced settings", calibration: "Calibration, tolerance and model import",
    language: "Switch interface language", pause: "Pause simulation", resume: "Resume simulation", stop: "Stop simulation", resetRobot: "Reset robot pose and cell",
    teachPoints: "Teach points", jointPoint: "Save a joint point", deletePoint: "Delete teach point", jogControls: "Jog and point controls",
    cartesianStep: "Cartesian jog step in millimetres", jointStep: "Joint jog step in degrees",
    programmingLanguage: "Programming language", exportProject: "Export project", toolMeshTitle: "Tool visual mesh",
    toolMeshDescription: "The magnetic tool, passive fork and grooved block load automatically. You can also import another STL; custom files stay in this browser and are not saved in project export.",
    importMagnet: "Import local magnet STL", importFork: "Import local fork STL", activeTool: "Active tool",
    flangeToTcp: "Flange to TCP", robotWrist: "Robot wrist", flange: "Flange", toolLocalX: "tool-local +X",
    flangeExplanation: "Flange: the robot face where the tool mounts. TCP: the tool reference point that motion commands target. This diagram is along the tool's own X axis, not the screen.",
    toolBehavior: "The printed tool mounts below the flange. In this simulator, the passive fork attaches the block after it slides underneath and lifts it, then releases it when lowered onto the pads. This is a simulated motion rule, not contact or grasp physics; the app has no hardware connection. Magnet DO1 is also simulator-only.",
    flangeOffset: "Flange offset", magnetTcp: "Magnet contact TCP", forkTcp: "Fork support TCP", pickupTolerance: "Pickup tolerance", referencePositions: "Reference cell positions",
    cellState: "Multi-block cell state", multiBlockCell: "Multi-block cell", feederOrder: "Feeder order", supplyBlock: "Add supply block",
    cellStateNote: "Colors and feeder order are configured simulation state; no camera, color sensor, or vision claim is made.",
    toolModeChanged: "Re-teach the pick and place pairs before running.",
    freeCellHeading: "Free mode · custom cell", guidedCellHeading: "Training mode · guided cell",
    freeCellDescription: "Add, move, or remove blocks and 35×35×4 mm magnetic plates; positions are stored in mm.", guidedCellDescription: "Lessons use a fixed teaching feeder; switch to Free mode to save a separate custom cell.",
    simulationOnly: "Simulation only", vendorModelLocalLua: "MG400 vendor visual model · local Lua · no hardware connection",
    limitsSource: "Joint limits from Dobot MG400 User Guide V1.7",
    modelLoadHeading: "MG400 model failed to load",
    modelLoadDetail: "Could not load the bundled MG400 kinematic model.",
  };
  const [trainingLessonId, setTrainingLessonId] = useState<string | null>(null);
  const [localToolMeshes, setLocalToolMeshes] = useState<LocalToolMeshes>({});
  const selectedForkProfile = localToolMeshes.blockProfile ?? "reference";
  const forkProfile = effectiveForkContactProfile(selectedForkProfile, project.scene.blocks, project.scene.blocks.find((block) => Math.hypot(block.position.x - project.scene.block.x, block.position.y - project.scene.block.y) <= 1)?.id);
  const localMeshesRef = useRef(localToolMeshes);
  localMeshesRef.current = localToolMeshes;
  const [toolMeshMessage, setToolMeshMessage] = useState(uiLanguage === "zh-Hant" ? "正在載入磁吸工具、無動力叉臂及槽積木…" : "Loading magnetic tool, passive fork and grooved block…");
  const [coachOpen, setCoachOpen] = useState(false);
  const [jogStep, setJogStep] = useState(10);
  const [jointStep, setJointStep] = useState(5);
  const [selectedTab, setSelectedTab] = useState<"points" | "jog">("points");
  const [cameraResetToken, setCameraResetToken] = useState(0);
  const controllerRef = useRef<SimulationController | undefined>(undefined);
  const projectRef = useRef(project);
  const jointsRef = useRef(joints);
  const blockRef = useRef(blockPosition);
  const attachedRef = useRef(attached);
  const cellBlocksRef = useRef(cellBlocks);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const toolMeshInputRef = useRef<HTMLInputElement>(null);
  const toolMeshKindRef = useRef<"magnet" | "fork">("magnet");
  const blockMeshInputRef = useRef<HTMLInputElement>(null);
  projectRef.current = project;
  jointsRef.current = joints;
  blockRef.current = blockPosition;
  attachedRef.current = attached;
  cellBlocksRef.current = cellBlocks;

  const importToolMesh = async (kind: "magnet" | "fork", file: File | undefined) => {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".stl")) {
      setToolMeshMessage(uiLanguage === "zh-Hant" ? "請選擇 STL 檔案。所選檔案不會上傳。" : "Choose an STL file. The selected file is not uploaded anywhere.");
      return;
    }
    const bytes = await file.arrayBuffer();
    if (!isLikelyStl(bytes)) {
      setToolMeshMessage(uiLanguage === "zh-Hant" ? `${file.name} 不是可讀取的 STL（ASCII facet／vertex 或二進位三角面資料）；沒有載入任何內容。` : `${file.name} is not a readable STL (ASCII facet/vertex or binary triangle data). Nothing was loaded.`);
      return;
    }
    setLocalToolMeshes((current) => ({ ...current, [kind]: bytes, bundledFork: kind === "fork" ? false : current.bundledFork, bundledMagnet: kind === "magnet" ? false : current.bundledMagnet, names: { ...current.names, [kind]: file.name }, blockProfile: forkProfileAfterImport(current.blockProfile ?? "reference", kind) }));
    if (kind === "fork") replaceProject((current) => ({ ...current,
      script: current.script === getStarterProgram("lua", "fork", "body1") ? getStarterProgram("lua", "fork") : current.script,
      pythonScript: current.pythonScript === getStarterProgram("python", "fork", "body1") ? getStarterProgram("python", "fork") : current.pythonScript,
    }));
    setToolMeshMessage(uiLanguage === "zh-Hant" ? `已在本機載入${kind === "magnet" ? "磁吸工具" : "叉臂工具"}模型 ${file.name}；不會上傳或加入專案匯出。` : `${kind === "magnet" ? "Magnet" : "Fork"} mesh loaded locally from ${file.name}; it is not uploaded or included in project export.`);
  };

  const importForkBlockMesh = async (file: File | undefined) => {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".stl")) {
      setToolMeshMessage(uiLanguage === "zh-Hant"
        ? "請選擇 STL 檔案。檔案只在目前瀏覽器工作階段載入，不會上傳或加入程式包。"
        : "Choose an STL file. It is loaded only for this browser session, never uploaded or bundled.");
      return;
    }
    const bytes = await file.arrayBuffer();
    if (!isLikelyStl(bytes)) {
      setToolMeshMessage(uiLanguage === "zh-Hant"
        ? `${file.name} 不是可讀取的 STL；保留目前模型，檔案不會上傳。`
        : `${file.name} is not a readable STL. The current model remains active; the file is not uploaded.`);
      return;
    }
    setLocalToolMeshes((current) => ({ ...current, block: bytes, bundledFork: false, names: { ...current.names, block: file.name }, blockProfile: forkProfileAfterImport(current.blockProfile ?? "reference", "block") }));
    replaceProject((current) => ({ ...current,
      script: current.tool.mode === "fork" && current.script === getStarterProgram("lua", "fork", "body1") ? getStarterProgram("lua", "fork") : current.script,
      pythonScript: current.tool.mode === "fork" && current.pythonScript === getStarterProgram("python", "fork", "body1") ? getStarterProgram("python", "fork") : current.pythonScript,
    }));
    setToolMeshMessage(uiLanguage === "zh-Hant"
      ? `已在目前瀏覽器工作階段載入 ${file.name}；不會上傳、儲存至專案或加入程式包。`
      : `Loaded ${file.name} for this browser session only; it is not uploaded, saved in the project, or bundled.`);
  };

  useEffect(() => {
    const abort = new AbortController();
    const files = ["magnet.stl", "Block.stl", "Body1.stl"];
    void Promise.allSettled(files.map(async (name) => {
      const response = await fetch(`${import.meta.env.BASE_URL}models/tools/${name}`, { signal: abort.signal });
      if (!response.ok) throw new Error(`${name}: HTTP ${response.status}`);
      const bytes = await response.arrayBuffer();
      if (!isLikelyStl(bytes)) throw new Error(`${name}: invalid STL`);
      return bytes;
    })).then(([magnetResult, forkResult, blockResult]) => {
      if (abort.signal.aborted) return;
      const magnet = magnetResult.status === "fulfilled" ? magnetResult.value : undefined;
      const fork = forkResult.status === "fulfilled" ? forkResult.value : undefined;
      const block = blockResult.status === "fulfilled" ? blockResult.value : undefined;
      const customFork = Boolean(localMeshesRef.current.fork || localMeshesRef.current.block);
      setLocalToolMeshes((current) => ({ ...current, magnet: current.magnet ?? magnet, fork: current.fork ?? fork, block: current.block ?? block,
        names: { magnet: magnet ? "magnet.stl" : undefined, fork: fork ? "Block.stl" : undefined, block: block ? "Body1.stl" : undefined, ...current.names },
        blockProfile: !customFork && fork && block ? "body1" : current.blockProfile,
        bundledFork: !customFork && Boolean(fork && block), bundledMagnet: !current.magnet && Boolean(magnet) }));
      if (!customFork && fork && block) setProject((current) => ({ ...current,
        script: current.tool.mode === "fork" && [getStarterProgram("lua", "fork"), recommendedProgram("lua", "fork")].includes(current.script) ? getStarterProgram("lua", "fork", "body1") : current.script,
        pythonScript: current.tool.mode === "fork" && [getStarterProgram("python", "fork"), recommendedProgram("python", "fork")].includes(current.pythonScript) ? getStarterProgram("python", "fork", "body1") : current.pythonScript,
      }));
      const failed = [magnetResult, forkResult, blockResult].flatMap((result, index) => result.status === "rejected" ? [files[index]] : []);
      setFailedToolModels(failed);
      setToolMeshMessage(failed.length ? `${uiLanguage === "zh-Hant" ? "部分模型未能載入，請重新整理：" : "Some models failed to load; refresh: "}${failed.join(", ")}` : (uiLanguage === "zh-Hant" ? "磁吸工具、無動力叉臂及槽積木已備好；自訂匯入會優先使用。" : "Magnetic tool, passive fork and grooved block are ready; custom imports take precedence."));
    });
    return () => abort.abort();
  }, []);

  const selectedPoint = project.points.find((point) => point.id === selectedId);
  const missingToolModels = failedToolModels.filter((name) => !localToolMeshes[({ "magnet.stl": "magnet", "Block.stl": "fork", "Body1.stl": "block" } as const)[name as "magnet.stl" | "Block.stl" | "Body1.stl"]]);
  const pose = useMemo(
    () => kinematics?.forward(joints, project.tool.flangeOffset, activeTcpOffset(project.tool)) ?? { x: 0, y: 0, z: 0, r: 0 },
    [kinematics, joints, project.tool.flangeOffset, project.tool.tcpOffsets, project.tool.mode],
  );
  const referenceSize = cellBlockSize(project.scene.blocks.find((block) => Math.hypot(block.position.x - project.scene.block.x, block.position.y - project.scene.block.y) <= 1), project.tool.mode);
  function cellObjectLabel(block: CellBlock) {
    const body1 = project.tool.mode === "fork" && effectiveForkContactProfile(selectedForkProfile, project.scene.blocks, block.id) === "body1";
    const size = body1 ? {x:40,y:40,z:40} : cellBlockSize(block, project.tool.mode);
    const name = body1 ? (uiLanguage === "zh-Hant" ? "槽積木" : "Grooved block") : size.z === 4 ? (uiLanguage === "zh-Hant" ? "磁吸片" : "Magnetic plate") : (uiLanguage === "zh-Hant" ? "方塊" : "Block");
    return `${name} ${size.x}×${size.y}×${size.z} mm`;
  }
  const tcpOffsetX = activeTcpOffset(project.tool).x;
  const tcpOffsetXLabel = `${tcpOffsetX >= 0 ? "+" : ""}${format(tcpOffsetX, 0)} mm`;
  const selectedPose = getPointPose(selectedPoint, kinematics, project);
  const busy = status === "running" || status === "paused";
  const canRun = Boolean(kinematics) && !modelError && status !== "running" && status !== "paused";
  const programText = project.programmingLanguage === "lua" ? project.script : project.pythonScript;
  const projectSnapshot = useMemo(() => JSON.stringify(project), [project]);
  const hasCurrentRun = lastRunContext === projectSnapshot;
  const recentRunLog = useMemo(
    () => !hasCurrentRun ? [] : programRunLog.slice(0, 12).map(({ level, message }) => `${level.toUpperCase()}: ${message.slice(0, 240)}`),
    [hasCurrentRun, programRunLog],
  );
  const recommendation = useMemo(
    () => recommendPickAndPlace(practicePrepared && !freeMode && !attached && status === "complete" ? resetCell(project) : project, project.programmingLanguage, kinematics ?? undefined, modelError, forkProfile),
    [project.points, project.scene, project.tool, project.programmingLanguage, kinematics, modelError, forkProfile, practicePrepared, freeMode, attached, status],
  );
  const towerBlocks = project.scene.blocks.filter((block) => block.stackLevel !== undefined);
  const sortUnloaded = project.scene.blocks.filter((block) => block.source === "unloaded").length;
  const preflight = useMemo(() => {
    const source = programText.split("\n").map((line) => line.replace(/(?:--|#).*$/, "")).join("\n");
    const poweredAction = /\b(?:DO|Pick|Place)\s*\(/i.test(source);
    const motionAction = /\b(?:MovJ|MovL|JointMovJ|RelMovL|mov_j|mov_l|joint_mov_j|rel_mov_l|sync|Sync)\s*\(/i.test(source);
    if (project.tool.mode === "fork" && poweredAction) return { kind: "error" as const, text: uiLanguage === "zh-Hant" ? "被動叉臂不能使用 DO、Pick 或 Place；請改用滑入 → 抬高 → 放下流程。" : "Fork mode is passive: remove DO(), Pick(), and Place(), then use the slide-under → lift → lower sequence." };
    if (!motionAction && !poweredAction) return { kind: "pass" as const, text: uiLanguage === "zh-Hant" ? "這段程式只輸出文字，不需要工具或教點；可直接執行。" : "This program only prints text; no tool or teach points are needed." };
    if (project.tool.mode === "magnet" && poweredAction && !localToolMeshes.magnet) return { kind: "error" as const, text: uiLanguage === "zh-Hant" ? "磁吸工具尚未載入。請稍候；如載入失敗，請重新整理或到工具設定匯入模型。" : "The magnetic tool has not loaded. Wait, or refresh/import the model in tool settings if loading failed." };
    if (project.tool.mode === "magnet" && !/\bDO\s*\(\s*1\s*,\s*(?:ON|TRUE|1)\s*\)/i.test(source)) return { kind: "warning" as const, text: uiLanguage === "zh-Hant" ? "磁吸執行前檢查：找不到 DO1 吸附指令；純移動程式仍可執行，但不會預期完成取件。" : "Magnet preflight: no DO1 ON/True/1 attach step was found. Motion-only scripts can still run; add the attach action before expecting a block cycle." };
    if (project.tool.mode === "fork" && forkProfile === "body1" && !recommendation.ready) return { kind: "error" as const, text: uiLanguage === "zh-Hant" ? `Body1 校準未完成：請重新示教槽方向、插入 Z${platformHeight(project.scene) + 42.5} 及承托／釋放 Z${platformHeight(project.scene) + 45}，再執行。` : `Body1 calibration is incomplete: re-teach groove direction, insertion Z${platformHeight(project.scene) + 42.5} and load/release Z${platformHeight(project.scene) + 45} before running.` };
    if (!recommendation.ready) return { kind: "warning" as const, text: uiLanguage === "zh-Hant" ? "執行前檢查：請先示教標示的 Home、取件或放置點。" : "Setup preflight: teach the highlighted Home, pick, or place points before running." };
    return { kind: "pass" as const, text: uiLanguage === "zh-Hant" ? `${project.tool.mode === "fork" ? "被動叉臂" : "磁吸工具"} 模式符合模擬器檢查。` : `${project.tool.mode === "fork" ? "Passive fork" : "Magnet"} mode matches this program's local simulator checks.` };
  }, [project.tool.mode, forkProfile, programText, recommendation.ready, uiLanguage, localToolMeshes.magnet]);

  useEffect(() => {
    let alive = true;
    void Promise.all([
      fetch("/models/mg400/mg400_description/urdf/mg400_description.urdf").then(async (response) => {
        if (!response.ok) throw new Error("Could not load the bundled MG400 kinematic model.");
        return response.text();
      }),
      import("./sim/mg400Kinematics"),
    ])
      .then(([xml, { MG400Kinematics: Kinematics }]) => {
        if (alive) {
          setKinematicsUrdf(xml);
          setKinematics(Kinematics.fromUrdf(xml));
        }
      })
      .catch((error: unknown) => {
        if (alive) setModelError(error instanceof Error ? error.message : String(error));
      });
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      try {
        saveProject(project);
        setSaved(true);
      } catch (error) {
        setSaved(false);
        const message = error instanceof Error ? error.message : "Could not save the local project.";
        const localized = uiLanguage === "zh-Hant" && message.includes("Cell object position is outside")
          ? "工作格物件位置超出支援範圍（X/Y ±500 mm、Z 0–300 mm）。請調整座標。"
          : message;
        addLog(localized, "error");
      }
    }, 250);
    return () => window.clearTimeout(handle);
    // Autosave is intentionally tied to the serialized project document only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project]);

  useEffect(() => () => {
    controllerRef.current?.stop(false);
    controllerRef.current = undefined;
  }, []);

  useEffect(() => {
    if (!runLessonCue || !showWorkshop) return;
    const frame = window.requestAnimationFrame(() => {
      runButtonRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
      runButtonRef.current?.focus({ preventScroll: true });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [runLessonCue, showWorkshop]);

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === "Enter" && canRun && preflight.kind !== "error" && !showTraining && (workbenchView !== "practice" || practicePrepared)) {
        event.preventDefault();
        startRun();
      }
    };
    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, [canRun, kinematics, status, preflight.kind, showTraining, workbenchView, practicePrepared, project]);

  function addLog(message: string, level: LogEntry["level"] = "info") {
    const entry = { id: crypto.randomUUID(), time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }), message, level };
    setLogs((previous) => [
      entry,
      ...previous,
    ].slice(0, 60));
    if (activeProgramRunRef.current) setProgramRunLog((previous) => [entry, ...previous].slice(0, 12));
  }

  function replaceProject(update: (current: ProjectDocument) => ProjectDocument) {
    if (!busy) {
      setLatestPrintOutput(null);
      setLastRunContext(null);
      setProgramRunLog([]);
      setStatus("ready");
    }
    setSaved(false);
    setProject((current) => update(structuredClone(current)));
  }

  function observeRobotTask() {
    const current = projectRef.current;
    if (!activeProgramRunRef.current || !kinematics) return;
    const actual = kinematics.forward(jointsRef.current, current.tool.flangeOffset, activeTcpOffset(current.tool));
    observeTaskFrame(taskEvidenceRef.current, actual, attachedRef.current ? attachedCellBlockIdRef.current : null);
  }

  function setRobotJoints(next: JointAngles) {
    jointsRef.current = next;
    observeRobotTask();
    setJoints([...next] as JointAngles);
  }

  function setCurrentBlock(next: { x: number; y: number }) {
    blockRef.current = next;
    setBlockPosition(next);
  }

  function getController() {
    if (!kinematics) return null;
    if (!controllerRef.current) {
      controllerRef.current = new SimulationController(kinematics, {
        getProject: () => projectRef.current,
        getJoints: () => jointsRef.current,
        isAttached: () => attachedRef.current,
        getBlock: () => blockRef.current,
        getForkContactProfile: () => localMeshesRef.current.blockProfile ?? "reference",
        getCellBlocks: () => projectRef.current.scene.blocks.map((block) => ({ ...block, position: { ...block.position } })),
        setCellBlocks: (next) => {
          cellBlocksRef.current = next;
          const feederOrder = projectRef.current.scene.feederOrder.filter((id) => next.some((block) => block.id === id && block.source === "feeder"));
          projectRef.current = { ...projectRef.current, scene: { ...projectRef.current.scene, blocks: structuredClone(next), feederOrder } };
          setCellBlocks(next);
          setProject((current) => ({ ...current, scene: { ...current.scene, blocks: structuredClone(next), feederOrder } }));
        },
        setJoints: setRobotJoints,
        setAttached: (next) => {
          attachedRef.current = next;
          setAttached(next);
          observeRobotTask();
        },
        setAttachedCellBlockId: (next) => {
          attachedCellBlockIdRef.current = next;
          setAttachedCellBlockId(next);
          observeRobotTask();
        },
        setBlock: (next) => {
          setCurrentBlock(next);
          if (projectRef.current.tool.mode === "fork") {
            projectRef.current = { ...projectRef.current, scene: { ...projectRef.current.scene, block: next } };
            setProject((current) => ({ ...current, scene: { ...current.scene, block: next } }));
          }
        },
        setDigitalOutput: (index, value) => setOutputs((current) => ({ ...current, [index]: value })),
        setStatus: (next) => {
          setStatus(next);
          if (next === "complete" || next === "stopped" || next === "error") queueMicrotask(() => { activeProgramRunRef.current = false; });
        },
        addLog,
        setPrintOutput: setLatestPrintOutput,
      });
    }
    return controllerRef.current;
  }

  function startRun() {
    setRunLessonCue(false);
    if (preflight.kind === "error") {
      addLog(preflight.text, "error");
      return;
    }
    const controller = getController();
    if (!controller) return;
    if (practicePrepared && !freeMode && !attachedRef.current && status === "complete") {
      const arranged = resetCell(projectRef.current);
      projectRef.current = arranged;
      setProject(arranged);
    }
    taskEvidenceRef.current = newTaskEvidence();
    taskStartProjectRef.current = structuredClone(projectRef.current);
    activeProgramRunRef.current = true;
    setLatestPrintOutput(null);
    setProgramRunLog([]);
    if (!attachedRef.current) {
      attachedRef.current = false;
      setAttached(false);
      attachedCellBlockIdRef.current = null;
      setAttachedCellBlockId(null);
      setCurrentBlock({ ...projectRef.current.scene.block });
      cellBlocksRef.current = structuredClone(projectRef.current.scene.blocks);
      setCellBlocks(structuredClone(projectRef.current.scene.blocks));
      setOutputs({ 1: false });
    }
    const document = projectRef.current;
    const source = document.programmingLanguage === "lua" ? document.script : document.pythonScript;
    setLastRunContext(JSON.stringify(document));
    controller.run(
      source,
      document.points,
      document.programmingLanguage,
    );
  }

  function setProgramLanguage(language: ProgramLanguage) {
    if (projectRef.current.programmingLanguage === language) return;
    replaceProject((current) => ({ ...current, programmingLanguage: language }));
  }

  function loadRecommendedProgram() {
    if (!recommendation.ready) return;
    const language = projectRef.current.programmingLanguage;
    replaceProject((current) => language === "lua"
      ? { ...current, script: recommendation.code }
      : { ...current, pythonScript: recommendation.code });
    addLog(`Loaded the recommended ${language === "lua" ? "Lua" : "Python"} pick-and-place template.`, "info");
  }

  function insertSnippet(snippet: string) {
    const language = projectRef.current.programmingLanguage;
    const existing = language === "lua" ? projectRef.current.script : projectRef.current.pythonScript;
    if (existing.trim() && !window.confirm(uiLanguage === "zh-Hant" ? "要以這個獨立學習範例取代目前的編輯器程式嗎？" : "Replace the current editor program with this standalone learning example?")) return;
    replaceProject((current) => current.programmingLanguage === "lua"
      ? { ...current, script: `${snippet.trim()}\n` }
      : { ...current, pythonScript: `${snippet.trim()}\n` });
    addLog(`Loaded a standalone ${language === "lua" ? "Lua" : "Python"} learning snippet.`, "info");
  }

  function pauseOrResume() {
    if (status === "paused") controllerRef.current?.resume();
    else controllerRef.current?.pause();
  }

  function stopRun() {
    controllerRef.current?.stop(true);
  }

  function resetRobot() {
    activeProgramRunRef.current = false;
    controllerRef.current?.stop(false, true);
    const home = projectRef.current.points.find((point) => point.name === "Home" && point.kind === "joint");
    setRobotJoints(home?.kind === "joint" ? [...home.joints] : initialJoints);
    attachedRef.current = false;
    setAttached(false);
    attachedCellBlockIdRef.current = null;
    setAttachedCellBlockId(null);
    const reset = resetCell(projectRef.current);
    setProject(reset);
    projectRef.current = reset;
    setCurrentBlock({ ...reset.scene.block });
    cellBlocksRef.current = structuredClone(reset.scene.blocks);
    setCellBlocks(structuredClone(reset.scene.blocks));
    setOutputs({ 1: false });
    setStatus("ready");
    setLatestPrintOutput(null);
    setLastRunContext(null);
    setProgramRunLog([]);
    addLog("Robot pose and reference cell reset.", "info");
  }

  function nextName(prefix: string) {
    const used = new Set(projectRef.current.points.map((point) => point.name.toLowerCase()));
    for (let index = 1; index <= 999; index += 1) {
      const candidate = `${prefix}${index}`;
      if (!used.has(candidate.toLowerCase())) return candidate;
    }
    return `${prefix}${Date.now()}`;
  }

  function addCartesianPoint() {
    if (projectRef.current.points.length >= 100) {
      addLog("This project already has the maximum of 100 teach points.", "warning");
      return;
    }
    const name = nextName("P");
    const point = makeCartesianPoint(name, pose);
    replaceProject((current) => ({ ...current, points: [...current.points, point] }));
    setSelectedId(point.id);
    addLog(`Taught ${name} from the current TCP pose.`, "info");
  }

  function addJointPoint() {
    if (projectRef.current.points.length >= 100) {
      addLog("This project already has the maximum of 100 teach points.", "warning");
      return;
    }
    const name = nextName("J");
    const point = makeJointPoint(name, jointsRef.current);
    replaceProject((current) => ({ ...current, points: [...current.points, point] }));
    setSelectedId(point.id);
    addLog(`Taught joint point ${name}.`, "info");
  }

  function addReferencePair(kind: "pick" | "place") {
    const current = projectRef.current;
    const preferred = kind === "pick" ? ["PickPoint", "PickApproach"] : ["PlacePoint", "PlaceApproach"];
    const used = new Set(current.points.map((point) => point.name.toLowerCase()));
    const name = (base: string, prefix: string) => {
      if (current.points.some((point) => point.name.toLowerCase() === base.toLowerCase())) return base;
      if (!used.has(base.toLowerCase())) {
        used.add(base.toLowerCase());
        return base;
      }
      for (let index = 1; index <= 999; index += 1) {
        const candidate = `${prefix}${index}`;
        if (!used.has(candidate.toLowerCase())) {
          used.add(candidate.toLowerCase());
          return candidate;
        }
      }
      return `${prefix}${Date.now()}`;
    };
    const location = kind === "pick" ? current.scene.block : current.scene.drop;
    const blockR = current.scene.blocks.find((block) => Math.hypot(block.position.x - current.scene.block.x, block.position.y - current.scene.block.y) <= 1)?.r ?? 0;
    const contactHeight = current.tool.mode === "magnet" ? cellBlockTopZ(current.scene.blocks.find((block) => Math.hypot(block.position.x - current.scene.block.x, block.position.y - current.scene.block.y) <= 1), "magnet", magneticSurfaceHeight(current.scene), platformHeight(current.scene)) : forkProfile === "body1" ? (kind === "pick" ? BODY1_FORK_CONTACT.insertionZ : BODY1_FORK_CONTACT.loadZ) : FORK_SUPPORT_HEIGHT_MM;
    const surfaceName = name(preferred[0], kind === "pick" ? "Pick" : "Place");
    const approachName = name(preferred[1], kind === "pick" ? "PickApproach" : "PlaceApproach");
    const existingSurface = current.points.find((point) => point.name === surfaceName);
    const existingApproach = current.points.find((point) => point.name === approachName);
    if (current.points.length + Number(!existingSurface) + Number(!existingApproach) > 100) {
      addLog("A point pair needs two free slots; the project limit is 100 points.", "warning");
      return;
    }
    const surfacePose = current.tool.mode === "fork" ? forkContactPose(location, blockR, forkProfile, kind === "place", platformHeight(current.scene)) : { x: location.x, y: location.y, z: contactHeight, r: 0 };
    const passiveForkEntry = current.tool.mode === "fork" && kind === "pick";
    const approachPose = passiveForkEntry
      ? forkEntryPose(surfacePose)
      : { ...surfacePose, z: contactHeight + 80 };
    const surface = makeCartesianPoint(surfaceName, surfacePose, existingSurface?.id);
    const approach = makeCartesianPoint(approachName, approachPose, existingApproach?.id);
    const replacedIds = new Set([existingSurface?.id, existingApproach?.id].filter((id): id is string => Boolean(id)));
    replaceProject((document) => ({ ...document, points: [...document.points.filter((point) => !replacedIds.has(point.id)), surface, approach] }));
    setSelectedId(surface.id);
    addLog(passiveForkEntry
      ? `Taught the fork entry point ${FORK_INSERTION_DISTANCE_MM} mm before the block and the insertion point at its ${contactHeight} mm contact plane.`
      : `Taught ${kind} and approach points above the reference cell ${kind === "pick" ? "block" : "drop zone"}.`, "info");
  }

  function setCurrentPoseAsHome() {
    const existing = projectRef.current.points.find((point) => point.name.toLowerCase() === "home");
    const createdHome = makeJointPoint("Home", jointsRef.current);
    const home = existing ? { ...createdHome, id: existing.id } : createdHome;
    replaceProject((current) => ({
      ...current,
      points: [...current.points.filter((point) => point.name.toLowerCase() !== "home"), home],
    }));
    setSelectedId(home.id);
    setSelectedTab("points");
    addLog("Saved the current joint pose as Home.", "info");
  }

  function applyRecommendationAction(action: "teach-home" | "teach-pick" | "teach-place" | "select-point", pointName?: string) {
    if (action === "teach-home") {
      setCurrentPoseAsHome();
      return;
    }
    if (action === "teach-pick" || action === "teach-place") {
      addReferencePair(action === "teach-pick" ? "pick" : "place");
      setSelectedTab("points");
      return;
    }
    if (!pointName) return;
    const point = projectRef.current.points.find((candidate) => candidate.name === pointName);
    if (!point) return;
    setSelectedId(point.id);
    setSelectedTab("points");
  }

  function updateSelectedPose(axis: keyof Pose, value: number) {
    if (!selectedPoint) return;
    if (selectedPoint.kind === "joint") {
      const goal = kinematics?.solve(
        { ...pose, [axis]: value },
        jointsRef.current,
        projectRef.current.tool.flangeOffset,
        activeTcpOffset(projectRef.current.tool),
      );
      if (goal?.ok) updatePointJoints(selectedPoint, goal.joints);
      else addLog("The requested Cartesian point is outside the modeled joint-limited workspace.", "error");
      return;
    }
    replaceProject((current) => ({
      ...current,
      points: current.points.map((point) => point.id === selectedPoint.id && point.kind === "cartesian"
        ? { ...point, pose: { ...point.pose, [axis]: value } }
        : point),
    }));
  }

  function updatePointJoints(point: TeachPoint, next: JointAngles) {
    if (point.kind !== "joint") return;
    replaceProject((current) => ({
      ...current,
      points: current.points.map((item) => item.id === point.id && item.kind === "joint"
        ? { ...item, joints: [...next] as JointAngles }
        : item),
    }));
  }

  function updateJointPoint(index: number, degrees: number) {
    if (!selectedPoint || selectedPoint.kind !== "joint") return;
    const next = [...selectedPoint.joints] as JointAngles;
    next[index] = rad(degrees);
    updatePointJoints(selectedPoint, next);
  }

  function moveToSelected() {
    if (!selectedPoint || !kinematics) return;
    void getController()?.goToPoint(selectedPoint);
  }

  function jogCartesian(axis: keyof Pose, amount: number) {
    if (!kinematics) return;
    const target = { ...pose, [axis]: pose[axis] + amount };
    const result = kinematics.solve(target, jointsRef.current, projectRef.current.tool.flangeOffset, activeTcpOffset(projectRef.current.tool));
    if (!result.ok) {
      addLog(`Jog stopped: ${axis.toUpperCase()} target is outside the modeled workspace.`, "warning");
      return;
    }
    setRobotJoints(result.joints);
  }

  function jogJoint(index: number, direction: number) {
    const next = [...jointsRef.current] as JointAngles;
    const degrees = deg(next[index]) + direction * jointStep;
    const limit = JOINT_LIMITS_DEG[index];
    if (degrees < limit.min || degrees > limit.max) {
      addLog(`Jog stopped at J${index + 1} limit (${limit.min}° to ${limit.max}°).`, "warning");
      return;
    }
    next[index] = rad(degrees);
    setRobotJoints(next);
  }

  function downloadProject() {
    const blob = new Blob([exportProject(projectRef.current)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "mg400-training-project.json";
    anchor.click();
    URL.revokeObjectURL(url);
    addLog("Project JSON exported to this device.", "info");
  }

  async function importProject(file?: File) {
    if (!file) return;
    try {
      const raw = await file.text();
      const imported = parseProjectFile(raw);
      setConvertedRoundPieces(containsRemovedRoundWorkpieces(JSON.parse(raw)));
      controllerRef.current?.stop(false, true);
      attachedRef.current = false;
      setAttached(false);
      setLocalToolMeshes((current) => ({ ...current, blockProfile: current.bundledFork ? "body1" : "reference" }));
      setProject(imported);
      projectRef.current = imported;
      setCurrentBlock({ ...imported.scene.block });
      cellBlocksRef.current = structuredClone(imported.scene.blocks);
      attachedCellBlockIdRef.current = null;
      setAttachedCellBlockId(null);
      setCellBlocks(structuredClone(imported.scene.blocks));
      setSelectedId(imported.points[0]?.id ?? null);
      setSaved(false);
      setPracticeLessonId(null);
      setPracticePrepared(false);
      setLatestPrintOutput(null);
      setLastRunContext(null);
      setProgramRunLog([]);
      setStatus("ready");
      setWorkbenchView("program");
      setShowWorkshop(true);
      setShowToolSettings(false);
      setCoachOpen(false);
      setFreeMode(false);
      window.localStorage.setItem(FREE_MODE_KEY, "false");
      guidedSceneRef.current = structuredClone(imported.scene);
      addLog(`Imported and validated ${file.name}.`, "info");
    } catch (error) {
      addLog(error instanceof Error ? error.message : "Import failed.", "error");
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  function removeSelectedPoint() {
    if (!selectedPoint) return;
    const id = selectedPoint.id;
    replaceProject((current) => ({ ...current, points: current.points.filter((point) => point.id !== id) }));
    setSelectedId(project.points.find((point) => point.id !== id)?.id ?? null);
    addLog(`Removed point ${selectedPoint.name}.`, "warning");
  }

  function updateTool(path: "flangeOffset" | "tcpOffsets", axis: keyof Pose, value: number) {
    replaceProject((current) => path === "flangeOffset"
      ? { ...current, tool: { ...current.tool, flangeOffset: { ...current.tool.flangeOffset, [axis]: value } } }
      : {
          ...current,
          tool: {
            ...current.tool,
            tcpOffsets: {
              ...current.tool.tcpOffsets,
              [current.tool.mode]: { ...current.tool.tcpOffsets[current.tool.mode], [axis]: value },
            },
          },
        });
  }

  function updateTolerance(axis: "xy" | "z", value: number) {
    replaceProject((current) => ({
      ...current,
      tool: { ...current.tool, pickupTolerance: { ...current.tool.pickupTolerance, [axis]: Math.max(0, value) } },
    }));
  }

  function updateCellPosition(target: "block" | "drop", axis: "x" | "y", value: number) {
    const next = { ...projectRef.current.scene[target], [axis]: value };
    replaceProject((document) => ({ ...document, scene: { ...document.scene, [target]: next } }));
    if (target === "block" && !attachedRef.current) setCurrentBlock(next);
  }

  function updateCellBlock(id: string, update: Partial<{ color: BlockColor; source: BlockSource; kind: CellObjectKind; x: number; y: number; z: number; r: number }>) {
    replaceProject((current) => {
      const updateBlocks = (blocks: typeof current.scene.blocks) => blocks.map((block) => block.id !== id ? block : {
        ...block,
        ...(update.color ? { color: update.color } : {}),
        ...(update.source ? { source: update.source } : {}),
        ...(update.kind ? { kind: update.kind } : {}),
        ...(update.r === undefined && update.x === undefined && update.y === undefined && update.z === undefined ? {} : { position: { x: update.x ?? block.position.x, y: update.y ?? block.position.y }, z: update.z ?? block.z ?? 0, r: update.r ?? block.r }),
      });
      const blocks = updateBlocks(current.scene.blocks);
      const initialBlocks = updateBlocks(current.scene.initialBlocks);
      const feederOrder = current.scene.feederOrder.filter((blockId) => blocks.some((block) => block.id === blockId && block.source === "feeder"));
      if (update.source === "feeder" && !feederOrder.includes(id)) feederOrder.push(id);
      return { ...current, scene: { ...current.scene, blocks, initialBlocks, feederOrder } };
    });
  }

  function placeSelectedOnTable(position: { x: number; y: number }) {
    if (!freeMode || !freeSelectedId) return;
    updateCellBlock(freeSelectedId, { x: position.x, y: position.y, z: 0 });
    setPlacementArmed(false);
    setPlacementMessage(uiLanguage === "zh-Hant" ? `已將 ${freeSelectedId} 放到 X ${position.x}、Y ${position.y} mm。` : `Placed ${freeSelectedId} at X ${position.x}, Y ${position.y} mm.`);
  }

  function nudgeSelectedPlacement(dx: number, dy: number) {
    const selected = projectRef.current.scene.blocks.find((block) => block.id === freeSelectedId);
    if (!selected) return;
    const x = Math.max(-500, Math.min(500, Number((selected.position.x + dx).toFixed(1))));
    const y = Math.max(-500, Math.min(500, Number((selected.position.y + dy).toFixed(1))));
    updateCellBlock(selected.id, { x, y, z: 0 });
    setPlacementMessage(uiLanguage === "zh-Hant" ? `鍵盤位置：X ${x}、Y ${y} mm。按 Enter 確認，Escape 取消。` : `Keyboard position: X ${x}, Y ${y} mm. Press Enter to place or Escape to cancel.`);
  }

  function cancelTablePlacement() {
    setPlacementArmed(false);
    setPlacementMessage(uiLanguage === "zh-Hant" ? "已取消工作台擺放；可繼續使用數字欄位。" : "Table placement cancelled; numeric fields remain available.");
  }

  function confirmTablePlacement() {
    const selected = projectRef.current.scene.blocks.find((block) => block.id === freeSelectedId);
    if (selected) placeSelectedOnTable({ x: selected.position.x, y: selected.position.y });
  }

  function armTablePlacement() {
    if (!freeSelectedId) {
      setPlacementMessage(uiLanguage === "zh-Hant" ? "請先選取一個物件，再點選工作台。" : "Select an object before choosing a table position.");
      return;
    }
    setPlacementMessage(uiLanguage === "zh-Hant" ? "請在 3D 工作台點選位置；拖曳仍可旋轉視角。" : "Click the 3D worktable; drag still orbits the camera.");
    setPlacementArmed(true);
  }

  function addCellBlock() {
    addCellObject(projectRef.current.tool.mode === "magnet" ? "magnet" : "block");
  }

  function addCellObject(kind: CellObjectKind) {
    replaceProject((current) => {
      if (current.scene.blocks.length >= 32) return current;
      let index = 1;
      while (current.scene.blocks.some((block) => block.id === `${kind}-${index}`)) index += 1;
      const block = { id: `${kind}-${index}`, kind, color: "neutral" as const, source: "pickup" as const, position: { x: 300 + (index % 5) * 45, y: -240 }, z: 0, r: 0 };
      setFreeSelectedId(block.id);
      return { ...current, scene: { ...current.scene, blocks: [...current.scene.blocks, block], initialBlocks: [...current.scene.initialBlocks, block] } };
    });
  }

  function removeCellBlock(id: string) {
    if (!freeMode && projectRef.current.scene.blocks.length <= 1) return;
    replaceProject((current) => ({ ...current, scene: { ...current.scene, blocks: current.scene.blocks.filter((block) => block.id !== id), initialBlocks: current.scene.initialBlocks.filter((block) => block.id !== id), feederOrder: current.scene.feederOrder.filter((blockId) => blockId !== id) } }));
    if (freeSelectedId === id) setFreeSelectedId(null);
  }

  function toggleFreeMode() {
    if (freeMode) {
      let guided = guidedSceneRef.current;
      if (!guided) {
        try {
          const savedGuidedScene = window.localStorage.getItem(GUIDED_SCENE_KEY);
          if (savedGuidedScene) guided = parseProjectFile(JSON.stringify({ ...projectRef.current, schemaVersion: 10, scene: JSON.parse(savedGuidedScene) })).scene;
        } catch { /* keep the current scene if no guided snapshot exists */ }
      }
      if (guided) replaceProject((current) => ({ ...current, scene: structuredClone(guided) }));
      setFreeMode(false);
      setShowWorkshop(false);
      setRunLessonCue(false);
      setPlacementArmed(false);
      setPlacementMessage("");
      window.localStorage.setItem(FREE_MODE_KEY, "false");
      addLog("已返回訓練模式；導引工作格已還原。", "info");
      return;
    }
    guidedSceneRef.current = structuredClone(projectRef.current.scene);
    try { window.localStorage.setItem(GUIDED_SCENE_KEY, JSON.stringify(guidedSceneRef.current)); } catch { /* local persistence is best effort */ }
    let freeScene: ProjectDocument["scene"] = { ...projectRef.current.scene, blocks: [], initialBlocks: [], feederOrder: [] };
    try {
      const savedFreeScene = window.localStorage.getItem(FREE_SCENE_KEY);
      if (savedFreeScene) {
        const raw = JSON.parse(savedFreeScene);
        const parsed = parseProjectFile(JSON.stringify({ ...projectRef.current, schemaVersion: 10, scene: raw })).scene;
        if (containsRemovedRoundWorkpieces({ scene: raw })) setConvertedRoundPieces(true);
        const isLegacyUneditedSeed = JSON.stringify(parsed.blocks) === JSON.stringify(DEFAULT_CELL_BLOCKS)
          && JSON.stringify(parsed.initialBlocks) === JSON.stringify(DEFAULT_CELL_BLOCKS);
        if (!isLegacyUneditedSeed) freeScene = parsed;
      }
    } catch { /* use the current cell when no saved Free Mode cell exists */ }
    replaceProject((current) => ({ ...current, scene: structuredClone(freeScene) }));
    setFreeSelectedId(freeScene.blocks[0]?.id ?? null);
    setFreeMode(true);
    setShowWorkshop(false);
    setRunLessonCue(false);
    setPlacementArmed(false);
    setPlacementMessage("");
    window.localStorage.setItem(FREE_MODE_KEY, "true");
    addLog("已進入自由模式；物件只按模擬器邏輯接觸，不代表磁力或實體穩定性。", "info");
  }

  function resetFreeCell() {
    if (!freeMode) return;
    controllerRef.current?.stop(false, true);
    const reset = resetCell(projectRef.current);
    replaceProject(() => reset);
    addLog("自由工作格已重設到最近一次儲存的配置。", "info");
  }

  useEffect(() => {
    if (freeMode) {
      try { window.localStorage.setItem(FREE_SCENE_KEY, JSON.stringify(project.scene)); } catch { /* local persistence is best effort */ }
    }
  }, [freeMode, project.scene]);

  useEffect(() => {
    window.localStorage.setItem(UI_LANGUAGE_KEY, uiLanguage);
    document.documentElement.lang = uiLanguage === "zh-Hant" ? "zh-Hant-HK" : "en";
  }, [uiLanguage]);

  function openWorkbench(view: typeof workbenchView) {
    if (busy && ((view === "practice" && freeMode) || view === "objects")) return;
    if ((view === "objects" && !freeMode) || (view === "practice" && freeMode)) toggleFreeMode();
    setPlacementArmed(false);
    setWorkbenchView(view);
    setShowWorkshop(view === "program");
    setShowToolSettings(view === "settings");
    if (view !== "program") setCoachOpen(false);
  }

  function restorePracticeProject() {
    const backup = window.localStorage.getItem("mg400-before-practice-v1");
    if (!backup || busy) return;
    if (!window.confirm(uiLanguage === "zh-Hant" ? "還原會替換目前的程式、教點與工作格。如需保留目前內容，請先匯出。繼續還原嗎？" : "Restore replaces the current code, points and cell. Export any current work you want to keep. Continue?")) return;
    try {
      const snapshot = JSON.parse(backup) as { project?: unknown; freeMode?: boolean; guidedScene?: ProjectDocument["scene"] };
      const previous = parseProjectFile(snapshot.project ? JSON.stringify(snapshot.project) : backup);
      const previousFreeMode = Boolean(snapshot.project && snapshot.freeMode);
      // Validate the optional guided cell through the same project schema before restoring it.
      const guided = snapshot.guidedScene ? parseProjectFile(JSON.stringify({ ...previous, scene: snapshot.guidedScene })).scene : previous.scene;
      controllerRef.current?.stop(false, true);
      projectRef.current = previous;
      setProject(previous);
      resetRobot();
      guidedSceneRef.current = structuredClone(previousFreeMode ? guided : previous.scene);
      window.localStorage.setItem(GUIDED_SCENE_KEY, JSON.stringify(guidedSceneRef.current));
      window.localStorage.setItem(FREE_MODE_KEY, String(previousFreeMode));
      if (previousFreeMode) window.localStorage.setItem(FREE_SCENE_KEY, JSON.stringify(previous.scene));
      setFreeMode(previousFreeMode);
      setFreeSelectedId(previousFreeMode ? previous.scene.blocks[0]?.id ?? null : null);
      setSelectedId(previous.points[0]?.id ?? null);
      setPlacementArmed(false);
      setPlacementMessage("");
      setPracticeLessonId(null);
      setPracticePrepared(false);
      setWorkbenchView("program");
      setShowWorkshop(true);
      setShowToolSettings(false);
      setCoachOpen(false);
      setSaved(false);
      window.localStorage.removeItem("mg400-before-practice-v1");
      addLog(uiLanguage === "zh-Hant" ? "已還原開始練習前的專案。" : "Restored the project from before practice.", "info");
    } catch {
      addLog(uiLanguage === "zh-Hant" ? "無法讀取備份，原備份已保留。" : "Could not read the backup; it has been retained.", "error");
    }
  }

  function preparePractice(id: string) {
    if (busy) return;
    const lesson = LESSONS.find((item) => item.id === id);
    if (!lesson) return;
    const current = projectRef.current;
    const language = current.programmingLanguage;
    const currentCode = language === "lua" ? current.script : current.pythonScript;
    const canonicalPoints = ["reference", "body1"].map((profile) => DEFAULT_PROJECT.points.map((point) => {
      if (point.kind !== "cartesian") return point;
      const pick = forkContactPose(DEFAULT_PROJECT.scene.block, 0, profile as ForkContactProfile, false, platformHeight(DEFAULT_PROJECT.scene));
      const place = forkContactPose(DEFAULT_PROJECT.scene.drop, 0, profile as ForkContactProfile, true, platformHeight(DEFAULT_PROJECT.scene));
      const poses: Record<string, Pose> = { PickPoint: pick, PickApproach: forkEntryPose(pick), PlacePoint: place, PlaceApproach: { ...place, z: place.z + 80 } };
      return poses[point.name] ? { ...point, pose: poses[point.name] } : point;
    }));
    const customSetup = ![DEFAULT_PROJECT.points, ...canonicalPoints].some((points) => JSON.stringify(points) === JSON.stringify(current.points))
      || (!freeMode && JSON.stringify(current.scene.initialBlocks) !== JSON.stringify(DEFAULT_PROJECT.scene.initialBlocks))
      || current.scene.drop.x !== DEFAULT_PROJECT.scene.drop.x || current.scene.drop.y !== DEFAULT_PROJECT.scene.drop.y;
    const knownExamples = [getStarterProgram(language, "magnet"), getStarterProgram(language, "fork"), getStarterProgram(language, "fork", "body1"), recommendedProgram(language, current.tool.mode, forkProfile), ...LESSONS.map((item) => item.examples[language])];
    if ((!knownExamples.includes(currentCode) || customSetup) && !window.confirm(uiLanguage === "zh-Hant" ? "開始這個練習會替換目前語言的程式，並準備範例工作格與教點。請先匯出要保留的專案。繼續嗎？" : "This practice replaces the selected language's code and prepares an example cell and points. Export any project you want to keep. Continue?")) return;
    try {
      if (!window.localStorage.getItem("mg400-before-practice-v1")) window.localStorage.setItem("mg400-before-practice-v1", JSON.stringify({ project: current, freeMode, guidedScene: guidedSceneRef.current ?? current.scene }));
    } catch {
      if (!window.confirm(uiLanguage === "zh-Hant" ? "無法備份目前專案。開始練習會替換程式、教點與工作格；請先匯出需要保留的內容。繼續嗎？" : "Could not back up this project. Practice replaces code, points and cell. Export anything you want to keep. Continue?")) return;
    }
    if (freeMode) {
      try { window.localStorage.setItem(FREE_SCENE_KEY, JSON.stringify(current.scene)); } catch { /* keep current project on save failure */ }
    }
    const mode = id === "intermediate-passive-fork" ? "fork" : "magnet";
    const profile = mode === "fork" ? selectedForkProfile : "reference";
    const next = structuredClone(DEFAULT_PROJECT);
    next.tool = { ...structuredClone(current.tool), mode };
    next.simulation = { ...current.simulation };
    next.programmingLanguage = language;
    next.script = current.script;
    next.pythonScript = current.pythonScript;
    const code = mode === "fork" ? getStarterProgram(language, mode, profile) : lesson.examples[language];
    if (language === "lua") next.script = code; else next.pythonScript = code;
    if (mode === "fork") {
      const pick = forkContactPose(next.scene.block, 0, profile, false, platformHeight(next.scene));
      const place = forkContactPose(next.scene.drop, 0, profile, true, platformHeight(next.scene));
      const poses: Record<string, Pose> = { PickPoint: pick, PickApproach: forkEntryPose(pick), PlacePoint: place, PlaceApproach: { ...place, z: place.z + 80 } };
      next.points = next.points.map((point) => point.kind === "cartesian" && poses[point.name] ? { ...point, pose: poses[point.name] } : point);
    }
    controllerRef.current?.stop(false, true);
    projectRef.current = next;
    setProject(next);
    setSaved(false);
    setSelectedId(next.points[0]?.id ?? null);
    setFreeMode(false);
    window.localStorage.setItem(FREE_MODE_KEY, "false");
    setConvertedRoundPieces(false);
    setPracticeLessonId(id);
    setPracticePrepared(true);
    setWorkbenchView("practice");
    setShowWorkshop(false);
    setCoachOpen(false);
    setShowToolSettings(false);
    setLatestPrintOutput(null);
    setLastRunContext(null);
    setProgramRunLog([]);
    resetRobot();
  }

  const practiceLesson = LESSONS.find((item) => item.id === practiceLessonId);
  const practiceIsPrint = practiceLessonId === "foundation-first-program";
  const taskChecks = status === "complete" && taskStartProjectRef.current ? assessRobotTask(practiceLessonId, taskStartProjectRef.current, project, taskEvidenceRef.current) : [];
  const resultError = programRunLog.find((entry) => entry.level === "error");

  const targetPose = selectedPose;
  const runtimeLabel = {
    ready: uiLanguage === "zh-Hant" ? "待命" : "READY",
    running: uiLanguage === "zh-Hant" ? "執行中" : "RUNNING",
    paused: uiLanguage === "zh-Hant" ? "已暫停" : "PAUSED",
    complete: uiLanguage === "zh-Hant" ? "完成" : "COMPLETE",
    stopped: uiLanguage === "zh-Hant" ? "已停止" : "STOPPED",
    error: uiLanguage === "zh-Hant" ? "錯誤" : "ERROR",
  }[status];

  const freeModeTopPanel = freeMode ? <section className={`free-mode-panel free-mode-top${showWorkshop ? " free-mode-detailed" : ""}`} aria-label={uiLanguage === "zh-Hant" ? "自由模式工作格" : "Free mode workcell"}>
    <div className="free-mode-heading"><div><strong>{uiLanguage === "zh-Hant" ? "自由模式 · 自訂工作格" : "Free mode · Custom cell"}</strong><span>{uiLanguage === "zh-Hant" ? "加入物件，再點工作台擺放；拖曳工作台可旋轉視角。" : "Add an object, then click the table to place it. Drag the table to orbit."}</span></div><div className="free-object-actions">
      <button className="secondary-button outlined-button" onClick={() => addCellObject("block")} disabled={busy}><Plus size={14} /> {uiLanguage === "zh-Hant" ? "加入方塊" : "Add block"}</button>
      <button className="secondary-button outlined-button" onClick={() => addCellObject("magnet")} disabled={busy}><Plus size={14} /> {uiLanguage === "zh-Hant" ? "加入35×35×4 mm 磁吸片" : "Add magnet"}</button>
      {project.scene.blocks.length > 0 && <button className="secondary-button outlined-button" onClick={resetFreeCell} disabled={busy}><RotateCcw size={14} /> {uiLanguage === "zh-Hant" ? "重設" : "Reset"}</button>}
      {project.scene.blocks.length > 0 && <button className={`secondary-button outlined-button${placementArmed ? " placement-active" : ""}`} onClick={() => placementArmed ? cancelTablePlacement() : armTablePlacement()} disabled={busy}>{placementArmed ? (uiLanguage === "zh-Hant" ? "取消擺放" : "Cancel placement") : (uiLanguage === "zh-Hant" ? "在工作台擺放" : "Place on table")}</button>}
      <button className="text-button" onClick={() => openWorkbench("program")}>{uiLanguage === "zh-Hant" ? "為工作格寫程式" : "Code for this cell"}<ArrowRight size={16} /></button>
    </div></div>
    {project.scene.blocks.length > 0 && <div className="free-object-list">{project.scene.blocks.map((block) => <button type="button" key={block.id} className={`free-object-chip ${block.kind === "magnet" ? "magnet-object" : "block-object"} ${freeSelectedId === block.id ? "selected" : ""}`} onClick={() => setFreeSelectedId(block.id)}><span aria-hidden="true">■</span> {cellObjectLabel(block)} · {block.id}</button>)}</div>}
    {(() => { const selected = project.scene.blocks.find((block) => block.id === freeSelectedId) ?? project.scene.blocks[0]; if (!selected) return null; return <div className="free-selected-editor"><strong>{uiLanguage === "zh-Hant" ? "已選取" : "Selected"}：{cellObjectLabel(selected)} · {selected.id}</strong><div className="free-selected-fields"><NumericField label="X" value={selected.position.x} suffix="mm" min={-500} max={500} disabled={busy} onChange={(value) => updateCellBlock(selected.id, { x: value })} /><NumericField label="Y" value={selected.position.y} suffix="mm" min={-500} max={500} disabled={busy} onChange={(value) => updateCellBlock(selected.id, { y: value })} /><NumericField label="Z" value={selected.z ?? 0} suffix="mm" min={0} max={300} disabled={busy} onChange={(value) => updateCellBlock(selected.id, { z: value })} /><NumericField label="R" value={selected.r} suffix="°" min={-360} max={360} disabled={busy} onChange={(value) => updateCellBlock(selected.id, { r: value })} /><button className="icon-button" aria-label={`${uiLanguage === "zh-Hant" ? "刪除" : "Delete"} ${selected.id}`} onClick={() => removeCellBlock(selected.id)} disabled={busy || (!freeMode && project.scene.blocks.length <= 1)}><Trash2 size={15} /></button></div></div>; })()}
    <p className="tool-mode-note">{uiLanguage === "zh-Hant" ? `平台頂面高 ${platformHeight(project.scene)} mm。Z 欄位調整工件離承托面的高度。` : `The platform top is ${platformHeight(project.scene)} mm. Z raises the workpiece above its support surface.`}</p>
    <p className="tool-mode-note">{(() => {
      const item = project.scene.blocks.find((block) => block.id === freeSelectedId) ?? project.scene.blocks[0];
      if (!item) return null;
      const body1 = project.tool.mode === "fork" && effectiveForkContactProfile(selectedForkProfile, project.scene.blocks, item.id) === "body1";
      const size = cellBlockSize(item, project.tool.mode);
      const height = body1 ? 40 : size.z;
      const support = size.z === 4 ? magneticSurfaceHeight(project.scene) : platformHeight(project.scene) + (project.tool.mode === "fork" ? FORK_SUPPORT_HEIGHT_MM : 0);
      const bottom = (item.z ?? 0) + support + (item.stackLevel ?? 0) * height;
      return uiLanguage === "zh-Hant" ? `桌面 Z0 → 平台頂 Z${platformHeight(project.scene)} → 工件底面 Z${bottom} → 工件中心 Z${bottom + height / 2} → 工件頂面 Z${bottom + height} mm` : `Table Z0 → platform top Z${platformHeight(project.scene)} → workpiece bottom Z${bottom} → centre Z${bottom + height / 2} → top Z${bottom + height} mm`;
    })()}</p><small role="status" aria-live="polite">{placementMessage || (project.scene.blocks.length === 0 ? (uiLanguage === "zh-Hant" ? "工作台目前是空的；先加入方塊或35×35×4 mm 磁吸片。" : "The table is empty. Add a block or magnetic plate to begin.") : (uiLanguage === "zh-Hant" ? "只按模擬器邏輯接觸；不模擬實體磁力、碰撞或穩定性。" : "Contact follows simulator rules; magnetic force, collisions and physical stability are not modeled."))}</small>
  </section> : null;

  return (
    <main className="app-shell learning-studio">
      <header className="topbar">
        <a className="brand-lockup" href="#" onClick={(event) => { event.preventDefault(); openWorkbench("practice"); if (!busy) { setPracticeLessonId(null); setPracticePrepared(false); } }} aria-label={uiLanguage === "zh-Hant" ? "返回練習首頁" : "Practice home"}>
          <div className="brand-mark"><Activity size={24} /></div><div><strong>MG400 Lab</strong><small>{uiLanguage === "zh-Hant" ? "機械臂學習工作台" : "Robot learning studio"}</small></div>
        </a>
        <nav className="workbench-nav" aria-label={uiLanguage === "zh-Hant" ? "工作台導覽" : "Workspace navigation"}>
          {(["practice", "program", "points", "objects"] as const).map((view) => <button key={view} type="button" aria-current={workbenchView === view ? "page" : undefined} onClick={() => openWorkbench(view)} disabled={busy && view === "objects"}>{uiLanguage === "zh-Hant" ? ({practice:"練習",program:"程式",points:"教點與移動",objects:"自由擺放"})[view] : ({practice:"Practice",program:"Code",points:"Teach & move",objects:"Free play"})[view]}</button>)}
        </nav>
        <div className="topbar-actions"><span className="saved-state" title={uiLanguage === "zh-Hant" ? "專案自動儲存於這個瀏覽器" : "Project autosaves in this browser"}><HardDrive size={16} />{saved ? (uiLanguage === "zh-Hant" ? "已儲存" : "Saved") : (uiLanguage === "zh-Hant" ? "儲存中" : "Saving")}</span>
          <button className="theme-toggle" type="button" aria-label={uiLanguage === "zh-Hant" ? (workspaceTheme === "light" ? "切換深色模式" : "切換淺色模式") : (workspaceTheme === "light" ? "Switch to dark mode" : "Switch to light mode")} title={uiLanguage === "zh-Hant" ? (workspaceTheme === "light" ? "切換深色模式" : "切換淺色模式") : "Switch workspace theme"} onClick={() => { const next = workspaceTheme === "light" ? "dark" : "light"; setWorkspaceTheme(next); saveWorkspaceTheme(next); }}>{workspaceTheme === "light" ? <Moon size={19} /> : <Sun size={19} />}<span>{uiLanguage === "zh-Hant" ? (workspaceTheme === "light" ? "深色" : "淺色") : (workspaceTheme === "light" ? "Dark" : "Light")}</span></button>
          <button className="help-button" disabled={busy} onClick={() => { setTrainingLessonId(null); setShowTraining(true); }}><BookOpenCheck size={18} />{uiLanguage === "zh-Hant" ? "課程" : "Lessons"}</button>
          <details className="workspace-menu"><summary aria-label={uiLanguage === "zh-Hant" ? "專案與設定" : "Project and settings"}><Settings2 size={20} /><span>{uiLanguage === "zh-Hant" ? "更多" : "More"}</span></summary><div>
            <button onClick={(event) => { openWorkbench("settings"); event.currentTarget.closest("details")?.removeAttribute("open"); }}>{uiLanguage === "zh-Hant" ? "工具與進階設定" : "Tool & advanced settings"}</button>
            <button onClick={restorePracticeProject} disabled={busy || !window.localStorage.getItem("mg400-before-practice-v1")}>{uiLanguage === "zh-Hant" ? "還原開始練習前的專案" : "Restore project before practice"}</button>
            <button onClick={() => fileInputRef.current?.click()} disabled={busy}>{ui.import}</button><button onClick={downloadProject}>{ui.export}</button>
            <button onClick={() => setUiLanguage((current) => current === "zh-Hant" ? "en" : "zh-Hant")}>{uiLanguage === "zh-Hant" ? "Switch to English" : "切換至繁體中文"}</button>
          </div></details>
          <input ref={fileInputRef} name="project-file" type="file" accept="application/json,.json" className="visually-hidden" hidden onChange={(event) => void importProject(event.target.files?.[0])} />
        </div>
      </header>

      {convertedRoundPieces && <div className="model-warning" role="status">{uiLanguage === "zh-Hant" ? "舊工作格的圓件已轉為 35×35×4 mm 磁吸片。程式與教點已保留；請重新示教取放高度，或選擇已準備好的練習。" : "Older round workpieces were converted to 35×35×4 mm plates. Code and points are preserved: re-teach contact heights or choose a prepared practice."}</div>}
      {modelError && <div className="model-warning" role="alert" aria-live="assertive"><AlertCircle size={16} /><strong>{ui.modelLoadHeading}</strong><span>{localizeWorkspaceMessage(modelError, uiLanguage)}</span></div>}
      {missingToolModels.length > 0 && <div className="model-warning" role="alert"><AlertCircle size={16} /><strong>{ui.modelLoadHeading}</strong><span>{uiLanguage === "zh-Hant" ? `未能載入 ${missingToolModels.join("、")}。請重新整理，或到「更多 → 工具與進階設定」匯入模型。已載入的工具仍可使用。` : `Could not load ${missingToolModels.join(", ")}. Refresh or import the model in More → Tool & advanced settings. Loaded tools remain available.`}</span></div>}

      <div className={`workspace-grid view-${workbenchView}`}>
        <aside className="left-workspace" aria-label={uiLanguage === "zh-Hant" ? "目前工作" : "Current task"}>
          <section className="practice-panel" hidden={workbenchView !== "practice"}>
            {!practiceLesson ? <>
              <h1>{uiLanguage === "zh-Hant" ? "由第一個小練習開始" : "Start with a small practice"}</h1>
              <p className="practice-intro">{uiLanguage === "zh-Hant" ? "不用先學識寫程式。跟住步驟，親眼看看你的指令會做甚麼。" : "No coding experience needed. Follow a short practice and see what your instructions do."}</p>
              <button className="practice-start primary-action" onClick={() => preparePractice("foundation-first-program")} disabled={busy || !kinematics}><Play size={20} />{uiLanguage === "zh-Hant" ? "開始第一個練習" : "Start your first practice"}</button>
              <p className="practice-hint">{uiLanguage === "zh-Hant" ? "約 2 分鐘 · 讓程式顯示一句問候文字" : "About 2 minutes · Make your program say hello"}</p>
              <h2>{uiLanguage === "zh-Hant" ? "想試試機械臂？" : "Ready to try the robot?"}</h2>
              <div className="practice-choices">
                {[["intermediate-rotate-carried-block", "取件後旋轉 90°", "先取起，再抬升、旋轉及放置", "Pick then rotate 90°", "Pick up, lift, turn, then place"], ["intermediate-pick-and-place", "磁吸片取放", "使用磁吸工具取放 35×35×4 mm 工件", "Magnetic pick & place", "Pick and place a 35×35×4 mm plate"], ["foundation-first-robot-move", "第一次移動", "讓機械臂平滑前往一個教點", "Your first move", "Move smoothly to a taught point"], ["intermediate-passive-fork", "叉臂取放積木", "使用你提供的叉具及 Body1 槽積木", "Fork pick & place", "Use the supplied fork and Body1 block"], ["intermediate-three-layer-tower", "旋轉並堆成三層塔", "先取件，再轉 90°，逐層放好", "Rotate and build a tower", "Pick, rotate 90°, then place three layers"], ["intermediate-black-white-sort", "分類黑白方塊", "用 if / else 分類，再取出方塊", "Sort black and white", "Use if / else to sort and unload"]].map(([id,zh,detail,en,enDetail]) => <button key={id} onClick={() => preparePractice(id)} disabled={busy || !kinematics || (id === "intermediate-passive-fork" && !localToolMeshes.bundledFork) || (id === "intermediate-pick-and-place" && !localToolMeshes.magnet)}><span><strong>{uiLanguage === "zh-Hant" ? zh : en}</strong><small>{uiLanguage === "zh-Hant" ? detail : enDetail}</small></span><ArrowRight size={20} /></button>)}
              </div>
              <button className="text-button" onClick={() => { setTrainingLessonId(null); setShowTraining(true); }}>{uiLanguage === "zh-Hant" ? "查看全部課程" : "Browse all lessons"}<ArrowRight size={17} /></button>
            </> : <>
              <button className="practice-back" onClick={() => { setPracticeLessonId(null); setPracticePrepared(false); }} disabled={busy}><ArrowLeft size={17} />{uiLanguage === "zh-Hant" ? "選另一個練習" : "Choose another practice"}</button>
              <h1>{practiceLesson.title[uiLanguage]}</h1>
              <p className="practice-intro">{practiceIsPrint ? (uiLanguage === "zh-Hant" ? "讓程式顯示一句文字。這個練習不會移動機械臂。" : "Display a message. This practice does not move the robot.") : practiceLessonId === "intermediate-passive-fork" && selectedForkProfile === "body1" ? (uiLanguage === "zh-Hant" ? "使用 40×40×40 mm 槽積木：滑入槽口、抬升、放下及水平退出，全程毋須 DO。" : "Use the 40×40×40 mm slotted block: slide into its slots, lift, lower, and withdraw horizontally. No DO is needed.") : practiceLesson.outcome[uiLanguage]}</p>
              <ol className="practice-steps">
                <li className={practicePrepared ? "step-done" : "step-current"}><span>{practicePrepared ? <Check size={18} /> : "1"}</span><div><strong>{uiLanguage === "zh-Hant" ? "準備練習" : "Prepare"}</strong><p>{practicePrepared ? (uiLanguage === "zh-Hant" ? (practiceIsPrint ? "三行程式已準備好。" : "工具、工作格及教點已準備好。") : "The example is ready.") : (uiLanguage === "zh-Hant" ? "先建立這課的範例工作格。" : "Prepare the example for this lesson.")}</p>{!practicePrepared && <button className="primary-action" onClick={() => preparePractice(practiceLesson.id)} disabled={busy}>{uiLanguage === "zh-Hant" ? "準備這個練習" : "Prepare this practice"}</button>}</div></li>
                <li className={practicePrepared && status !== "complete" ? "step-current" : status === "complete" && practicePrepared ? "step-done" : ""}><span>2</span><div><strong>{uiLanguage === "zh-Hant" ? "執行並觀察" : "Run and watch"}</strong><p>{uiLanguage === "zh-Hant" ? "按工作台上方的「執行練習」。結果會顯示在下方。" : "Press Run practice above the worktable. See the result below it."}</p>{practicePrepared && <button className="text-button" onClick={() => openWorkbench("program")}>{uiLanguage === "zh-Hant" ? "先看看程式" : "Read the code first"}<ArrowRight size={16} /></button>}</div></li>
                <li className={status === "complete" && practicePrepared ? "step-current" : ""}><span>3</span><div><strong>{uiLanguage === "zh-Hant" ? "試改一小步" : "Make a small change"}</strong><p>{practiceIsPrint ? (uiLanguage === "zh-Hant" ? "打開「程式」，把 Hello 改成你的名字，再執行一次。" : "Open Code, change Hello to your name, and run again.") : (uiLanguage === "zh-Hant" ? "打開「教點與移動」或「程式」，探索指令如何改變動作。" : "Open Teach & move or Code to explore how instructions change motion.")}</p></div></li>
              </ol>
              <button className="text-button" onClick={() => { setTrainingLessonId(practiceLesson.id); setShowTraining(true); }}>{uiLanguage === "zh-Hant" ? "閱讀這課的說明與小測" : "Read this lesson and quiz"}<BookOpenCheck size={17} /></button>
            </>}
          </section>
          <section className="free-workspace" hidden={workbenchView !== "objects"}><h1>{uiLanguage === "zh-Hant" ? "自由擺放" : "Free play"}</h1><p>{uiLanguage === "zh-Hant" ? "加入物件，選取它，再點工作台決定位置。" : "Add an object, select it, then click the worktable to place it."}</p>{freeModeTopPanel}</section>
          <section className="settings-intro" hidden={workbenchView !== "settings"}><h1>{uiLanguage === "zh-Hant" ? "工具與設定" : "Tools & settings"}</h1><p>{uiLanguage === "zh-Hant" ? "日常練習已備好工具。只有使用不同模型或自訂工作格時，才需要調整以下設定。" : "Practices configure the tool for you. Adjust these settings for custom models or cells."}</p></section>
          <section className="panel code-panel" hidden={workbenchView !== "program"}>
            <div className="panel-heading code-heading">
                <div className="heading-title"><span className="heading-icon purple-icon"><Code2 size={17} /></span><div><h2>{uiLanguage === "zh-Hant" ? "程式" : "Program"}</h2><small>{project.programmingLanguage === "lua" ? "Lua · MG400 訓練子集" : "Python · 僅供模擬器，不能控制實機"}</small></div></div>
              <div className="heading-tools">
                <button
                  type="button"
                  className={`coach-toggle${coachOpen ? " is-active" : ""}`}
                  aria-expanded={coachOpen}
                  aria-controls="coach-dock"
                  onClick={() => setCoachOpen((open) => !open)}
                >
                  <Sparkles size={13} /><span>{uiLanguage === "zh-Hant" ? "AI 程式教練" : "AI coach"}</span><span className="coach-state coach-ready">{uiLanguage === "zh-Hant" ? "可選 BYOK" : "Optional BYOK"}</span>
                </button>
                <div className="program-language-tabs" role="group" aria-label={ui.programmingLanguage}><button title={uiLanguage === "zh-Hant" ? "Lua · MG400 訓練語言" : "Lua · MG400 training language"} aria-label={uiLanguage === "zh-Hant" ? "Lua，MG400 訓練語言" : "Lua, MG400 training language"} aria-pressed={project.programmingLanguage === "lua"} onClick={() => setProgramLanguage("lua")} disabled={busy}>Lua</button><button title={uiLanguage === "zh-Hant" ? "Python · 僅供模擬器，不能在 Dobot 控制器執行" : "Python · simulator-only, not Dobot controller code"} aria-label={uiLanguage === "zh-Hant" ? "Python，僅供模擬器，不能在 Dobot 控制器執行" : "Python, simulator-only and not Dobot controller code"} aria-pressed={project.programmingLanguage === "python"} onClick={() => setProgramLanguage("python")} disabled={busy}>Python</button></div>
                <button className="small-icon-button mobile-import-button" title={ui.import} aria-label={ui.import} onClick={() => fileInputRef.current?.click()} disabled={busy}><Upload size={15} /></button>
                <button className="small-icon-button" title={ui.exportProject} aria-label={ui.exportProject} onClick={downloadProject}><Download size={15} /></button>
              </div>
            </div>
            <div className="editor-wrapper">
              {showWorkshop ? <Suspense fallback={<div className="editor-loading"><LoaderCircle className="spin" size={18} />{uiLanguage === "zh-Hant" ? "正在準備編輯器…" : `Preparing ${project.programmingLanguage === "lua" ? "Lua" : "Python"} editor…`}</div>}>
                  <Editor
                    key={project.programmingLanguage}
                    language={project.programmingLanguage}
                    theme={workspaceTheme === "dark" ? "mg400-dark" : "mg400-light"}
                    value={programText}
                    beforeMount={editorBeforeMount}
                    onChange={(value) => replaceProject((current) => current.programmingLanguage === "lua"
                      ? { ...current, script: value ?? "" }
                      : { ...current, pythonScript: value ?? "" })}
                    options={{ ...editorOptions(project.programmingLanguage === "lua" ? "Lua program editor" : "Python program editor"), readOnly: busy }}
                    loading={<div className="editor-loading"><LoaderCircle className="spin" size={18} />{uiLanguage === "zh-Hant" ? "正在準備編輯器…" : "Preparing editor…"}</div>}
                  />
                </Suspense> : <div className="editor-preview">
                  <pre aria-label={uiLanguage === "zh-Hant" ? "程式預覽" : "Program preview"}>{programText}</pre>
                  <button type="button" onClick={() => openWorkbench("program")}>{uiLanguage === "zh-Hant" ? "打開編輯器及控制" : "Open editor and controls"}</button>
                </div>}
            </div>
            <div className="editor-footnote"><span><span className="mini-dot" /> {uiLanguage === "zh-Hant" ? (project.programmingLanguage === "lua" ? "Lua 在本機 Web Worker 執行" : "Python 在本機 Pyodide Web Worker 執行") : (project.programmingLanguage === "lua" ? "Lua runs in a local Web Worker" : "Python runs in a local Pyodide Web Worker")}</span><span>{uiLanguage === "zh-Hant" ? "執行此編輯器內容 · 僅供模擬器" : "Run uses this editor · simulator only"}</span></div>
            <details className="syntax-snippets">
              <summary>{uiLanguage === "zh-Hant" ? "初學者範例 · 插入" : "Beginner snippets · insert into"} {project.programmingLanguage === "lua" ? "Lua" : "Python"}</summary>
              <p>{uiLanguage === "zh-Hant" ? "本機範例毋須 API key。插入範例、閱讀說明，再於模擬器執行。" : "Local examples need no API key. Insert one, read the explanation, then run it in the simulator."}</p>
              <div className="snippet-grid">
                <button type="button" onClick={() => insertSnippet(project.programmingLanguage === "lua" ? "local ready = true\nif ready then\n  print(\"ready\")\nelse\n  print(\"check setup\")\nend" : "ready = True\nif ready:\n    print(\"ready\")\nelse:\n    print(\"check setup\")")}><strong>{uiLanguage === "zh-Hant" ? "條件判斷" : "If / else"}</strong><span>{uiLanguage === "zh-Hant" ? "根據條件選擇其中一個分支。" : "Choose one branch from a defined condition."}</span></button>
                <button type="button" onClick={() => insertSnippet(project.programmingLanguage === "lua" ? "for layer = 1, 3 do\n  print(\"cycle\", layer)\nend" : "for layer in range(3):\n    print(\"cycle\", layer)")}><strong>{uiLanguage === "zh-Hant" ? "有限次迴圈" : "Bounded loop"}</strong><span>{uiLanguage === "zh-Hant" ? "重複已知次數，避免無限執行。" : "Repeat a known number of cycles."}</span></button>
                <button type="button" onClick={() => insertSnippet(project.programmingLanguage === "lua" ? "MovJ(PickApproach, {CP=0})\nMovL(PickPoint, {CP=0})\nRelMovL({0, 0, 80, 0}, {CP=0})" : "await mov_j(PickApproach, cp=0)\nawait mov_l(PickPoint, cp=0)\nawait rel_mov_l([0, 0, 80, 0], cp=0")}><strong>{uiLanguage === "zh-Hant" ? "移動流程" : "Move sequence"}</strong><span>{uiLanguage === "zh-Hant" ? "先關節移動，再直線移動，最後相對抬升。" : "Joint move, linear move, then relative lift."}</span></button>
                <button type="button" onClick={() => insertSnippet(project.programmingLanguage === "lua"
                  ? (project.tool.mode === "magnet" ? "MovJ(PickPoint, {CP=0})\nDO(1, ON)\nRelMovL({0, 0, 80, 0}, {CP=0})\nDO(1, OFF)\nSync()" : "JointMovJ(Home, {CP=0})\nMovJ(PickApproach, {CP=0})\nMovL(PickPoint, {CP=0})\nRelMovL({0, 0, 80, 0}, {CP=0})\nJointMovJ(Home, {CP=0})\nSync()")
                  : (project.tool.mode === "magnet" ? "await mov_j(PickPoint, cp=0)\ndo(1, True)\nawait rel_mov_l([0, 0, 80, 0], cp=0)\ndo(1, False)\nawait sync()" : "await joint_mov_j(Home, cp=0)\nawait mov_j(PickApproach, cp=0)\nawait mov_l(PickPoint, cp=0)\nawait rel_mov_l([0, 0, 80, 0], cp=0)\nawait joint_mov_j(Home, cp=0)\nawait sync()"))}><strong>{uiLanguage === "zh-Hant" ? "工具規則" : "Tool rule"}</strong><span>{project.tool.mode === "magnet" ? (uiLanguage === "zh-Hant" ? "磁吸工具吸附及釋放範例。" : "Standalone Magnet attach example.") : (uiLanguage === "zh-Hant" ? "被動叉臂移動範例；不使用 DO。" : "Standalone passive Fork motion example; no DO.")}</span></button>
              </div>
            </details>
          </section>

          <section className="panel motion-panel" hidden={workbenchView !== "points" && workbenchView !== "settings"}>
            <div className="motion-panel-header">
              <div className="segmented-tabs" role="tablist" aria-label={ui.jogControls}>
                <button
                  id="teach-motion-tab"
                  className={selectedTab === "points" ? "active-tab" : ""}
                  onClick={() => setSelectedTab("points")}
                  onKeyDown={(event) => {
                    const tabs = Array.from(event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="tab"]') ?? []);
                    const nextIndex = getRovingFocusIndex(event.key, tabs.indexOf(event.currentTarget), tabs.length, "horizontal");
                    if (nextIndex === null) return;
                    event.preventDefault();
                    setSelectedTab(nextIndex === 0 ? "points" : "jog");
                    tabs[nextIndex]?.focus();
                  }}
                  role="tab"
                  aria-selected={selectedTab === "points"}
                  aria-controls="teach-motion-panel"
                  tabIndex={selectedTab === "points" ? 0 : -1}
                ><Target size={15} /> {uiLanguage === "zh-Hant" ? "示教" : "Teach"}</button>
                <button
                  id="jog-motion-tab"
                  className={selectedTab === "jog" ? "active-tab" : ""}
                  onClick={() => setSelectedTab("jog")}
                  onKeyDown={(event) => {
                    const tabs = Array.from(event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="tab"]') ?? []);
                    const nextIndex = getRovingFocusIndex(event.key, tabs.indexOf(event.currentTarget), tabs.length, "horizontal");
                    if (nextIndex === null) return;
                    event.preventDefault();
                    setSelectedTab(nextIndex === 0 ? "points" : "jog");
                    tabs[nextIndex]?.focus();
                  }}
                  role="tab"
                  aria-selected={selectedTab === "jog"}
                  aria-controls="jog-motion-panel"
                  tabIndex={selectedTab === "jog" ? 0 : -1}
                ><Settings2 size={15} /> {uiLanguage === "zh-Hant" ? "點動" : "Jog"}</button>
              </div>
              <button className="tool-settings-toggle" onClick={() => openWorkbench("settings")} aria-expanded={showToolSettings}><Wrench size={15} /> {ui.tool} <ChevronDown size={15} className={showToolSettings ? "chevron-open" : ""} /></button>
            </div>
            {selectedTab === "points" ? <div className="motion-content teach-content" id="teach-motion-panel" role="tabpanel" aria-labelledby="teach-motion-tab">
              <div className="teach-help"><span className="teach-icon"><Target size={18} /></span><div><strong>{uiLanguage === "zh-Hant" ? "從目前模擬姿勢示教" : "Teach from the current simulated pose"}</strong><span>{uiLanguage === "zh-Hant" ? <>示教點會以名稱儲存目標。示教目前位置會保存 TCP 座標；儲存關節點會保存 J1–J4 角度。程式可使用 <code>PickApproach</code>，毋須直接輸入數字。</> : <>A teach point saves a target by name. Teach current pose stores TCP coordinates; Save joint point stores J1–J4 angles. Your program can use <code>PickApproach</code> instead of raw numbers.</>}</span></div></div>
              <div className="teach-controls"><button className="secondary-button" onClick={addCartesianPoint} disabled={busy || project.points.length >= 100}><Plus size={15} /> {uiLanguage === "zh-Hant" ? "示教目前位置" : "Teach current pose"}</button><button className="secondary-button outlined-button" onClick={addJointPoint} disabled={busy || project.points.length >= 100}><Plus size={15} /> {uiLanguage === "zh-Hant" ? "儲存關節點" : "Save joint point"}</button><button className="secondary-button outlined-button" onClick={() => addReferencePair("pick")} disabled={busy || project.points.length > 98}><Plus size={15} /> {uiLanguage === "zh-Hant" ? "示教拾取點組" : "Teach pick pair"}</button><button className="secondary-button outlined-button" onClick={() => addReferencePair("place")} disabled={busy || project.points.length > 98}><Plus size={15} /> {uiLanguage === "zh-Hant" ? "示教放置點組" : "Teach place pair"}</button>{selectedPoint && <button className="secondary-button outlined-button" onClick={moveToSelected} disabled={busy}><Crosshair size={15} /> {uiLanguage === "zh-Hant" ? "前往所選" : "Go to selected"}</button>}</div>
              <div className="reference-note"><span className="block-swatch" /><span className="block-size">{uiLanguage === "zh-Hant" ? "方塊" : "Block"} {format(referenceSize.x, 0)} × {format(referenceSize.y, 0)} × {format(project.tool.mode === "fork" && forkProfile === "body1" ? 40 : referenceSize.z, 0)} mm</span><span className="block-direction-note"><b aria-hidden="true">→</b> {uiLanguage === "zh-Hant" ? "工件局部 +X" : "block-local +X"}</span><span className="note-divider" /><span className="reference-tool-guidance">{uiLanguage === "zh-Hant" ? (project.tool.mode === "magnet" ? `TCP 從法蘭沿 X ${tcpOffsetXLabel} · 磁吸接觸方塊頂面 · DO1 只在模擬器生效` : `TCP 從法蘭沿 X ${tcpOffsetXLabel} · ${forkProfile === "body1" ? `Body1 插入 Z${platformHeight(project.scene) + 42.5}／承托 Z${platformHeight(project.scene) + 45}` : `叉臂支撐 Z=${platformHeight(project.scene) + FORK_SUPPORT_HEIGHT_MM} mm`} · 不使用 DO`) : (project.tool.mode === "magnet" ? `TCP X ${tcpOffsetXLabel} from flange · magnet contact is on top · DO1 is simulator-only` : `TCP X ${tcpOffsetXLabel} from flange · ${forkProfile === "body1" ? `Body1 insertion Z${platformHeight(project.scene) + 42.5} / support Z${platformHeight(project.scene) + 45}` : `passive fork support Z=${platformHeight(project.scene) + FORK_SUPPORT_HEIGHT_MM} mm`} · no DO`)}</span></div>
            </div> : <div className="motion-content jog-content" id="jog-motion-panel" role="tabpanel" aria-labelledby="jog-motion-tab">
              <div className="jog-group cartesian-jog">
                <div className="jog-group-title"><Crosshair size={14} /> {uiLanguage === "zh-Hant" ? "笛卡兒座標" : "CARTESIAN"} <label>{uiLanguage === "zh-Hant" ? "步距" : "step"} <input aria-label={ui.cartesianStep} type="number" min="1" max="100" value={jogStep} disabled={busy} onChange={(event) => setJogStep(Math.max(1, Math.min(100, Number(event.target.value) || 1)))} /> mm</label></div>
                <div className="jog-button-grid">
                  <span /><button aria-label={uiLanguage === "zh-Hant" ? "沿 X 正方向點動" : "Jog X positive"} onClick={() => jogCartesian("x", jogStep)} disabled={busy}><ArrowRight size={16} /> X+</button><span />
                  <button aria-label={uiLanguage === "zh-Hant" ? "沿 Y 正方向點動" : "Jog Y positive"} onClick={() => jogCartesian("y", jogStep)} disabled={busy}><ArrowUp size={16} /> Y+</button><button className="jog-center" onClick={resetRobot} disabled={busy} aria-label={ui.resetRobot} title={ui.resetRobot}><RotateCcw size={14} /></button><button aria-label={uiLanguage === "zh-Hant" ? "沿 Y 負方向點動" : "Jog Y negative"} onClick={() => jogCartesian("y", -jogStep)} disabled={busy}><ArrowDown size={16} /> Y−</button>
                  <span /><button aria-label={uiLanguage === "zh-Hant" ? "沿 X 負方向點動" : "Jog X negative"} onClick={() => jogCartesian("x", -jogStep)} disabled={busy}><ArrowLeft size={16} /> X−</button><span />
                </div>
                <div className="vertical-jog"><button onClick={() => jogCartesian("z", jogStep)} aria-label={uiLanguage === "zh-Hant" ? "沿 Z 正方向點動" : "Jog Z positive"} disabled={busy}>Z+ <ArrowUp size={15} /></button><button onClick={() => jogCartesian("z", -jogStep)} aria-label={uiLanguage === "zh-Hant" ? "沿 Z 負方向點動" : "Jog Z negative"} disabled={busy}>Z− <ArrowDown size={15} /></button><button onClick={() => jogCartesian("r", 5)} aria-label={uiLanguage === "zh-Hant" ? "正向旋轉 R 5 度" : "Rotate R positive"} disabled={busy}>R+ 5°</button><button onClick={() => jogCartesian("r", -5)} aria-label={uiLanguage === "zh-Hant" ? "反向旋轉 R 5 度" : "Rotate R negative"} disabled={busy}>R− 5°</button></div>
              </div>
              <div className="jog-group joint-jog">
                <div className="jog-group-title"><Activity size={14} /> {uiLanguage === "zh-Hant" ? "關節" : "JOINTS"} <label>{uiLanguage === "zh-Hant" ? "步距" : "step"} <input aria-label={ui.jointStep} type="number" min="1" max="30" value={jointStep} disabled={busy} onChange={(event) => setJointStep(Math.max(1, Math.min(30, Number(event.target.value) || 1)))} /> °</label></div>
                <div className="joint-jog-list">{joints.map((joint, index) => <div className="joint-jog-row" key={index}><span>J{index + 1}</span><button aria-label={uiLanguage === "zh-Hant" ? `J${index + 1} 負方向點動` : `Jog J${index + 1} negative`} onClick={() => jogJoint(index, -1)} disabled={busy}>−</button><div className="joint-meter"><span style={{ width: `${Math.max(0, Math.min(100, ((deg(joint) - JOINT_LIMITS_DEG[index].min) / (JOINT_LIMITS_DEG[index].max - JOINT_LIMITS_DEG[index].min)) * 100))}%` }} /></div><strong>{format(deg(joint), 0)}°</strong><button aria-label={uiLanguage === "zh-Hant" ? `J${index + 1} 正方向點動` : `Jog J${index + 1} positive`} onClick={() => jogJoint(index, 1)} disabled={busy}>+</button></div>)}</div>
              </div>
            </div>}
            {showToolSettings && <div className="tool-settings-content">
              <details className="tool-settings-copy"><summary>{uiLanguage === "zh-Hant" ? "TCP 與工具安裝說明" : "TCP and tool mounting"}</summary>
                <div className="mode-banner"><strong>{freeMode ? ui.freeCellHeading : ui.guidedCellHeading}</strong><span>{freeMode ? ui.freeCellDescription : ui.guidedCellDescription}</span></div>
              <strong>{ui.flangeToTcp}</strong>
                <div className="tool-offset-diagram" aria-hidden="true">
                  <span className="tool-offset-node tool-wrist">{ui.robotWrist}</span>
                  <span className="tool-offset-lead" />
                  <span className="tool-offset-node tool-flange">{ui.flange}</span>
                  <span className="tool-offset-route"><small>{ui.toolLocalX}</small><i /><b>{tcpOffsetXLabel}</b></span>
                  <span className="tool-offset-node tool-tcp">TCP</span>
                </div>
                <p className="tool-offset-explanation">{ui.flangeExplanation}</p>
                <p className="tool-offset-explanation">{ui.toolBehavior}</p>
              </details>
              <div className="tool-setting-groups"><label className="speed-control"><Gauge size={18} />{uiLanguage === "zh-Hant" ? "模擬速度" : "Simulation speed"}<input type="range" min="10" max="200" step="10" value={project.simulation.speed} onChange={(event) => replaceProject((current) => ({ ...current, simulation: { ...current.simulation, speed: Number(event.target.value) } }))} /><output>{project.simulation.speed}%</output></label>
                <div className="tool-setting-group">
                  <label className="tool-mode-field" htmlFor="tool-mode">{ui.activeTool}
                    <select id="tool-mode" value={project.tool.mode} disabled={busy} onChange={(event) => {
                      const mode = event.currentTarget.value as ProjectDocument["tool"]["mode"];
                      replaceProject((current) => {
                        const previousMode = current.tool.mode;
                        const luaTemplate = [getStarterProgram("lua", previousMode, forkProfile), recommendedProgram("lua", previousMode, forkProfile)];
                        const pythonTemplate = [getStarterProgram("python", previousMode, forkProfile), recommendedProgram("python", previousMode, forkProfile)];
                        return {
                          ...current,
                          script: luaTemplate.includes(current.script) ? getStarterProgram("lua", mode, forkProfile) : current.script,
                          pythonScript: pythonTemplate.includes(current.pythonScript) ? getStarterProgram("python", mode, forkProfile) : current.pythonScript,
                          tool: { ...current.tool, mode },
                        };
                      });
                      addLog(`${mode === "magnet" ? (uiLanguage === "zh-Hant" ? "已切換至磁吸工具。" : "Switched to Magnet.") : (uiLanguage === "zh-Hant" ? "已切換至叉臂工具。" : "Switched to Fork.")} ${ui.toolModeChanged}`, "info");
                    }}>
                      <option value="magnet">{uiLanguage === "zh-Hant" ? "磁吸拾取" : "Magnet pickup"}</option>
                      <option value="fork">{uiLanguage === "zh-Hant" ? "叉臂拾取" : "Fork pickup"}</option>
                    </select>
                  </label>
                </div>
                <div className="tool-setting-group tool-mesh-import">
                  <strong className="tool-setting-group-title">{ui.toolMeshTitle}</strong>
                  <p className="tool-mode-note">{ui.toolMeshDescription}</p><ul className="loaded-model-list">{(["magnet", "fork", "block"] as const).map((kind) => <li key={kind}>{uiLanguage === "zh-Hant" ? ({magnet: "磁吸工具", fork: "無動力叉臂", block: "槽積木"})[kind] : ({magnet: "Magnetic tool", fork: "Passive fork", block: "Grooved block"})[kind]} · {localToolMeshes[kind] ? `${localToolMeshes.names?.[kind] ?? "STL"} ✓` : (uiLanguage === "zh-Hant" ? "尚未載入" : "Not loaded")}</li>)}</ul>
                  <div className="tool-import-actions">
                    <button className="secondary-button outlined-button" type="button" onClick={() => { toolMeshKindRef.current = "magnet"; toolMeshInputRef.current?.click(); }} disabled={busy}>{ui.importMagnet}</button>
                    <button className="secondary-button outlined-button" type="button" onClick={() => { toolMeshKindRef.current = "fork"; toolMeshInputRef.current?.click(); }} disabled={busy}>{ui.importFork}</button>
                    <button className="secondary-button outlined-button" type="button" onClick={() => blockMeshInputRef.current?.click()} disabled={busy}>{uiLanguage === "zh-Hant" ? "本機匯入 Body1 方塊 STL" : "Import Body1 block STL locally"}</button>
                  </div>
                  {localToolMeshes.block && <label className="tool-mode-field" htmlFor="fork-contact-profile">{uiLanguage === "zh-Hant" ? "首個槽積木的接觸校準" : "First grooved block workpiece calibration"}
                    <select id="fork-contact-profile" disabled={busy} value={selectedForkProfile} onChange={(event) => {
                      const profile = event.currentTarget.value as ForkContactProfile;
                      const activeProfile = effectiveForkContactProfile(profile, project.scene.blocks, project.scene.blocks.find((block) => Math.hypot(block.position.x - project.scene.block.x, block.position.y - project.scene.block.y) <= 1)?.id);
                      setLocalToolMeshes((current) => ({ ...current, blockProfile: profile }));
                      replaceProject((current) => ({ ...current,
                        script: current.tool.mode === "fork" && [getStarterProgram("lua", "fork", forkProfile), recommendedProgram("lua", "fork", forkProfile)].includes(current.script) ? getStarterProgram("lua", "fork", activeProfile) : current.script,
                        pythonScript: current.tool.mode === "fork" && [getStarterProgram("python", "fork", forkProfile), recommendedProgram("python", "fork", forkProfile)].includes(current.pythonScript) ? getStarterProgram("python", "fork", activeProfile) : current.pythonScript,
                      }));
                    }}><option value="reference">{uiLanguage === "zh-Hant" ? `通用：底面承托 Z${platformHeight(project.scene) + 20}` : `Generic: bottom support Z${platformHeight(project.scene) + 20}`}</option><option value="body1" disabled={!localToolMeshes.fork}>{uiLanguage === "zh-Hant" ? "首個槽積木 Body1：40×40×40，槽 Z15–25，叉板 5 mm" : "First grooved block Body1: 40×40×40, grooves Z15–25, fork plate 5 mm"}</option></select>
                    <small>{uiLanguage === "zh-Hant" ? "內置 Body1 校準會自動載入，只套用首個槽積木。自訂模型請選擇適合的校準，再重新示教兩組教點。" : "Bundled Body1 calibration loads automatically for the first grooved block workpiece. For custom meshes, choose the appropriate calibration and re-teach both point pairs."}</small>
                  </label>}
                  <small className="tool-mode-note">{uiLanguage === "zh-Hant" ? "內置模型毋須手動匯入；自行匯入的 STL 只保留在目前瀏覽器工作階段。" : "Bundled models need no manual import; custom STL files stay in the current browser session."}</small>
                  <input ref={toolMeshInputRef} type="file" accept=".stl,model/stl" hidden onChange={(event) => { void importToolMesh(toolMeshKindRef.current, event.currentTarget.files?.[0]); event.currentTarget.value = ""; }} />
                  <input ref={blockMeshInputRef} type="file" accept=".stl,model/stl" hidden onChange={(event) => { void importForkBlockMesh(event.currentTarget.files?.[0]); event.currentTarget.value = ""; }} />
                  <small className="tool-mode-note" role="status">{toolMeshMessage}</small>
                </div>
                <details className="advanced-tool-settings"><summary>{ui.advanced}<span>{ui.calibration}</span></summary>
                {(["flangeOffset"] as const).map((path) => <div className="tool-setting-group" key={path}>
                  <strong className="tool-setting-group-title">{ui.flangeOffset}</strong>
                  <div className="tool-setting-fields">
                    {(["x", "y", "z", "r"] as const).map((axis) => <NumericField key={axis} label={`${axis.toUpperCase()}${axis === "r" ? (uiLanguage === "zh-Hant" ? " 旋轉" : " rotation") : ""}`} value={project.tool.flangeOffset[axis]} suffix={axis === "r" ? "°" : "mm"} step={1} disabled={busy} onChange={(value) => updateTool(path, axis, value)} />)}
                  </div>
                </div>)}
                <div className="tool-setting-group">
                  <strong className="tool-setting-group-title">{project.tool.mode === "magnet" ? ui.magnetTcp : ui.forkTcp}</strong>
                  <div className="tool-setting-fields">
                    {(["x", "y", "z", "r"] as const).map((axis) => <NumericField key={axis} label={`${axis.toUpperCase()}${axis === "r" ? (uiLanguage === "zh-Hant" ? " 旋轉" : " rotation") : ""}`} value={activeTcpOffset(project.tool)[axis]} suffix={axis === "r" ? "°" : "mm"} step={1} disabled={busy} onChange={(value) => updateTool("tcpOffsets", axis, value)} />)}
                  </div>
                </div>
                <div className="tool-setting-group">
                  <strong className="tool-setting-group-title">{ui.pickupTolerance}</strong>
                  <div className="tool-setting-fields two-fields">
                    <NumericField label="XY" value={project.tool.pickupTolerance.xy} suffix="mm" step={1} min={0} max={100} disabled={busy} onChange={(value) => updateTolerance("xy", value)} />
                    <NumericField label="Z" value={project.tool.pickupTolerance.z} suffix="mm" step={1} min={0} max={100} disabled={busy} onChange={(value) => updateTolerance("z", value)} />
                  </div>
                </div>
                <div className="tool-setting-group">
                  <strong className="tool-setting-group-title">{ui.referencePositions}</strong>
                  <div className="tool-setting-fields">
                    {(["block", "drop"] as const).flatMap((target) => (["x", "y"] as const).map((axis) => <NumericField key={`${target}-${axis}`} label={`${target === "block" ? (uiLanguage === "zh-Hant" ? "方塊" : "Block") : (uiLanguage === "zh-Hant" ? "放置區" : "Drop")} ${axis.toUpperCase()}`} value={project.scene[target][axis]} suffix="mm" step={1} disabled={busy} onChange={(value) => updateCellPosition(target, axis, value)} />))}
                  </div>
                </div>
                <div className="tool-setting-group cell-state-summary" aria-label={ui.cellState}>
                  <strong className="tool-setting-group-title">{ui.multiBlockCell}</strong>
                  <p>{freeMode ? "自由工作格" : "導引工作格"} · {project.scene.blocks.length} 件物件 · 一次只可邏輯接附一件</p>
                  <p>{ui.feederOrder}：{project.scene.feederOrder.map((id) => project.scene.blocks.find((block) => block.id === id)?.color ?? id).join(" → ")}</p>
                  {freeMode ? <div className="free-object-actions"><button className="secondary-button outlined-button" onClick={() => addCellObject("block")} disabled={busy}><Plus size={14} /> 加入 40×40×15 方塊</button><button className="secondary-button outlined-button" onClick={() => addCellObject("magnet")} disabled={busy}><Plus size={14} /> 加入35×35×4 mm 磁吸片</button><button className="secondary-button outlined-button" onClick={resetFreeCell} disabled={busy}><RotateCcw size={14} /> 重設自由工作格</button></div> : <button className="secondary-button outlined-button" onClick={addCellBlock} disabled={busy}><Plus size={14} /> {ui.supplyBlock}</button>}
                  <div className="cell-block-list">{project.scene.blocks.map((block) => <div key={block.id} className="cell-block-editor">
                    <span className={`cell-block-chip cell-block-${block.color}`} title={`${block.id} · ${block.source}`}>{cellObjectLabel(block)} · {block.id}</span>
                    {freeMode && <select aria-label={uiLanguage === "zh-Hant" ? `${block.id} 工件類型` : `${block.id} object type`} value={block.kind ?? "block"} disabled={busy} onChange={(event) => updateCellBlock(block.id, { kind: event.currentTarget.value as CellObjectKind })}><option value="block">方塊</option><option value="magnet">35×35×4 mm 磁吸片</option></select>}
                    <select aria-label={uiLanguage === "zh-Hant" ? `${block.id} 顏色` : `${block.id} color`} value={block.color} disabled={busy} onChange={(event) => updateCellBlock(block.id, { color: event.currentTarget.value as BlockColor })}><option value="neutral">{uiLanguage === "zh-Hant" ? "中性色" : "neutral"}</option><option value="black">{uiLanguage === "zh-Hant" ? "黑色" : "black"}</option><option value="white">{uiLanguage === "zh-Hant" ? "白色" : "white"}</option></select>
                    <select aria-label={uiLanguage === "zh-Hant" ? `${block.id} 物件狀態` : `${block.id} source`} value={block.source} disabled={busy} onChange={(event) => updateCellBlock(block.id, { source: event.currentTarget.value as BlockSource })}><option value="pickup">{uiLanguage === "zh-Hant" ? "拾取區" : "pickup"}</option><option value="feeder">{uiLanguage === "zh-Hant" ? "供料區" : "feeder"}</option><option value="output">{uiLanguage === "zh-Hant" ? "輸出區" : "output"}</option><option value="unloaded">{uiLanguage === "zh-Hant" ? "已卸下" : "unloaded"}</option></select>
                    <NumericField label="X" value={block.position.x} suffix="mm" step={1} min={-500} max={500} disabled={busy} onChange={(value) => updateCellBlock(block.id, { x: value })} />
                    <NumericField label="Y" value={block.position.y} suffix="mm" step={1} min={-500} max={500} disabled={busy} onChange={(value) => updateCellBlock(block.id, { y: value })} />
                    {freeMode && <NumericField label="Z" value={block.z ?? 0} suffix="mm" step={1} min={0} max={300} disabled={busy} onChange={(value) => updateCellBlock(block.id, { z: value })} />}
                    <NumericField label="R" value={block.r} suffix="°" step={1} min={-360} max={360} disabled={busy} onChange={(value) => updateCellBlock(block.id, { r: value })} />
                    <button className="icon-button" aria-label={uiLanguage === "zh-Hant" ? `移除 ${block.id}` : `Remove ${block.id}`} title={uiLanguage === "zh-Hant" ? `移除 ${block.id}` : `Remove ${block.id}`} onClick={() => removeCellBlock(block.id)} disabled={busy || (!freeMode && project.scene.blocks.length <= 1)}><Trash2 size={13} /></button>
                  </div>)}</div>
                  <p className="tool-mode-note">{ui.cellStateNote}</p>
                </div>
                </details>
              </div>
              <div className="io-state"><span className={`io-led ${outputs[1] ? "io-on" : ""}`} /> DO1 <strong>{project.tool.mode === "magnet" ? (outputs[1] ? (uiLanguage === "zh-Hant" ? "啟用 · 方塊已吸附" : "ON · BLOCK ATTACHED") : (uiLanguage === "zh-Hant" ? "停用 · 工具未接觸" : "OFF · TOOL CLEAR")) : (outputs[1] ? (uiLanguage === "zh-Hant" ? "啟用 · 僅輸出狀態" : "ON · OUTPUT ONLY") : (uiLanguage === "zh-Hant" ? "停用 · 僅輸出狀態" : "OFF · OUTPUT ONLY"))}</strong><span className="io-note">{project.tool.mode === "magnet" ? (uiLanguage === "zh-Hant" ? "模擬磁吸輸出" : "virtual magnet output") : (uiLanguage === "zh-Hant" ? "被動叉臂不使用此輸出" : "not used by the passive fork")}</span></div>
              <p className="tool-mode-note">{uiLanguage === "zh-Hant" ? `目前 TCP 相對法蘭 X 為 ${tcpOffsetXLabel}。${project.tool.mode === "fork" && forkProfile === "body1" ? `Body1：槽方向為方塊 R−90°；插入 Z${platformHeight(project.scene) + 42.5}、承托／釋放 Z${platformHeight(project.scene) + 45}；釋放後降回插入高度並水平退出60 mm，再抬高。` : `磁吸接觸頂面；通用叉臂在 Z${platformHeight(project.scene) + 20} 插入60 mm，拾取 R−90°、放置 R+90°。`} 更改工具或校準後須重新示教。僅供模擬，非實體校準。` : `TCP X ${tcpOffsetXLabel}. ${project.tool.mode === "fork" && forkProfile === "body1" ? `Body1: block R−90°, insert Z${platformHeight(project.scene) + 42.5}, load/release Z${platformHeight(project.scene) + 45}; lower to the insertion height and withdraw60 mm before lifting.` : `Magnet contacts the top; generic fork inserts at Z${platformHeight(project.scene) + 20} with pick R−90°/place R+90°.`} Re-teach after tool/calibration changes; simulation only.`}</p>
            </div>}
          </section>


          <section className="panel points-panel" hidden={workbenchView !== "points"}>
            <div className="panel-heading compact-heading">
              <div className="heading-title"><span className="heading-icon teal-icon"><Target size={17} /></span><div><h2>{uiLanguage === "zh-Hant" ? "示教點" : "Teach points"}</h2><small>{uiLanguage === "zh-Hant" ? "儲存機械臂移動目標" : "Saved targets for robot moves"}</small></div></div>
              <div className="point-actions">
                <button className="text-button" onClick={addCartesianPoint} disabled={busy || project.points.length >= 100}><Plus size={14} /> {uiLanguage === "zh-Hant" ? "示教目前位置" : "Teach current"}</button>
              <button className="small-icon-button" onClick={addJointPoint} title={ui.jointPoint} aria-label={ui.jointPoint} disabled={busy || project.points.length >= 100}><Plus size={15} /></button>
              </div>
            </div>
            <div className="point-list" role="listbox" aria-label={ui.teachPoints}>
              {project.points.map((point) => {
                const pointPosition = getPointPose(point, kinematics, project);
                return (
                  <button
                    key={point.id}
                    className={`point-row ${point.id === selectedId ? "selected-point" : ""}`}
                    onClick={() => setSelectedId(point.id)}
                    onKeyDown={(event) => {
                      const options = Array.from(event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="option"]') ?? []);
                      const nextIndex = getRovingFocusIndex(event.key, options.indexOf(event.currentTarget), options.length, "vertical");
                      if (nextIndex === null) return;
                      event.preventDefault();
                      setSelectedId(project.points[nextIndex].id);
                      options[nextIndex]?.focus();
                    }}
                    role="option"
                    aria-selected={point.id === selectedId}
                    tabIndex={point.id === selectedId ? 0 : -1}
                  >
                    <span className={`point-type ${point.kind === "joint" ? "joint-type" : ""}`}>{point.kind === "joint" ? "J" : "P"}</span>
                    <span className="point-row-name">{point.name}<small>{point.kind === "joint" ? (uiLanguage === "zh-Hant" ? "關節" : "JOINT") : (uiLanguage === "zh-Hant" ? "笛卡兒" : "CARTESIAN")}</small></span>
                    <span className="point-row-coordinates">{pointPosition ? `${format(pointPosition.x, 0)}, ${format(pointPosition.y, 0)}, ${format(pointPosition.z, 0)}` : "—"}</span>
                    {point.id === selectedId && <span className="selected-point-dot" />}
                  </button>
                );
              })}
              {project.points.length === 0 && <div className="empty-state">{uiLanguage === "zh-Hant" ? "尚未儲存示教點。移動機械臂，再示教目前位置。" : "No saved points yet. Jog the robot, then teach its current position."}</div>}
            </div>
            {selectedPoint && <div className="point-editor">
              <div className="point-editor-title"><div><strong>{selectedPoint.name}</strong><span>{selectedPoint.kind === "joint" ? (uiLanguage === "zh-Hant" ? "關節目標" : "Joint target") : (uiLanguage === "zh-Hant" ? "笛卡兒目標" : "Cartesian target")}</span></div><div className="point-editor-actions"><button className="text-button subtle-button" onClick={moveToSelected} disabled={busy}><Crosshair size={14} /> {uiLanguage === "zh-Hant" ? "前往" : "Go to"}</button><button className="small-icon-button danger-icon" onClick={removeSelectedPoint} disabled={busy} aria-label={`${ui.deletePoint} ${selectedPoint.name}`} title={ui.deletePoint}><Trash2 size={14} /></button></div></div>
              {selectedPoint.kind === "cartesian" ? <div className="point-fields four-fields">
                <NumericField label="X" value={selectedPoint.pose.x} suffix="mm" step={1} disabled={busy} onChange={(value) => updateSelectedPose("x", value)} />
                <NumericField label="Y" value={selectedPoint.pose.y} suffix="mm" step={1} disabled={busy} onChange={(value) => updateSelectedPose("y", value)} />
                <NumericField label="Z" value={selectedPoint.pose.z} suffix="mm" step={1} disabled={busy} onChange={(value) => updateSelectedPose("z", value)} />
                <NumericField label="R" value={selectedPoint.pose.r} suffix="°" step={1} disabled={busy} onChange={(value) => updateSelectedPose("r", value)} />
              </div> : <div className="point-fields four-fields">
                {selectedPoint.joints.map((value, index) => <NumericField key={index} label={`J${index + 1}`} value={deg(value)} suffix="°" step={1} min={JOINT_LIMITS_DEG[index].min} max={JOINT_LIMITS_DEG[index].max} disabled={busy} onChange={(next) => updateJointPoint(index, next)} />)}
              </div>}
            </div>}
            <div className="points-footer"><span><Save size={13} /> {uiLanguage === "zh-Hant" ? "示教點會與專案一同儲存" : "Points are stored with this project"}</span><span>{project.points.length} / 100</span></div>
          </section>

          <section className="panel console-panel" hidden={workbenchView !== "program"}>
            <div className="console-heading"><div><span className="console-light" /><strong>{uiLanguage === "zh-Hant" ? "執行記錄" : "Run log"}</strong></div><button className="small-icon-button" onClick={() => { setLogs([]); setProgramRunLog([]); }} title={uiLanguage === "zh-Hant" ? "清除執行記錄" : "Clear run log"} aria-label={uiLanguage === "zh-Hant" ? "清除執行記錄" : "Clear run log"}><Trash2 size={14} /></button></div>
            <div className="console-entries" aria-live="polite">
              {logs.slice(0, 4).map((entry) => <div className={`console-entry log-${entry.level}`} key={entry.id}><span className="log-time">{entry.time}</span><span>{localizeWorkspaceMessage(entry.message, uiLanguage)}</span></div>)}
              {logs.length === 0 && <span className="console-empty">{uiLanguage === "zh-Hant" ? "程式訊息會顯示於此。" : "Program messages will appear here."}</span>}
            </div>
          </section>
        </aside>

        <aside id="coach-dock" className="panel coach-dock" aria-label="AI coach and setup checks" hidden={!coachOpen || workbenchView !== "program"}>
          <div className="coach-dock-heading">
            <div className="heading-title"><span className="heading-icon purple-icon"><Sparkles size={16} /></span><div><h2>{uiLanguage === "zh-Hant" ? "AI 程式教練" : "AI coding coach"}</h2><small>{uiLanguage === "zh-Hant" ? "提供提示，協助你自己修改" : "Hints to help you make your own changes"}</small></div></div>
            <button type="button" className="small-icon-button" onClick={() => setCoachOpen(false)} aria-label="Close AI coach" title="Close AI coach">×</button>
          </div>
          <div className="coach-dock-content">
            <CodeAssistant
              code={programText}
              savedPoints={project.points}
              language={project.programmingLanguage}
              toolMode={project.tool.mode}
              setupReady={recommendation.ready}
              setupChecks={[...recommendation.checks, { id: "scene-height", status: "info", title: "Actual scene heights", detail: `Platform top Z=${platformHeight(project.scene)} mm; magnetic contact Z=${magneticSurfaceHeight(project.scene) + 4} mm; fork support Z=${platformHeight(project.scene) + 20} mm; Body1 insertion Z=${platformHeight(project.scene) + 42.5}, load/release Z=${platformHeight(project.scene) + 45} mm. Individual workpiece Z offsets are added to these values.` }]}
              recentRunLog={recentRunLog}
              hasCurrentRun={hasCurrentRun && recentRunLog.length > 0}
              onOpenControlFlowLesson={(topic) => {
                setTrainingLessonId(topic === "if-else" ? "foundation-if-else" : "foundation-loops");
                setShowTraining(true);
              }}
            />
            <details className="guided-example-section">
              <summary>Setup review &amp; guided example · {project.tool.mode === "magnet" ? "Magnet" : "Passive fork"} · {project.programmingLanguage === "lua" ? "Lua" : "Python"}</summary>
              <div className="guided-example-content">
                    <p className="recommendation-intro">{recommendation.message}</p>
                    <ul className="recommendation-checks">
                      {recommendation.checks.map((check) => (
                        <li className={`recommendation-check check-${check.status}`} key={check.id}>
                          <span className="recommendation-check-mark" aria-hidden="true">{check.status === "pass" ? "✓" : check.status === "action" ? "!" : check.status === "waiting" ? "…" : "i"}</span>
                          <div><strong>{check.title}</strong><span>{check.detail}</span>
                            {check.action && <button className="recommendation-action" onClick={() => applyRecommendationAction(check.action!, check.pointName)} disabled={busy || ((check.action === "teach-pick" || check.action === "teach-place") && project.points.length > 98) || (check.action === "teach-home" && project.points.length >= 100 && !project.points.some((point) => point.name.toLowerCase() === "home"))}>
                              {check.action === "teach-home" ? "Set current pose as Home" : check.action === "teach-pick" ? (project.points.some((point) => point.name === "PickPoint" || point.name === "PickApproach") ? "Reset pick pair to block" : "Create pick pair at block") : check.action === "teach-place" ? (project.points.some((point) => point.name === "PlacePoint" || point.name === "PlaceApproach") ? "Reset place pair to drop zone" : "Create place pair at drop zone") : `Select ${check.pointName}`}
                            </button>}
                          </div>
                        </li>
                      ))}
                    </ul>
                    <div className="recommendation-lesson"><strong>Why this sequence?</strong><span>{project.tool.mode === "magnet" ? "Home → approach above → descend → DO1 attaches → lift clear → place → DO1 releases → return Home." : "Home → approach from outside at the raised support plane → slide under → lift to auto-pick → move above the drop zone → lower onto its support pads to release → return Home. The passive fork needs no DO."} The example stays in the editor for you to review and run.</span></div>
                    <details className="recommendation-preview"><summary>Preview the full example</summary><pre>{recommendation.code}</pre></details>
                    <button className="recommendation-load" onClick={loadRecommendedProgram} disabled={!recommendation.ready}>Replace current {project.programmingLanguage === "lua" ? "Lua" : "Python"} code with this example</button>
                    <small>The guided example replaces only the selected language's editor buffer. Python is simulator-only. RelMovL syntax and options are documented in DobotStudio Pro 2.8.0 (p. 172); this simulator uses base-frame offsets. Endpoints are checked; path collision and tool physics are not simulated.</small>
                  </div>
            </details>
          </div>
        </aside>

        <section className="right-workspace">
          <div className="viewport-header">
            <div className="view-title"><Box size={20} /><h2>{uiLanguage === "zh-Hant" ? "3D 工作台" : "3D worktable"}</h2></div><span className="active-tool-label">{project.tool.mode === "fork" ? (uiLanguage === "zh-Hant" ? "被動叉臂 · 不用 DO" : "Passive fork · no DO") : (uiLanguage === "zh-Hant" ? "磁吸工具" : "Magnet tool")}</span>
          </div>
              <section className="simulation-actions" aria-label={uiLanguage === "zh-Hant" ? "模擬控制" : "Simulation controls"}>
            <button ref={runButtonRef} className="run-button primary-action" onClick={startRun} disabled={!canRun || preflight.kind === "error" || (workbenchView === "practice" && !practicePrepared)}>{!kinematics ? <LoaderCircle size={20} className="spin" /> : <Play size={20} fill="currentColor" />}<span>{uiLanguage === "zh-Hant" ? (workbenchView === "practice" ? "執行練習" : "執行程式") : (workbenchView === "practice" ? "Run practice" : "Run code")}</span></button>
            {busy && <button className="control-button" onClick={pauseOrResume}>{status === "paused" ? <Play size={18} /> : <Pause size={18} />}{status === "paused" ? ui.resume : ui.pause}</button>}
            {busy && <button className="control-button stop-control" onClick={stopRun}><Square size={17} />{uiLanguage === "zh-Hant" ? "停止" : "Stop"}</button>}
            <button className="control-button" onClick={resetRobot} disabled={busy}><RotateCcw size={18} />{uiLanguage === "zh-Hant" ? "重設" : "Reset"}</button>
            <span className={`status-pill status-${status}`} role="status">{runtimeLabel}</span>
            <button className="text-button camera-reset" onClick={() => setCameraResetToken((token) => token + 1)}><Maximize2 size={17} />{uiLanguage === "zh-Hant" ? "重設視角" : "Reset view"}</button>
          </section>
          {preflight.kind === "error" && <div className="run-preflight run-preflight-error" role="alert">{preflight.text}<button className="text-button" onClick={() => openWorkbench("points")}>{uiLanguage === "zh-Hant" ? "查看教點" : "Review points"}</button></div>}
          <Suspense fallback={<div className="viewport-shell" role="status"><div className="viewport-overlay"><LoaderCircle className="spin" size={23} /><div><strong>{uiLanguage === "zh-Hant" ? "正在準備三維工作格" : "Preparing 3D view"}</strong><span>{uiLanguage === "zh-Hant" ? "正在載入互動式 MG400 訓練工作格…" : "Loading the interactive MG400 training cell…"}</span></div></div></div>}>
            <RobotViewport workspaceTheme={workspaceTheme} joints={joints} project={project} blockPosition={blockPosition} attached={attached} attachedCellBlockId={attachedCellBlockId} target={targetPose} cameraResetToken={cameraResetToken} localToolMeshes={localToolMeshes} urdfXml={kinematicsUrdf} modelError={modelError} uiLanguage={uiLanguage} placementArmed={freeMode && placementArmed} onTablePlace={placeSelectedOnTable} onTableNudge={nudgeSelectedPlacement} onTableCancel={cancelTablePlacement} onTableConfirm={confirmTablePlacement} />
          </Suspense>

          <section hidden={workbenchView !== "points" && workbenchView !== "settings"} className="telemetry-strip" aria-label={uiLanguage === "zh-Hant" ? "機械臂目前位置" : "Current robot position"}>
            <div className="telemetry-title"><span className="telemetry-pulse" />{uiLanguage === "zh-Hant" ? "TCP 位置" : "TCP POSITION"}</div>
            <div className="telemetry-values"><span>X <strong>{format(pose.x)}</strong><small>mm</small></span><span>Y <strong>{format(pose.y)}</strong><small>mm</small></span><span>Z <strong>{format(pose.z)}</strong><small>mm</small></span><span>R <strong>{format(pose.r)}</strong><small>°</small></span></div>
            <div className="telemetry-separator" />
            <div className="joint-values">{joints.map((joint, index) => <span key={index}>J{index + 1} <strong>{format(deg(joint))}°</strong></span>)}</div>
          </section>

          <section className={`practice-result result-${status}`} aria-label={uiLanguage === "zh-Hant" ? "執行結果" : "Run result"} aria-live="polite">
            <h2>{uiLanguage === "zh-Hant" ? "執行結果" : "Run result"}</h2>
            {status === "running" || status === "paused" ? <p>{uiLanguage === "zh-Hant" ? (status === "paused" ? "已暫停；按「繼續模擬」完成練習。" : "程式執行中，觀察工作台上的動作。") : (status === "paused" ? "Paused. Resume to continue." : "Running. Watch the worktable.")}</p> : status === "error" ? <><p className="result-error">{resultError ? localizeWorkspaceMessage(resultError.message, uiLanguage) : (uiLanguage === "zh-Hant" ? "程式未完成，請查看執行記錄。" : "The program did not complete. Review the run log.")}</p><button className="text-button" onClick={() => openWorkbench("program")}>{uiLanguage === "zh-Hant" ? "打開程式與記錄" : "Open code and log"}<ArrowRight size={16} /></button></> : latestPrintOutput ? <><pre>{latestPrintOutput}</pre><p>{uiLanguage === "zh-Hant" ? "這是你的程式輸出的文字。" : "This is the message your program printed."}</p></> : <p>{status === "complete" ? (uiLanguage === "zh-Hant" ? "程式已完成。看看工件位置有甚麼改變。" : "Program finished. Check where the workpiece is now.") : (uiLanguage === "zh-Hant" ? "執行後，你會在這裡看到程式訊息及完成狀態。" : "Program messages and completion status appear here after you run.")}</p>}
            {taskChecks.length > 0 && <div className="task-assessment" data-task-passed={taskChecks.every(check => check.passed)}><strong>{uiLanguage === "zh-Hant" ? (taskChecks.every(check => check.passed) ? "任務驗證通過" : "程式已結束，任務仍有步驟待完成") : (taskChecks.every(check => check.passed) ? "Task verified" : "Program ended; some task steps remain")}</strong><ul>{taskChecks.map(check => <li key={check.id} data-check={check.id} data-passed={check.passed}>{check.passed ? "✓" : "○"} {uiLanguage === "zh-Hant" ? check.zh : check.en}</li>)}</ul></div>}
            {practiceLessonId === "intermediate-three-layer-tower" && <p>{uiLanguage === "zh-Hant" ? `已放置 ${towerBlocks.length} / 3 層` : `${towerBlocks.length} / 3 layers placed`}</p>}
            {practiceLessonId === "intermediate-black-white-sort" && <p>{uiLanguage === "zh-Hant" ? `已取出 ${sortUnloaded} / 4 件方塊` : `${sortUnloaded} / 4 blocks unloaded`}</p>}
          </section>
          <footer className="workspace-footer"><div><span className="footer-dot" /> {ui.simulationOnly}</div></footer>
        </section>
      </div>
      <TrainingCenter
        open={showTraining}
        programLanguage={project.programmingLanguage}
        forkContactProfile={project.tool.mode === "fork" ? forkProfile : "reference"}
        initialLessonId={trainingLessonId}
        onClose={() => { setShowTraining(false); setTrainingLessonId(null); }}
        onUseExample={(example, language, lessonId) => {
          replaceProject((current) => language === "lua"
            ? { ...current, script: example, programmingLanguage: language }
            : { ...current, pythonScript: example, programmingLanguage: language });
          setLatestPrintOutput(null);
          setLastRunContext(null);
          setProgramRunLog([]);
          setStatus("ready");
          setPracticeLessonId(lessonId ?? null);
          setPracticePrepared(lessonId === "foundation-first-program");
          setWorkbenchView("practice");
          setShowWorkshop(false);
          setRunLessonCue(true);
          addLog(`${language === "lua" ? "Lua" : "Python"} lesson example loaded into the program editor.`, "info");
        }}
      />
    </main>
  );
}
