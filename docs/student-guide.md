# MG400 Virtual Training Simulator — Student Guide

**Course release:** 1.3.7
**Languages:** English and Traditional Chinese  
**Last checked against the app:** 5 October 2026

## What this simulator can do

Use the browser workspace to learn programming, teach named robot points, and watch a simulated Dobot MG400 move a reference block. The app has two separate editor buffers:

- **Lua** is a bounded training subset based on the documented DobotStudio Pro 2.8 command contract.
- **Python** uses this simulator's own API. It is for simulation practice and cannot run on a physical Dobot controller.

There is no physical robot connection, collision-safety system, contact-force model, or hardware calibration. Never assume a simulated point or path is safe to copy to a real robot.

## Start a lesson

1. Open **Training** and choose a lesson. Foundation is a good first stop; all three tracks remain available if your instructor assigns a different lesson.
2. Select **Lua** or **Python** in the workspace. The editor keeps the programs separate, and a lesson example follows the selected language.
3. Read the lesson's outcome and steps. Code shown in a lesson is a preview; it does not run when you press **Run**.
4. To practise an example, choose **Load this example…** and confirm the replacement. The current editor program stays until you confirm.
5. Return to the workspace and choose **Run editor code**. Watch the robot, TCP position, run status, and log. **Stop** cancels a run; after an error, read the first error in the log before trying again.

The first lesson is print-only. It needs no API key and does not move the robot. The first-motion lesson moves only to the selected tool's saved `PickApproach` point; it does not pick up the block. Recommended Intermediate order: practise the one-block Body1 passive-fork slide, lift, and release first (no DO); then practise a carried turn; then stack three blocks vertically with bottom/top at 0° and only the middle at +90°. Continue with RelMovL, single-plate magnet pickup, then four 35 × 35 × 4 mm magnetic plates sorted into separate black and white stacks.

## Choose a tool and teach points

Open **Tool & pickup** to choose the active tool and review the configured TCP offset. The TCP (Tool Center Point) is the reference point used by motion commands. The requested default is 60 mm in flange-frame +X; this is a simulator setting, not a measurement of a physical installation.

In **Teach**, use **Teach pick pair** or **Teach place pair** to create or refresh approach and contact points for the selected tool. You can also jog the robot, save its current TCP pose or joint angles, edit a point, and press **Go to** to move the simulated arm there. Cartesian coordinates use millimetres and degrees; joint values use radians.

Choose the tool before teaching or refreshing its points. A saved point is a pose for the active TCP, so Magnet and Fork targets can differ even when they refer to the same block.

## The two pick-and-place modes

| Tool | What the simulator represents | Program behavior |
|---|---|---|
| **Magnet** | A 35 × 35 × 4 mm plate rests on the front 110 mm platform. A contrasting arrow marks the workpiece's local +X direction; the magnetic tool approaches the top face. | `DO(1, ON)` and `DO(1, OFF)` are simulator-only attach and release actions. They are not physical I/O. In the black/white stacking lesson, the white plate is attached and lifted before the wrist turns +45°. |
| **Fork** | The supplied printed fork enters the 40 × 40 × 40 mm Body1 grooves. Body1 rests directly on the shared platform at Z = 110 mm; the fork insertion TCP is Z = 132.5 mm and the support/release height is Z = 135 mm. | Move to the entry point, slide under the block, lift to pick it up, then lower it to release. No `DO`, `Pick()`, or `Place()` call is needed. |

The fork is passive: it has no motor or powered fingers. The app models support and release with deterministic simulator rules, not rigid-body physics. A completed run is evidence about this simulator only.

In the carried-block rotation lesson, the passive fork carries the supplied grooved Body1. Watch its arrow: it turns with the block only after pickup and an 80 mm lift. The arrow shows orientation; the square block's dimensions do not change. This fork task needs no powered gripper or `DO` command.

## Read coordinates and common terms

| Term | Meaning in this simulator |
|---|---|
| **Flange** | The robot's tool-mounting face. |
| **TCP** | The configured tool-tip reference used by motion commands; its default X offset from the flange is +60 mm. |
| **Taught point** | A named TCP pose or set of four joint angles that a program can use. |
| **Approach point** | A pose before the tool reaches its pickup or placement contact position. |
| **X, Y, Z, R** | TCP position in millimetres and rotation about the vertical axis in degrees; Z points up. |
| **J1–J4** | The MG400's four joint angles, shown in radians in the simulator. |
| **CP** | A path-blending option. This simulator supports only `CP=0`; it is not the TCP offset. |

Fresh exercises share a front platform with top Z = 110 mm. The magnetic plate centre is Z = 112 mm and its contact face is Z = 114 mm. Body1 rests directly on the platform at Z = 110 mm; its fork insertion TCP is Z = 132.5 mm and support/release height is Z = 135 mm. These are base-frame coordinates; older custom projects retain their saved geometry and points.

## Write and check a program

Start with the course examples and the simulator's current program recommendation. Motion targets should use a saved point such as `PickApproach`, not a quoted point name or a raw list of coordinates. Read the displayed API guidance for the current language and tool mode.

`RelMovL` moves linearly by an offset in the simulator's base Cartesian frame. Lua uses `RelMovL` and uppercase option names such as `CP`; Python uses the simulator-only `rel_mov_l` API and Python-style option names. Motion timing is simulated. User-frame/tool-frame motion and continuous path blending are not implemented.

The RelMovL lesson's interactive diagram compares named target coordinates with repeated equal offsets. It defines `N` as the piece count, starts target index `i` at zero, uses `h` for stack height, and uses `w + gap` for row spacing. The first target is P₀; the program then repeats the same relative step `N−1` times. Use the matching Lua or Python **Copy** button for the selected pattern and count. **Load the two-move demo** is a separate fixed example: it moves to sample P₀, then +Z 20 mm and +X 15 mm. It does not pick up or release an object.

If a run stops or reports an error:

1. Read the first error line.
2. Check the selected tool, saved point names and types, units, and joint limits.
3. In Fork mode, remove powered pickup/release calls and check the approach → slide → lift → lower order.
4. Change one thing, run again, and compare the TCP and block position.

The simulator does not check every possible path collision or prove real-world safety.

## External controller reference: function registry

The user-supplied `roboarm-master.zip` contains this registry-and-call pattern in `roboarm-master/dobot_controller.py`, lines 309–319 (abridged):

```python
functions = [AI_TickTacToe, TickTacToe, student_id, exit]
menu_items = dict(enumerate(functions, start=1))
selection = int(input("input: "))
selected_value = menu_items[selection]
selected_value()
```

The list stores function objects; the selected function runs when `selected_value()` is called. `student_id` here is a function name, not a student's identifier value. The functions must already be defined in that external program.

This is an external controller reference, not a browser simulator program. The archive's controller imports `roboarm-master/dobot_api.py` and connects to real controller dashboard, motion, and feedback services. Its connection setup, menu input, and controller API are outside this simulator's API.

For browser practice, keep using the simulator's lesson commands inside an ordinary function, then call it without `await`. A print-only example is:

```python
def task():
    print("Ready for simulator practice")

task()
```

## Optional AI code coach

The code coach is optional. The free **If / else** and **Loops** lessons work without an AI key. To use a provider, enter your own OpenAI-compatible API key, full Chat Completions URL, and model ID. The default model ID is `stealth/space-bunny-alpha` at OpenRouter.

The key stays in page memory and is cleared when you refresh or forget it. Project sharing is off by default. If you turn sharing on, the coach can receive the current program, saved point names, setup checks, and a recent run log. The model provider may process or retain prompts. Do not send student names, passwords, private code, or other personal information.

The coach gives advice; it does not edit or run your program. The app performs local syntax and known-API checks on supported examples, but those checks do not prove reachability, collision safety, or full program behavior. Treat the simulator's run status and log as separate evidence, and decide yourself whether to copy or run a suggestion.

## Save your work

The browser saves the current robot project locally. You can export a project JSON file for backup and import a validated project. Course progress is saved separately from the robot project. Browser data belongs to this browser profile; clearing site data can remove it. Keep an exported backup if you need to move work to another device.

## Further references

- [Instructor guide](instructor-guide.md)
- [Documented DobotStudio Pro 2.8 subset and known differences](dobotstudio-pro-28-subset.md)
- [Model provenance and fidelity limits](model-provenance.md)

## 繁體中文

### 模擬器可以做甚麼

你可以在瀏覽器工作區學習程式、建立具名機械臂教點，並觀看模擬的 Dobot MG400 移動示範方塊。編輯器有兩個互相分開的程式緩衝區：

- **Lua** 是根據 DobotStudio Pro 2.8 已列明指令合約建立的有限訓練子集。
- **Python** 使用本模擬器專用 API，只供模擬器練習，不能在實體 Dobot 控制器執行。

本程式沒有連接實體機械臂、碰撞安全系統、接觸力模型或硬件校準。不要假設模擬教點或路徑可以安全地用於實體機械臂。

### 開始課堂練習

1. 開啟 **Training** 並選擇課堂。第一次學習可由 Foundation 開始；如導師另有安排，亦可直接選擇其他課程。
2. 在工作區選擇 **Lua** 或 **Python**。兩種語言的編輯器程式分開儲存，課程範例會跟隨目前選取的語言。
3. 閱讀課程目標和步驟。課程內的程式碼只是預覽；按 **Run** 不會直接執行它。
4. 如要練習範例，選擇 **Load this example…** 並確認替換。確認之前，編輯器內原有程式不會被覆蓋。
5. 返回工作區，選擇 **Run editor code**。留意機械臂、TCP 位置、執行狀態及記錄。**Stop** 可取消執行；遇到錯誤後，先閱讀記錄中的第一個錯誤再重試。

第一課只會輸出文字，不需 API key，也不會移動機械臂。第一次移動課只會移至目前工具已儲存的 **PickApproach** 接近點，不會拾起方塊。建議中階次序：先用一件 Body1 練習被動叉臂沿槽滑入、抬起及釋放（不需 DO）；再練習攜件旋轉；然後以三件方塊垂直建塔，底層及頂層保持 0°，只有中層轉 +90°。之後學 RelMovL、單件磁吸取放，再用四塊 35 × 35 × 4 mm 磁吸片把黑白分成兩疊。

### 選擇工具及建立教點

開啟 **Tool & pickup** 選擇目前工具，並查看已設定的 TCP 偏移。TCP（Tool Center Point，工具中心點）是移動指令使用的參考位置。本專案指定的預設位置為法蘭座標 +X 方向 60 mm；這是模擬器設定，不是實體安裝的量度值。

在 **Teach** 面板使用 **Teach pick pair** 或 **Teach place pair**，按目前工具建立或更新接近點和接觸點。你亦可使用 Jog 移動機械臂、儲存目前 TCP 姿態或關節角度、編輯教點，並按 **Go to** 令模擬機械臂前往該位置。笛卡兒座標使用毫米及角度；關節數值使用弧度。

建立或更新教點前先選好工具。教點代表目前 TCP 的姿態，所以即使目標是同一個方塊，Magnet 和 Fork 的教點亦可能不同。

### 兩種取放模式

| 工具 | 模擬內容 | 程式行為 |
|---|---|---|
| **Magnet** | 35 × 35 × 4 mm 磁吸片放在前方 110 mm 平台上，對比色箭嘴標示方塊本身的 +X 方向；磁吸工具從上方接觸頂面。 | **DO(1, ON)** 和 **DO(1, OFF)** 只在模擬器內代表吸附及釋放，並非實體 I/O。黑白磁吸片堆疊課會先吸附及抬高白片，再把手腕轉 +45°。 |
| **Fork** | 隨附叉臂沿 40 × 40 × 40 mm Body1 槽滑入。Body1 直接放在頂面 Z = 110 mm 的共用平台上；叉臂插入 TCP 為 Z = 132.5 mm，承托／釋放高度為 Z = 135 mm。 | 移至入口點，沿槽滑入、抬起方塊，再降下釋放。毋須呼叫 **DO**、**Pick()** 或 **Place()**。 |

叉臂是被動工具：沒有馬達或動力手指。程式以確定性的模擬規則處理承托和釋放，並非剛體物理模擬。成功完成模擬只代表模擬器內的結果。

在 Body1 叉臂旋轉課中觀察箭嘴：被動叉臂承托方塊並抬高 80 mm 後，才旋轉 +90°；箭嘴會跟隨方塊轉向。箭嘴顯示方向，方塊尺寸保持不變。此課不使用動力夾具，也不需 DO 指令。

### 座標及常用術語

| 術語 | 在本模擬器中的意思 |
|---|---|
| **法蘭（Flange）** | 機械臂安裝工具的端面。 |
| **TCP** | 移動指令使用的工具端參考位置；預設相對法蘭的 X 偏移為 +60 mm。 |
| **教點（Taught point）** | 以名稱儲存的 TCP 姿態或四個關節角度，供程式引用。 |
| **接近點（Approach point）** | 工具到達取件或放置接觸位置之前的姿態。 |
| **X、Y、Z、R** | TCP 的毫米位置，以及繞垂直軸的角度；Z 軸向上。 |
| **J1–J4** | MG400 的四個關節角度；本模擬器以弧度顯示。 |
| **CP** | 路徑平滑選項。本模擬器只支援 **CP=0**；它不是 TCP 偏移。 |

新練習共用前方平台，頂面 Z = 110 mm。磁吸片中心 Z = 112 mm、接觸頂面 Z = 114 mm。Body1 直接放在平台上，底面 Z = 110 mm；叉臂插入 TCP 為 Z = 132.5 mm，承托／釋放高度為 Z = 135 mm。這些是基座座標；舊自訂專案保留已儲存幾何與教點。

### 編寫及檢查程式

先使用課程範例和模擬器目前提供的程式建議。移動指令應使用 **PickApproach** 等已儲存教點，而不是帶引號的教點名稱或直接輸入座標數列。請按目前語言及工具模式閱讀 API 指引。

**RelMovL** 會在本模擬器的基座笛卡兒座標系中按偏移作直線移動。Lua 使用 **RelMovL** 和 **CP** 等大寫選項名稱；Python 使用模擬器專用 **rel_mov_l** API 及 Python 風格的選項名稱。移動時間是模擬值；本模擬器不支援使用者座標系、工具座標系或連續路徑平滑。

RelMovL 課程中的互動圖會比較逐點指定座標與重複固定偏移。`N` 代表件數，目標序號 `i` 由 0 起算，`h` 代表堆疊高度，`w + gap` 代表列排列步距。程式先到首個目標 P₀，再重複相同步進 `N−1` 次。要載入所選排列及件數，請按相應語言的「複製程式碼」按鈕。「載入兩步移動示範」是另一個固定範例：先移至示範首點 P₀，再 +Z 20 mm 及 +X 15 mm。範例只會移動，不會取件或釋放物件。

如程式停止或顯示錯誤：

1. 閱讀記錄中的第一個錯誤。
2. 檢查目前工具、教點名稱和類型、單位及關節限制。
3. Fork 模式下移除動力式取放指令，並檢查「接近 → 滑入 → 抬起 → 放低」的次序。
4. 每次只改一項，再執行並比較 TCP 和方塊位置。

模擬器不會檢查所有可能的路徑碰撞，也不能證明實體運作安全。

### 外部控制器參考：函式表

使用者提供的 `roboarm-master.zip` 中，`roboarm-master/dobot_controller.py` 第 309–319 行包含以下函式表及呼叫模式（節錄）：

```python
functions = [AI_TickTacToe, TickTacToe, student_id, exit]
menu_items = dict(enumerate(functions, start=1))
selection = int(input("input: "))
selected_value = menu_items[selection]
selected_value()
```

串列存放函式物件；呼叫 `selected_value()` 才會執行所選函式。此處 `student_id` 是函式名稱，不是學生編號的數值。這些函式須已在該外部程式中定義。

這是外部控制器參考，不能當作瀏覽器模擬器程式執行。壓縮檔內的控制程式匯入 `roboarm-master/dobot_api.py`，並連接實體控制器的 dashboard、移動及回饋服務；其連線設定、選單輸入及控制器 API 均不屬於本模擬器 API。

瀏覽器練習仍使用課程中的模擬器指令，寫在普通函式內，再直接呼叫，毋須 `await`。只輸出文字的例子：

```python
def task():
    print("Ready for simulator practice")

task()
```

### 選用 AI 程式教練

AI 程式教練是選用功能。免費的 **If / else** 和 **Loops** 課程毋須 AI key。如要使用模型服務，請輸入自己的 OpenAI 相容 API key、完整 Chat Completions URL 及模型 ID。OpenRouter 的預設模型 ID 是 **stealth/space-bunny-alpha**。

Key 只保留在目前頁面的記憶體中；重新整理或按清除後便會移除。分享專案內容預設關閉。如開啟，教練可能收到目前程式、教點名稱、工作站檢查結果和最近執行記錄。模型服務商可能處理或保留提示內容。不要輸入學生姓名、密碼、私人程式碼或其他個人資料。

教練只提供建議，不會編輯或執行你的程式。模擬器會在本機檢查受支援範例的語法及已知 API，但這些檢查不能證明程式可達、沒有碰撞或整體行為正確。模擬器執行狀態和記錄是另一類證據；是否複製或執行建議由你決定。

### 儲存練習

瀏覽器會在本機儲存目前機械臂專案。你可匯出 JSON 專案作備份，或匯入經驗證的專案。課程進度與機械臂專案分開儲存。資料屬於目前瀏覽器設定檔；清除網站資料可能會移除它。如需轉移至另一部裝置，請保留匯出的備份。

### 延伸閱讀

- [導師指南](instructor-guide.md)
- [DobotStudio Pro 2.8 指令子集及已知差異](dobotstudio-pro-28-subset.md)
- [模型來源及模擬限制](model-provenance.md)
