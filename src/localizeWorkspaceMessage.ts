export type WorkspaceLanguage = "zh-Hant" | "en";

const translations: Record<string, string> = {
  "Local simulator ready. No robot hardware is connected.": "本機模擬器已就緒。未連接機械臂硬體。",
  "Robot pose and reference cell reset.": "機械臂姿勢及參考工作格已重設。",
  "Lua program started in the isolated browser worker.": "Lua 程式已在本機隔離工作執行器中開始執行。",
  "Python program started in the isolated browser worker.": "Python 程式已在本機隔離工作執行器中開始執行。",
  "Program and queued simulation motions completed.": "程式及排隊中的模擬動作已完成。",
  "This project already has the maximum of 100 teach points.": "此專案已達 100 個示教點上限。",
  "A point pair needs two free slots; the project limit is 100 points.": "一組示教點需要兩個空位；專案上限為 100 點。",
  "Saved the current joint pose as Home.": "已將目前關節姿勢儲存為 Home。",
  "Project JSON exported to this device.": "專案 JSON 已匯出至此裝置。",
  "Import failed.": "匯入失敗。",
  "Could not load the bundled MG400 kinematic model.": "無法載入隨附的 MG400 運動學模型。",
  "Could not read the bundled MG400 URDF.": "無法讀取隨附的 MG400 URDF。",
  "The MG400 URDF could not be parsed.": "無法解析 MG400 URDF。",
  "The loaded URDF is missing the MG400 motion joints.": "載入的 URDF 缺少 MG400 運動關節。",
  "Program exceeded the 2,000 simulator-action limit.": "程式超出 2,000 個模擬動作的上限。",
  "A saved point contains a non-finite number.": "已儲存的示教點含有無效數值。",
  "Motion target contains a non-finite number.": "移動目標含有無效數值。",
  "Joint target contains a non-finite number.": "關節目標含有無效數值。",
  "The requested Cartesian point is outside the modeled joint-limited workspace.": "笛卡兒點超出模擬關節限制下的工作範圍。",
  "Simulation stopped. The robot holds its current pose.": "模擬已停止；機械臂保持目前姿勢。",
  "DO1 is only a virtual output in Fork mode. Slide beneath the block and lift to pick it up; lower it onto the table to release it.": "叉臂模式中的 DO1 只會改變模擬輸出。請滑入方塊下方並抬起拾取；放到支撐墊後降下即可釋放。",
  "RelMovL is missing its X/Y/Z/R Cartesian offset.": "RelMovL 缺少 X／Y／Z／R 笛卡兒座標偏移。",
  "CP omitted; this simulator uses CP=0. DobotStudio Pro documents CP=1 by default.": "未填 CP：模擬器會使用 CP=0；DobotStudio Pro 手冊所列預設值為 CP=1。請在指令中明確寫出 {CP=0}。",
  "The block is already attached to the tool.": "方塊已連接至工具。",
  "Place failed: there is no block attached to the tool.": "放置失敗：工具目前沒有連接方塊。",
};

export function localizeWorkspaceMessage(message: string, language: WorkspaceLanguage): string {
  if (language !== "zh-Hant") return message;
  const translated = translations[message];
  if (translated) return translated;

  const jog = message.match(/^Jog stopped: ([XYZR]) target is outside the modeled workspace\.$/);
  if (jog) return `點動已停止：${jog[1]} 軸目標超出模擬工作範圍。`;
  const jointLimit = message.match(/^Jog stopped at J([1-4]) limit \((.+)° to (.+)°\)\.$/);
  if (jointLimit) return `點動已停止：J${jointLimit[1]} 目標超出限制（${jointLimit[2]}° 至 ${jointLimit[3]}°）。`;
  const forkRelease = message.match(/^Fork lowered the block onto the support pads at X (.+) mm, Y (.+) mm\.$/);
  if (forkRelease) return `叉臂已將方塊降至支撐墊（X ${forkRelease[1]} mm，Y ${forkRelease[2]} mm）。`;
  const magnetAttach = message.match(/^Magnet attached (.+) at X (.+) mm, Y (.+) mm\.$/);
  if (magnetAttach) return `磁吸工具已吸附「${magnetAttach[1]}」（X ${magnetAttach[2]} mm，Y ${magnetAttach[3]} mm）。`;
  const blockPlaced = message.match(/^Block (.+) placed at X (.+) mm, Y (.+) mm(?:, Z (.+) mm, R (.+)°)?\.$/);
  if (blockPlaced) {
    const stackPose = blockPlaced[4] === undefined ? "" : `，Z ${blockPlaced[4]} mm，R ${blockPlaced[5]}°`;
    return `方塊「${blockPlaced[1]}」已放置於 X ${blockPlaced[2]} mm、Y ${blockPlaced[3]} mm${stackPose}。`;
  }
  const failedPreflight = message.match(/^Straight-line motion failed preflight at (.+)% \((.+) mm position error\)\.$/);
  if (failedPreflight) return `直線移動預檢在 ${failedPreflight[1]}% 失敗（位置誤差 ${failedPreflight[2]} mm）。`;
  const movingTo = message.match(/^Moving smoothly to (.+)…$/);
  if (movingTo) return `正平順移動至 ${movingTo[1]}…`;
  const reached = message.match(/^Reached (.+)\.$/);
  if (reached) return `已到達 ${reached[1]}。`;
  const taught = message.match(/^Taught (joint point )?([PJ]\d+)\.$/);
  if (taught) return `已示教${taught[1] ? "關節" : "笛卡兒"}點 ${taught[2]}。`;
  const removed = message.match(/^Removed point (.+)\.$/);
  if (removed) return `已刪除示教點 ${removed[1]}。`;
  const imported = message.match(/^Imported and validated (.+)\.$/);
  if (imported) return `已匯入並驗證 ${imported[1]}。`;
  const saved = message.match(/^Taught (.+) from the current TCP pose\.$/);
  if (saved) return `已從目前 TCP 姿勢示教 ${saved[1]}。`;
  const taughtPair = message.match(/^Taught (pick|place) and approach points above the reference cell (block|drop zone)\.$/);
  if (taughtPair) return `已在參考工作格的${taughtPair[2] === "block" ? "方塊" : "放置區"}上方示教${taughtPair[1] === "pick" ? "拾取" : "放置"}點及接近點。`;
  const taughtForkEntry = message.match(/^Taught the fork entry point (.+) mm before the block and the insertion point at its (.+) mm contact plane\.$/);
  if (taughtForkEntry) return `已在方塊前方 ${taughtForkEntry[1]} mm 示教叉臂入口點，並在 Z ${taughtForkEntry[2]} mm 接觸平面示教插入點。`;
  const recommended = message.match(/^Loaded the recommended (Lua|Python) pick-and-place template\.$/);
  if (recommended) return `已載入 ${recommended[1]} 取放程式範例。`;
  const snippet = message.match(/^Loaded a standalone (Lua|Python) learning snippet\.$/);
  if (snippet) return `已載入 ${snippet[1]} 獨立學習範例。`;
  const lessonExample = message.match(/^(Lua|Python) lesson example loaded into the program editor\.$/);
  if (lessonExample) return `已將 ${lessonExample[1]} 課程範例載入程式編輯器。`;
  if (message.includes("UNSUPPORTED_OPTION:") && message.toLowerCase().includes("cp")) {
    return "目前版本只支援 CP=0，尚未模擬非零 CP 的連續路徑混合。CP 不是 TCP 座標；請將移動選項設為 CP=0。";
  }
  if (message.startsWith("Target is outside the modeled workspace")) return "目標超出模擬工作範圍；請調整目標位置或方向。";
  if (message.startsWith("Straight-line motion left the modeled workspace")) return "直線移動超出模擬工作範圍；請調整目標或路徑。";
  if (message.startsWith("Pick failed:")) return "拾取失敗：請檢查工件位置及目前工具的拾取容差。";
  if (message.startsWith("The fork is passive.")) return "叉臂為無動力工具。請移至支撐高度，滑入方塊下方後抬起；放回支撐墊即可釋放。叉臂程式請移除 DO1、Pick() 及 Place()。";
  return message;
}
