# MG400 Virtual Training Simulator — Instructor Guide

**Course release:** 1.3.6
**Languages:** English and Traditional Chinese  
**Last checked against the app:** 4 October 2026

## Purpose and boundary

This browser product teaches programming and point-based motion through one simulated MG400 pick-and-place cell. It includes the vendor robot visual model, supplied magnetic and unpowered fork tools, teach points, a reference block, Lua, simulator-only Python, and assessed bilingual lessons.

It is not a controller, hardware digital twin, safety system, or proof that a path is safe on a physical robot. Kinematics, timing, tool offsets, pickup rules, and the work cell are simulated. Physical calibration, collision safety, force/contact behavior, and firmware-specific execution have not been validated.

## Prepare a session

For a local classroom copy, use the project README for Node.js requirements and start commands. Once dependencies and local assets are present, the simulator serves its robot meshes, Lua runtime, Python runtime, and editor from the app; normal simulator execution does not need a cloud service.

Before learners begin:

1. Open the app and check that the colored MG400, active tool, workpiece, and workspace panels have loaded.
2. Explain that Lua and Python editor buffers are independent. Python is simulator-only; it is not code for a Dobot controller.
3. Begin with the print-only lesson if learners have not programmed before. It does not move the robot and does not need an AI key.
4. Explain the **Load this example…** confirmation. Lesson code is a preview until deliberately loaded; **Run editor code** runs the current editor buffer.
5. Have learners select Magnet or Fork before teaching or refreshing point pairs.

The 14 current lessons total about 211 minutes of stated lesson time. Actual class time depends on discussion and practice.

## Current lesson sequence

| Track | Lesson | Time | Learning focus |
|---|---|---:|---|
| Foundation | Your first program: show a message | 8 min | Comments, a named value, and `print`; no robot motion |
| Foundation | First robot move: go to the approach point | 7 min | Use the selected tool's saved approach point; no pickup |
| Foundation | If and else: choose a path | 7 min | Conditions and language-specific syntax |
| Foundation | Loops: repeat a small task | 8 min | Finite `for` and counter-controlled `while` loops |
| Foundation | The cell and its coordinates | 12 min | X/Y/Z/R, J1–J4, TCP, block centre, and contact height |
| Foundation | Taught points and two kinds of move | 15 min | Named points, `MovJ`, and `MovL` |
| Intermediate | Relative linear motion with RelMovL | 18 min | Bounded base-frame relative motion |
| Intermediate | Pick and place with the magnet | 18 min | Simulated `DO` attach/release sequence |
| Intermediate | Pick and place the grooved Body1 with the passive fork | 20 min | Slide into the supplied block, lift, lower to support, and withdraw; no `DO` |
| Intermediate | Pick up Body1, then rotate it +90° while carrying | 20 min | Lift the picked block +80 mm before turning; keep the fork unpowered |
| Intermediate | Stack three Body1 blocks (0° / 90° / 0°) | 20 min | Build vertically at one XY; rotate only the middle layer after pickup and lift |
| Intermediate | Sort and stack black/white magnetic plates | 20 min | Keep two separate stacks and per-colour counts; turn white plates +45° after lift |
| Advanced | Queued motion, SYNC, and timing | 18 min | Queue completion and simulated timing |
| Advanced | Debugging and knowing the boundary | 20 min | Diagnostics, unsupported behavior, and simulation limits |

The course does not lock lessons behind prerequisites. Use the listed sequence for a first class, or assign a later lesson directly when appropriate. Every lesson includes an outcome, explanation, guided steps, practice, selected-language example, and assessment feedback.

## Suggested teaching flow

### First contact with code

Ask learners to identify the comment, assignment, and print line before loading the example. Let them change the message and predict the output. Then ask what evidence shows that the robot did not move. Reinforce that the lesson preview is not the editor program and that replacement requires explicit confirmation.

### First motion and coordinate vocabulary

Introduce the flange as the robot's tool-mounting face and the TCP as the configured reference point used by motion commands. The requested default TCP offset is +60 mm along flange-frame X; label it as a simulator configuration, not a measured calibration.

Have learners select a tool, teach or refresh the pick pair, then run the single `PickApproach` move. It should stop short of contact and must not pick up the block. Compare the TCP position and saved approach pose after switching tools.

### Magnet and passive fork comparison

Fresh exercises use the front 110 mm teaching platform:

- **Magnet:** the 35 × 35 × 4 mm plate rests on the platform. The magnetic tool targets its top face at Z114. `DO(1, ON/OFF)` is only a simulator attach/release action; it does not represent connected hardware I/O.
- **Fork:** the supplied Body1 rests directly on the shared platform at Z = 110 mm. Fork insertion is TCP Z = 132.5 mm and support/release is Z = 135 mm. The unpowered tool must approach, slide into the groove, lift, travel, lower to release, then clear and withdraw. No `DO`, `Pick()`, or `Place()` call is required.

Ask learners to explain why the two modes use different contact geometry and why an approach point is useful. The fork support and release rules are deterministic simulation logic, not a physics or force model.

### Make the carried wrist rotation visible

Point out the asymmetric dark arrow on the block; it marks the block's local +X direction while its square dimensions stay unchanged. In the Body1 fork-rotation lesson, have learners observe and say the sequence: slide the passive fork into the groove, lift the block, raise it another 80 mm, then turn the carried tool +90°. The block stays carried during the turn; lower it onto the destination before clearing and withdrawing the fork. No `DO`, `Pick()`, or `Place()` command is involved. Ask learners to predict the +X arrow's final direction before running. This is a deterministic attachment rule, not rigid-body contact or force physics.

### Control flow and relative motion

Keep the early `if/else` and loop examples print-only. Require a clear stopping condition for every `while` loop. For `RelMovL`, distinguish its Cartesian offset from TCP and from the `CP=0` path-blending option. The simulator resolves relative offsets in its base frame; user and tool frames are outside the supported subset.

## Assessment and feedback

Use built-in assessment feedback to prompt explanation, not as evidence of physical competence. Suggested oral checks:

- What does the TCP describe, and where is its configured offset measured from?
- Why is the block centre different from the magnet's contact surface?
- Why does the unpowered fork need slide-under and lift motions but no `DO`?
- What is the difference between a lesson's example preview and the current editor program?
- What does a successful simulator run establish, and what does it not establish?

The course stores lesson completion and attempts locally in browser storage, separately from the robot project. A learner can leave Training and return without discarding course progress. Project import/export/reset concerns the robot project; it is not a course-progress backup. Ask learners to export a project file if they need to preserve or transfer their code and taught points.

## AI coach, privacy, and student data

The AI coach is optional. Students provide their own OpenAI-compatible key, endpoint, and model in the page. The key is not saved by the app; it remains in memory until cleared or refreshed. Project context sharing is off by default. When enabled, the provider can receive current code, point names, setup checks, and a recent run log. The provider may process or retain prompts and replies.

For OpenRouter Space Bunny Alpha, the model listing says its third-party provider may retain prompts and completions. Do not include student names or personal information. Prefer anonymous, minimal prompts and follow your school's data policy. The coach is read-only: it cannot change or execute learner code. Local syntax/API checks on suggestions are not proof that a complete task is reachable, collision-free, or correct.

## Compatibility and evidence labels

Keep these identities separate when presenting the product:

- **Course release:** 1.3.6, the version of the bilingual lesson content.
- **Lua profile:** the documented DobotStudio Pro 2.8 command subset in [the compatibility guide](dobotstudio-pro-28-subset.md). Exact embedded Lua VM identity and full controller equivalence are unknown.
- **Python profile:** simulator-only API, not a Dobot controller SDK.
- **Model and cell:** vendor visual robot model plus locally supplied tool meshes and one reference block; see [model provenance](model-provenance.md).
- **Hardware and firmware:** no physical calibration, controller execution, firmware verification, safety validation, or deployment has been performed.

Do not present the user-specified +60 mm TCP offset, simulated joint limits, pickup tolerance, or simulated timing as physical calibration or safety limits. A green simulator run is not permission to run the same program on equipment.

## Further references

- [Student guide](student-guide.md)
- [Project setup and product overview](../README.md)
- [Wayfinder task map](../.scratch/mg400-virtual-training-simulator/map.md)

## 繁體中文

### 目的及使用界線

本瀏覽器產品以一個模擬 MG400 取放工作站教授程式設計和教點移動。內容包括原廠機械臂視覺模型、提供的磁吸工具及無動力叉臂、教點、示範方塊、Lua、模擬器專用 Python，以及雙語評估課程。

本產品不是控制器、硬件數碼分身、安全系統，也不能證明路徑可在實體機械臂安全執行。運動學、時間、工具偏移、取放規則和工作站都經過模擬。實體校準、碰撞安全、接觸力行為和特定韌體執行均未驗證。

### 課堂準備

如要在本機開啟課堂版本，請依照專案 README 的 Node.js 要求和啟動指令。安裝所需套件及本機資產後，機械臂網格、Lua 執行環境、Python 執行環境和編輯器都由本機 app 提供；一般模擬執行毋須連接雲端服務。

學生開始前：

1. 開啟 app，確認彩色 MG400、目前工具、工件和工作區面板均已載入。
2. 說明 Lua 和 Python 使用互相分開的編輯器內容。Python 只供模擬器使用，不能當作 Dobot 控制器程式。
3. 對未學過程式的學生，先由只輸出文字的第一課開始。該課不會移動機械臂，也不需 AI key。
4. 說明 **Load this example…** 的確認步驟。課程程式碼只是預覽；**Run editor code** 執行的是目前編輯器內容。
5. 提醒學生先選 Magnet 或 Fork，再建立或更新教點組合。

目前 14 課標示時間合共約 211 分鐘。實際課堂時間會視乎討論和練習而變。

### 目前課程次序

| 課程 | 單元 | 時間 | 學習重點 |
|---|---|---:|---|
| 初階 | 第一個程式：顯示文字 | 8 分鐘 | 註解、命名數值及 print；不移動機械臂 |
| 初階 | 第一次移動機械臂：前往接近點 | 7 分鐘 | 使用所選工具的已儲存接近點；不取件 |
| 初階 | If 與 else：選擇程式分支 | 7 分鐘 | 條件判斷和不同語言語法 |
| 初階 | 迴圈：重複小任務 | 8 分鐘 | 有限 for 和計數器控制的 while 迴圈 |
| 初階 | 工作站與座標 | 12 分鐘 | X/Y/Z/R、J1–J4、TCP、方塊中心和接觸高度 |
| 初階 | 教點與兩種移動 | 15 分鐘 | 具名教點、MovJ 和 MovL |
| 中階 | RelMovL 相對直線移動 | 18 分鐘 | 有界限的基座座標系相對移動 |
| 中階 | 使用磁吸工具取放方塊 | 18 分鐘 | 模擬 DO 吸附及釋放流程 |
| 中階 | 使用無動力叉臂取放 Body1 槽積木 | 20 分鐘 | 沿槽滑入、抬起、放至承托面及退出；不需 DO |
| 中階 | 先叉起 Body1，再攜件旋轉 +90° | 20 分鐘 | 取件後先抬高 80 mm，再轉動仍由叉臂承托的方塊 |
| 中階 | 建立三層 Body1 方塊塔（0°／90°／0°） | 20 分鐘 | 同一 XY 垂直堆疊；只有中層在取件及抬高後旋轉 |
| 中階 | 黑白磁吸片分類並分開堆疊 | 20 分鐘 | 兩個不同位置，各自計層；白片抬高後轉 +45° |
| 進階 | 移動佇列、SYNC 與時間 | 18 分鐘 | 指令佇列完成和模擬時間 |
| 進階 | 診斷錯誤與理解模擬界線 | 20 分鐘 | 錯誤訊息、不支援行為及模擬限制 |

課程不會鎖住未完成先修課的學生。初次授課可依上表次序；亦可按需要直接指定後續課堂。每課均有目標、解說、導引步驟、練習、所選語言範例及評估回饋。

### 建議教學流程

#### 初次接觸程式

載入範例前，請學生找出註解、賦值和 print 指令。讓學生更改訊息並預測輸出，再討論甚麼證據顯示機械臂沒有移動。強調課程預覽不等於編輯器內的程式，替換程式前必須明確確認。

#### 第一次移動及座標詞彙

介紹法蘭為機械臂安裝工具的端面，TCP 則是移動指令所用的已設定參考點。指定的預設 TCP 偏移是法蘭座標 X 軸 +60 mm；請說明這是模擬器設定，不是實體校準量度值。

請學生選擇工具、建立或更新取件教點組合，然後執行單一 **PickApproach** 移動。該移動只到接近位置，不應接觸或拾起方塊。切換工具後比較 TCP 位置及接近教點。

#### 比較磁吸與無動力叉臂

新練習使用前方 110 mm 教學平台：

- **Magnet：**35 × 35 × 4 mm 磁吸片放在平台上，磁吸工具對準 Z114 頂面。**DO(1, ON/OFF)** 只在模擬器內代表吸附／釋放，沒有連接實體 I/O。
- **Fork：**隨附 Body1 直接放在頂面 Z = 110 mm 的共用平台上。叉臂插入 TCP 為 Z = 132.5 mm，承托／釋放高度為 Z = 135 mm。無動力工具需接近、沿槽滑入、抬起及移動，再降下釋放、恢復間隙並退出。毋須 **DO**、**Pick()** 或 **Place()**。

請學生解釋兩種模式為何有不同接觸幾何，以及接近點有甚麼作用。叉臂承托和釋放屬確定性模擬規則，不是物理或受力模型。

#### 讓學生看見攜件手腕旋轉

指出方塊上的深色不對稱箭嘴；它標示方塊本身的 +X 方向，而不是改變方塊尺寸。在 Body1 叉臂旋轉課中，請學生觀察並說出次序：把無動力叉臂滑入槽內、抬起方塊、再上升 80 mm，然後讓叉臂承托著的方塊旋轉 +90°。把方塊降到目的承托面後，先恢復槽口間隙，再水平退出；不需要 `DO`、`Pick()` 或 `Place()`。執行前先問箭嘴最後會指向哪一邊。這是確定性的模擬附著規則，不代表剛體接觸或力學模擬。

#### 控制流程及相對移動

初階 If/else 和迴圈範例先保持只輸出文字。每個 while 迴圈都應有明確停止條件。教授 **RelMovL** 時，分清笛卡兒座標偏移、TCP 和 **CP=0** 路徑平滑選項。模擬器以基座座標系解析相對偏移；不支援使用者座標系或工具座標系。

### 評估與回饋

使用內置評估回饋引導學生解釋概念，不要把它當成實體操作能力證明。可以提問：

- TCP 代表甚麼？偏移是相對哪個基準量度？
- 為甚麼方塊中心與磁吸工具接觸的頂面不同？
- 無動力叉臂為何要滑入底部並抬起，而毋須 DO？
- 課程預覽範例與目前編輯器程式有甚麼分別？
- 模擬器成功完成程式代表甚麼？又不能證明甚麼？

課程完成狀態和嘗試次數會在瀏覽器本機儲存，並與機械臂專案分開。學生離開 Training 後仍可返回課程。專案匯入、匯出和重設只涉及機械臂專案，不是課程進度備份。如學生需要保留或轉移程式和教點，請匯出專案檔案。

### AI 教練、私隱及學生資料

AI 教練是選用功能。學生在頁面輸入自己的 OpenAI 相容 key、endpoint 和模型。App 不會儲存 key；它只在頁面記憶體中保留，清除或重新整理便會移除。分享專案內容預設關閉。如開啟，模型服務商會收到目前程式、教點名稱、工作站檢查結果和最近執行記錄。服務商可能處理或保留提示及回覆。

OpenRouter 的 Space Bunny Alpha 模型頁指出其第三方模型供應商可能保留提示和生成內容。不要加入學生姓名或個人資料。請使用匿名、精簡提示，並遵從學校的資料政策。AI 教練為唯讀建議工具，不會修改或執行學生程式。本機對範例的語法／API 檢查不能證明整個任務可達、沒有碰撞或正確。

### 相容性及證據標籤

向學生介紹產品時，請分清以下身分：

- **課程版本：**1.3.6，代表雙語教材版本。
- **Lua 支援範圍：**見 [相容性指南](dobotstudio-pro-28-subset.md) 所列的 DobotStudio Pro 2.8 指令子集。內置 Lua VM 的確切身分及完整控制器相容性未知。
- **Python 支援範圍：**模擬器專用 API，不是 Dobot 控制器 SDK。
- **模型及工作站：**原廠機械臂視覺模型、提供的本機工具網格和一個示範方塊；詳情見[模型來源](model-provenance.md)。
- **實體設備及韌體：**未進行實體校準、控制器執行、韌體驗證、安全驗證或部署。

不可把指定 +60 mm TCP 偏移、模擬關節限制、取件容差或模擬時間說成實體校準或安全限制。模擬器顯示成功不代表可以把同一程式用於實體設備。

### 延伸閱讀

- [學生指南](student-guide.md)
- [專案設定及產品概覽](../README.md)
- [Wayfinder 任務地圖](../.scratch/mg400-virtual-training-simulator/map.md)
