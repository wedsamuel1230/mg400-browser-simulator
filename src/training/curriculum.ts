import { FORK_SUPPORT_HEIGHT_MM } from "../domain";

export type CourseLanguage = "en" | "zh-Hant";
export type TrackId = "foundation" | "intermediate" | "advanced";

type LocalizedText = { en: string; "zh-Hant": string };
export type AssessmentQuestion = LocalizedText & {
  options: { en: string[]; "zh-Hant": string[] };
  answer: number;
  explanation: LocalizedText;
};

export type Lesson = {
  id: string;
  track: TrackId;
  durationMinutes: number;
  evidenceProfile: LocalizedText;
  title: LocalizedText;
  outcome: LocalizedText;
  prerequisite: LocalizedText;
  explanation: LocalizedText[];
  guidedSteps: LocalizedText[];
  practice: LocalizedText;
  examples: { lua: string; python: string };
  questions: AssessmentQuestion[];
};

export type Track = {
  id: TrackId;
  title: LocalizedText;
  summary: LocalizedText;
};

export const CURRICULUM_VERSION = "1.3.5";

export const TRACKS: Track[] = [
  {
    id: "foundation",
    title: { en: "Foundation", "zh-Hant": "初階" },
    summary: { en: "Start with a message and a first simulated move, then learn conditions, loops, coordinates, and taught points.", "zh-Hant": "先顯示文字並試做第一次模擬移動，再學條件句、迴圈、座標及教點。" },
  },
  {
    id: "intermediate",
    title: { en: "Intermediate", "zh-Hant": "中階" },
    summary: { en: "Use relative moves, build logical pick-and-place cycles, and observe carried-tool rotation.", "zh-Hant": "運用相對移動，建立邏輯式取放流程，並觀察工具攜件旋轉。" },
  },
  {
    id: "advanced",
    title: { en: "Advanced", "zh-Hant": "進階" },
    summary: { en: "Reason about queued commands, faults, and simulation limits.", "zh-Hant": "理解指令佇列、故障診斷及模擬器限制。" },
  },
];

export const LESSONS: Lesson[] = [
  {
    id: "foundation-first-program",
    track: "foundation",
    durationMinutes: 8,
    evidenceProfile: { en: "Selected-language basics · simulator-only text example", "zh-Hant": "所選語言基礎 · 模擬器文字範例" },
    title: { en: "Your first program: show a message", "zh-Hant": "第一個程式：顯示文字" },
    outcome: { en: "Use the selected language's comment, named value, and print statement without moving the robot.", "zh-Hant": "學會所選語言的註解、命名變數及 print 指令，全程不會移動機械臂。" },
    prerequisite: { en: "None. Start here if this is your first time coding.", "zh-Hant": "無。如果你第一次寫程式，請由此開始。" },
    explanation: [
      { en: "A program runs from top to bottom. A comment is a note for people that the language skips: Lua starts one with `--`; Python starts one with `#`. The next line gives text a name (`local greeting = ...` in Lua; `greeting = ...` in Python), and `print(greeting)` shows it in the Run output.", "zh-Hant": "程式會由上而下執行。註解是給人看的提示，程式會略過：Lua 用 `--` 開始註解；Python 用 `#`。下一行為文字命名（Lua 寫 `local greeting = ...`；Python 寫 `greeting = ...`），而 `print(greeting)` 會在 執行記錄區顯示文字。" },
      { en: "In both examples, `=` stores a value. Both languages later use `==` to compare values; Lua closes `if` and loop blocks with `end`, while Python uses indentation. You do not need those ideas to run this first example.", "zh-Hant": "兩個範例都用 `=` 儲存數值。兩種語言之後都會用 `==` 比較數值；Lua 用 `end` 結束 `if` 和迴圈區塊，Python 則用縮排。本範例暫時不需要這些概念。" },
      { en: "In this simulator, Lua is the MG400 training language, limited to the documented simulator subset. Python is for this simulator only; its code cannot run on a physical Dobot controller. Lua and Python keep separate editor programs, and the lesson example always follows the selected language tab.", "zh-Hant": "本模擬器以 Lua 作 MG400 訓練語言，但只支援已列明的模擬器子集。Python 只供本模擬器使用，程式不能在實體 Dobot 控制器執行。Lua 和 Python 的編輯器程式分開儲存；課程範例會跟隨目前選取的語言分頁。" },
      { en: "This text-only lesson example has no robot commands and needs no API key. The editor may still contain the full pick-and-place demo. Run executes the program in the editor, not the example preview in this lesson. Loading this example asks you to confirm before it replaces the editor contents.", "zh-Hant": "本課的文字範例沒有機械臂指令，也不需 API key。編輯器可能仍有完整取放示範程式。「執行編輯器程式」會執行編輯器內的程式，不會執行課程中的預覽範例。載入本範例前，系統會先請你確認才替換編輯器內容。" },
    ],
    guidedSteps: [
      { en: "Read the three lines in the selected-language example and find which one is a note, which one saves text, and which one displays it.", "zh-Hant": "閱讀所選語言的三行程式，找出哪行是註解、哪行儲存文字，以及哪行負責顯示文字。" },
      { en: "To practise, choose Load this example… and confirm the replacement. Until you load it, Run will execute the current editor program, not the lesson preview. You can also skip running and just read the example.", "zh-Hant": "如要練習，請按「載入此範例…」並確認替換。在載入之前，「執行編輯器程式」會執行編輯器目前的程式，而非課堂預覽；你亦可以跳過執行，只閱讀範例。" },
      { en: "After loading the example, change the words inside the quotes and press Run. Check that only the printed message changes while the virtual robot stays still.", "zh-Hant": "載入範例後，修改引號內的文字再按「執行編輯器程式」。確認只有輸出的訊息改變，而虛擬機械臂保持不動。" },
    ],
    practice: { en: "After loading the lesson example, change the message to introduce yourself, run it, and explain in one sentence what `print` did.", "zh-Hant": "載入課堂範例後，把訊息改成自我介紹，再執行並用一句話說明 `print` 做了甚麼。" },
    examples: {
      lua: "-- A comment is a note for people\nlocal greeting = \"Hello, robot!\"\nprint(greeting)",
      python: "# A comment is a note for people\ngreeting = \"Hello, robot!\"\nprint(greeting)",
    },
    questions: [
      {
        en: "What does `print(greeting)` do in this example?",
        "zh-Hant": "在本範例中，`print(greeting)` 會做甚麼？",
        options: { en: ["Save new text", "Display the greeting in Run output", "Move the robot arm"], "zh-Hant": ["儲存新文字", "在 執行記錄區顯示問候文字", "移動機械臂"] },
        answer: 1,
        explanation: { en: "`print` writes the value to the Run output. The example has no motion command.", "zh-Hant": "`print` 會把變數內容寫到 執行記錄區。本範例沒有機械臂移動指令。" },
      },
    ],
  },
  {
    id: "foundation-first-robot-move",
    track: "foundation",
    durationMinutes: 7,
    evidenceProfile: { en: "First code-to-motion mission · simulated tool-specific TCP points", "zh-Hant": "首次程式控制機械臂任務 · 模擬器工具 TCP 教點" },
    title: { en: "First robot move: go to the approach point", "zh-Hant": "第一次移動機械臂：前往接近點" },
    outcome: { en: "Run one MovJ command to move to the active tool's saved PickApproach point; it does not contact or pick the block.", "zh-Hant": "執行一個 MovJ 指令，移至目前工具已儲存的 PickApproach 接近點；不會接觸或拾起方塊。" },
    prerequisite: { en: "Complete or review the first print program. This runs only in the simulator, not on a physical MG400.", "zh-Hant": "先完成或重溫第一個 print 程式。本課只會在模擬器移動，不會控制實體 MG400。" },
    explanation: [
      { en: "PickApproach and PickPoint are saved Cartesian TCP poses. In the Teach panel, Teach pick pair creates or refreshes them for the active tool and current block. A point name lets code refer to a pose without typing its coordinates.", "zh-Hant": "PickApproach 和 PickPoint 是已儲存的笛卡兒 TCP 姿態。在「示教點面板」按 「示教拾取點組」，便會按目前工具及方塊位置建立或更新兩個教點。程式可用名稱引用姿態，毋須輸入座標。" },
      { en: "MovJ moves the TCP to the named approach pose, and Sync waits for that queued move to finish. This is a single simulated move: it contains no DO, Pick, Place, or straight-line insertion command, and does not pick up the block.", "zh-Hant": "MovJ 會把 TCP 移至指定接近姿態，而 Sync 會等待佇列中的移動完成。這只是一個模擬移動：沒有 DO、Pick、Place 或直線插入指令，也不會拾起方塊。" },
      { en: "The configured TCP is 60 mm along +X from the flange and can be changed in Tool & pickup. The magnet's taught approach is above the block. The passive, unpowered fork's entry point is 60 mm before the block at its raised support height, Z=20 mm. This first move goes only to that approach pose; it does not insert, lift, or pick up anything.", "zh-Hant": "目前設定的 TCP 位於法蘭 +X 方向 60 mm，可在 「工具與取件」 修改。磁吸工具的接近點位於方塊上方；無動力叉臂的入口點則位於方塊前方 60 mm、Z=20 mm 抬高承托面。本次只移至接近姿態，不會插入、抬起或拾取任何物件。" },
    ],
    guidedSteps: [
      { en: "Close Training Center to return to the workspace. Your current lesson and completed course progress stay saved; the selected tool and taught points save automatically with this local project. In the Teach panel, select Magnet pickup or Fork pickup and click Teach pick pair. Choose Training in the top bar to resume this lesson; PickApproach will match the selected tool.", "zh-Hant": "先關閉訓練中心返回工作區。本課位置及已完成進度會保留；所選工具和教點會自動儲存到本機專案。在「示教點面板」選擇 「磁吸拾取」 或 「叉臂拾取」，再按 「示教拾取點組」。按頂部的「訓練中心」 即可繼續本課；PickApproach 會配合所選工具。" },
      { en: "Load this lesson's example and confirm the selected Lua or Python editor replacement. Then press Run editor code; the command uses the saved point, not the preview text in this lesson.", "zh-Hant": "載入本課範例，並確認替換目前選取的 Lua 或 Python 編輯器內容。然後按 「執行編輯器程式」；指令會使用已儲存教點，不會執行課堂內的預覽文字。" },
      { en: "Watch the TCP marker and position move to PickApproach. Sync waits until the move finishes. The block stays where it is; no pickup is attempted.", "zh-Hant": "觀察 TCP 標記及位置移至 PickApproach。Sync 會等待移動完成。方塊會留在原位；程式不會嘗試拾取。" },
      { en: "Try the other tool mode: close the lesson, select that tool, teach the pick pair, reopen the lesson, and run the same example. Compare the TCP display. This is a kinematic simulation and does not check collision clearance.", "zh-Hant": "試用另一種工具模式：關閉課堂、選擇另一工具、教取件點、重新開啟本課，再執行相同範例並比較 TCP 讀數。這是運動學模擬，沒有檢查碰撞間隙。" },
    ],
    practice: { en: "Run the example once in each tool mode. Record the TCP X/Y/Z values at PickApproach and explain why the two approaches differ. Do not add pickup, release, or DO commands.", "zh-Hant": "在兩種工具模式各執行一次範例，記錄 TCP 到達 PickApproach 時的 X／Y／Z 數值，並解釋兩個接近位置為何不同。不要加入拾取、釋放或 DO 指令。" },
    examples: {
      lua: "-- First robot move: go to a saved approach point\nMovJ(PickApproach, {CP=0})\nSync()",
      python: "# First robot move: go to a saved approach point\nawait mov_j(PickApproach, cp=0)\nawait sync()",
    },
    questions: [
      {
        en: "What happens when this example runs?",
        "zh-Hant": "執行本範例時會發生甚麼事？",
        options: { en: ["The simulated robot moves to the saved PickApproach point", "The fork inserts under and lifts the block", "The program runs on a physical MG400"], "zh-Hant": ["模擬機械臂移至已儲存的 PickApproach 接近點", "叉臂插入方塊底部並將它抬起", "程式在實體 MG400 執行"] },
        answer: 0,
        explanation: { en: "The example performs one simulated MovJ to a saved approach pose and waits. It does not insert, pick up, or control hardware.", "zh-Hant": "範例只會以一個模擬 MovJ 移至已儲存接近姿態，再等待完成；不會插入、拾取或控制硬件。" },
      },
    ],
  },
  {
    id: "foundation-if-else",
    track: "foundation",
    durationMinutes: 7,
    evidenceProfile: { en: "Selected-language conditional syntax · print-only examples", "zh-Hant": "所選語言的條件句語法 · 只輸出文字範例" },
    title: { en: "If and else: choose a path", "zh-Hant": "If 與 else：選擇程式分支" },
    outcome: { en: "Use if/elseif/else in Lua or if/elif/else in Python to choose which message to print.", "zh-Hant": "在 Lua 使用 if／elseif／else，或在 Python 使用 if／elif／else，選擇要輸出的訊息。" },
    prerequisite: { en: "Know how to read the first program and call print() in the selected language. No robot motion is required for this lesson.", "zh-Hant": "懂得閱讀第一個程式及在所選語言呼叫 print() 即可；本課毋須移動機械臂。" },
    explanation: [
      { en: "A condition is a yes-or-no question. Use == to compare values; one = stores a value. Lua uses if condition then, optional elseif and else branches, and closes the whole decision with end. Python uses if/elif/else, a colon, and indentation.", "zh-Hant": "條件是一個答案為真或假的問題。用 == 比較數值；單一 = 用來儲存數值。Lua 用 if 條件 then，可加入 elseif 和 else 分支，最後用 end 結束整個判斷。Python 用 if／elif／else、冒號及縮排。" },
      { en: "Lua writes “not equal” as ~=; Python writes it as !=. Only the first true branch runs; else is the fallback when the earlier conditions are false. These examples print messages and do not move the robot.", "zh-Hant": "Lua 用 ~= 表示「不相等」；Python 用 !=。第一個結果為真的分支會執行；若之前的條件都不成立，便執行 else。這些範例只會輸出訊息，不會移動機械臂。" },
    ],
    guidedSteps: [
      { en: "Read the example and predict which message appears when blockHeight is 15.", "zh-Hant": "閱讀範例，預測 blockHeight 為 15 時會顯示哪個訊息。" },
      { en: "Change blockHeight to 10, then 5. Predict each result before pressing Run, then compare with the output. Notice that Lua uses then/end while Python uses a colon and indentation.", "zh-Hant": "把 blockHeight 改成 10，再改成 5。每次按「執行編輯器程式」 前先預測結果，再對照輸出。留意 Lua 用 then／end，而 Python 用冒號及縮排。" },
      { en: "Change one comparison, such as > to >=. Explain which value now enters a different branch; keep this practice free of robot commands.", "zh-Hant": "把其中一個比較符號由 > 改為 >=，說明哪個數值現在會進入不同分支；本練習先不要加入機械臂指令。" },
    ],
    practice: { en: "Write an if/else that prints “ready” when blockHeight is at least 10 and “check height” otherwise. Test both results with print-only code.", "zh-Hant": "寫一個 if／else：blockHeight 大於或等於 10 時輸出「ready」，否則輸出「check height」。用只含 print 的程式測試兩個結果。" },
    examples: {
      lua: "local blockHeight = 15\nif blockHeight > 10 then\n  print(\"Review the height\")\nelseif blockHeight == 10 then\n  print(\"Use the example\")\nelse\n  print(\"Check the height\")\nend",
      python: "block_height = 15\nif block_height > 10:\n    print(\"Review the height\")\nelif block_height == 10:\n    print(\"Use the example\")\nelse:\n    print(\"Check the height\")",
    },
    questions: [
      {
        en: "Which operator compares two values for equality in both Lua and Python?",
        "zh-Hant": "Lua 和 Python 都用哪個運算符比較兩個值是否相等？",
        options: { en: ["=", "==", "==="], "zh-Hant": ["=", "==", "==="] },
        answer: 1,
        explanation: { en: "Both Lua and Python use == for equality. A single = assigns a value; Lua uses ~= and Python uses != for inequality.", "zh-Hant": "Lua 和 Python 都用 == 比較相等。單一 = 用來指定值；Lua 用 ~=、Python 用 != 比較不相等。" },
      },
      {
        en: "What does the else branch do?",
        "zh-Hant": "else 分支會做甚麼？",
        options: { en: ["Run when the earlier conditions are false", "Run every branch at once", "Move the robot arm"], "zh-Hant": ["之前的條件都不成立時執行", "同時執行所有分支", "移動機械臂"] },
        answer: 0,
        explanation: { en: "Else is the fallback branch. In these beginner examples, each decision only prints a message.", "zh-Hant": "else 是後備分支。這些初學範例只會因應判斷輸出訊息。" },
      },
    ],
  },
  {
    id: "foundation-loops",
    track: "foundation",
    durationMinutes: 8,
    evidenceProfile: { en: "Selected-language finite loops · print-only examples", "zh-Hant": "所選語言的有限迴圈 · 只輸出文字範例" },
    title: { en: "Loops: repeat a small task", "zh-Hant": "迴圈：重複小任務" },
    outcome: { en: "Use a finite for loop or a counter-controlled while loop to repeat a small print task.", "zh-Hant": "使用次數有限的 for 迴圈或計數器控制的 while 迴圈，重複小型 print 任務。" },
    prerequisite: { en: "Read the first program and the If and else lesson. No robot motion is required.", "zh-Hant": "先閱讀第一個程式及「If 與 else」課程；本課毋須移動機械臂。" },
    explanation: [
      { en: "A loop repeats its body. Lua can count with `for step = 1, 3 do ... end`; Python uses `for step in range(1, 4):`. The stop value in Python's range is not included, so range(1, 4) prints steps 1, 2, and 3.", "zh-Hant": "迴圈會重複執行內文。Lua 可用 `for step = 1, 3 do ... end` 計數；Python 使用 `for step in range(1, 4):`。Python 的 range 不包括結尾數值，所以 range(1, 4) 會輸出 1、2、3。" },
      { en: "A while loop repeats while its condition is true. Increase its counter each time so it eventually becomes false. Start with small, finite print-only examples; avoid `while true`, which has no automatic stopping condition.", "zh-Hant": "只要條件為真，while 便會重複執行。每次更新計數器，令條件最終變成假。先用次數少、有限及只輸出文字的範例；避免 `while true`，因為它沒有自動停止條件。" },
    ],
    guidedSteps: [
      { en: "Run the for example and count its three messages. Change the last count from 3 to 4 and predict the new output first.", "zh-Hant": "執行 for 範例並數出三個訊息。把最後一次數值由 3 改為 4，先預測輸出再執行。" },
      { en: "Read the while example. Follow count from 0 to 3 and identify the value that makes the condition false.", "zh-Hant": "閱讀 while 範例，追蹤 count 由 0 變成 3，找出令條件變假的數值。" },
      { en: "Change the counter update or limit by one. Check that the loop still stops and prints the number of times you expected.", "zh-Hant": "把計數器更新量或上限改動 1。確認迴圈仍會停止，而且輸出次數符合預測。" },
    ],
    practice: { en: "Write a for loop that prints steps 1 through 3, then a while loop that counts down from 3 to 1. Do not add robot commands yet.", "zh-Hant": "寫一個 for 迴圈輸出步驟 1 至 3，再寫一個 while 迴圈由 3 倒數至 1；暫時不要加入機械臂指令。" },
    examples: {
      lua: "for step = 1, 3 do\n  print(\"Practice step\", step)\nend\n\nlocal count = 0\nwhile count < 3 do\n  count = count + 1\n  print(\"Repeat\", count)\nend",
      python: "for step in range(1, 4):\n    print(\"Practice step\", step)\n\ncount = 0\nwhile count < 3:\n    count += 1\n    print(\"Repeat\", count)",
    },
    questions: [
      {
        en: "How many times does Lua run `for step = 1, 3 do`?",
        "zh-Hant": "Lua 的 `for step = 1, 3 do` 會執行多少次？",
        options: { en: ["Three times", "Four times", "Until the robot reaches Home"], "zh-Hant": ["三次", "四次", "直到機械臂回到 Home"] },
        answer: 0,
        explanation: { en: "The Lua numeric loop includes both 1 and 3, so the values are 1, 2, and 3.", "zh-Hant": "Lua 數值迴圈包括 1 和 3，因此數值為 1、2、3，共三次。" },
      },
      {
        en: "What makes the while example stop?",
        "zh-Hant": "while 範例靠甚麼停止？",
        options: { en: ["The counter reaches 3, so count < 3 becomes false", "The condition stays true forever", "A DO command releases a block"], "zh-Hant": ["計數器到達 3，令 count < 3 變成假", "條件永遠為真", "DO 指令釋放方塊"] },
        answer: 0,
        explanation: { en: "Updating the counter makes the condition false after three repetitions. A beginner loop should have a clear stopping condition.", "zh-Hant": "更新計數器後，條件會在重複三次後變成假。初學者迴圈應有清楚的停止條件。" },
      },
    ],
  },
  {
    id: "foundation-cell-and-coordinates",
    track: "foundation",
    durationMinutes: 12,
    evidenceProfile: { en: `Simulator cell definition · curriculum ${CURRICULUM_VERSION}`, "zh-Hant": `模擬工作站定義 · 課程 ${CURRICULUM_VERSION}` },
    title: { en: "The cell and its coordinates", "zh-Hant": "工作站與座標" },
    outcome: { en: "Read X, Y, Z, and R values and distinguish a block centre from the TCP pickup surface.", "zh-Hant": "讀取 X、Y、Z、R 數值，並分辨方塊中心與工具 TCP 取放面。" },
    prerequisite: { en: "Complete or review Your first program. No robot experience is required.", "zh-Hant": "先完成或重溫「第一個程式」。不需要機械臂經驗。" },
    explanation: [
      { en: "J1 to J4 are the robot's four joints. X, Y, and Z describe the configured TCP (Tool Center Point: the tool-tip reference point used by motion commands); R is its rotation about the vertical axis. The user-requested +60 mm X tool offset is a simulator setting, not a physical calibration measurement.", "zh-Hant": "J1 至 J4 是機械臂的四個關節。X、Y、Z 表示已設定的 TCP（Tool Center Point，工具中心點：移動指令使用的工具端參考點）；R 表示它繞垂直軸旋轉的角度。使用者指定的工具 X 軸 +60 mm 偏移只屬模擬器設定，並非實體校準量度。" },
      { en: "A taught point saves a TCP pose or four joint angles under a name, so a program can refer to `PickPoint` instead of repeating numbers.", "zh-Hant": "教點會把 TCP 姿態或四個關節角度以名稱儲存，程式便可引用 `PickPoint`，不必反覆輸入數字。" },
      { en: "The reference block measures 40 × 40 × 15 mm. Its height depends on the selected tool: Magnet mode rests it on the table, so the top face is at Z=15 mm; Fork mode raises it on three pads with its bottom at Z=20 mm, so its centre is at Z=27.5 mm. The magnet targets the top face; the passive fork targets the support plane beneath the block.", "zh-Hant": "示範方塊尺寸為 40 × 40 × 15 mm，擺放高度視乎工具模式：Magnet 模式下底面位於枱面，頂面為 Z=15 mm；Fork 模式以三個承托墊把底面架高至 Z=20 mm，因此方塊中心為 Z=27.5 mm。磁吸工具對準頂面；無動力叉臂則對準方塊下方的承托平面。" },
    ],
    guidedSteps: [
      { en: "Find TCP POSITION under the 3D view and note the unit labels.", "zh-Hant": "在 3D 視窗下方找出 TCP POSITION，留意各欄的單位。" },
      { en: "Open Jog, make a small X or Y move, then compare the readout with the grid.", "zh-Hant": "開啟 點動，沿 X 或 Y 軸小幅移動，再對照讀數與網格。" },
      { en: "Open Tool & pickup and inspect the configured TCP offset and pickup tolerance.", "zh-Hant": "打開 「工具與取件」，查看 TCP 偏移及取件容差。" },
    ],
    practice: { en: "For each tool mode, state the block-centre height and the correct pickup/contact height. Explain why the magnet and passive fork use different target heights.", "zh-Hant": "分別寫出兩種工具模式下的方塊中心高度及取件／接觸高度，並解釋磁吸工具與無動力叉臂為何使用不同目標高度。" },
    examples: {
      lua: "-- Units: mm and degrees; Z points up\nlocal Current = GetPose()\nprint(Current.coordinate.x, Current.coordinate.y, Current.coordinate.z, Current.coordinate.r)",
      python: "# Units: millimetres and degrees; Z points up\npose = await get_pose()\nprint(pose)",
    },
    questions: [
      {
        en: "What is the geometric centre height of a 15 mm tall block whose bottom sits at Z=0?",
        "zh-Hant": "一個高 15 mm、底面位於 Z=0 的方塊，其幾何中心高度是多少？",
        options: { en: ["7.5 mm", "15 mm", "40 mm"], "zh-Hant": ["7.5 mm", "15 mm", "40 mm"] },
        answer: 0,
        explanation: { en: "Half the block height is 7.5 mm. The top pickup surface is a different point at Z=15 mm.", "zh-Hant": "方塊高度的一半是 7.5 mm；頂面取件位置則是另一個位置 Z=15 mm。" },
      },
      {
        en: "Which axis points up in this simulator's cell view?",
        "zh-Hant": "本模擬工作站中，哪個軸向上？",
        options: { en: ["X", "Y", "Z"], "zh-Hant": ["X", "Y", "Z"] },
        answer: 2,
        explanation: { en: "Z is the vertical axis in the modeled cell.", "zh-Hant": "模擬工作站以 Z 軸作垂直方向。" },
      },
    ],
  },
  {
    id: "foundation-points-and-moves",
    track: "foundation",
    durationMinutes: 15,
    evidenceProfile: { en: "Pro V2.8 subset · motion semantics documented separately", "zh-Hant": "Pro V2.8 子集 · 移動指令語義另行標示" },
    title: { en: "Taught points and two kinds of move", "zh-Hant": "教點與兩種移動" },
    outcome: { en: "Teach a reusable named point and select MovJ or MovL for the right job.", "zh-Hant": "建立可重用的命名教點，並因應任務選擇 MovJ 或 MovL。" },
    prerequisite: { en: "Complete or review The cell and its coordinates.", "zh-Hant": "先完成或重溫「工作站與座標」。" },
    explanation: [
      { en: "A taught point stores a Cartesian TCP pose or four joint angles. A point name lets a program describe intent without repeating raw coordinates.", "zh-Hant": "教點可儲存 TCP 笛卡兒座標或四軸角度。程式以名稱引用教點，令步驟更易讀並避免重複輸入座標。" },
      { en: "MovJ moves between joint configurations; the TCP may follow a curved path. MovL solves a straight Cartesian TCP path and can fail if any part of that line leaves the modeled workspace.", "zh-Hant": "MovJ 在關節姿態之間移動，TCP 路徑可能彎曲。MovL 會沿笛卡兒直線移動 TCP；若直線任何部分離開模擬工作範圍，指令會失敗。" },
    ],
    guidedSteps: [
      { en: "Select a taught point and inspect its X/Y/Z/R fields.", "zh-Hant": "選取一個教點，查看 X/Y/Z/R 欄位。" },
      { en: "Jog the simulated arm, then use Teach current pose to save a new Cartesian point.", "zh-Hant": "點動 模擬機械臂，再按 「示教目前位置」 儲存新的笛卡兒教點。" },
      { en: "Compare the program's MovJ and MovL examples; run only targets inside the modeled workspace.", "zh-Hant": "比較程式中的 MovJ 與 MovL 範例；只執行位於模擬工作範圍內的目標。" },
    ],
    practice: { en: "Teach a point named SafeAbove, set its Z above the block, and describe why a straight-line approach is useful before pickup.", "zh-Hant": "教一個名為 SafeAbove 的點，將 Z 設於方塊上方，並說明取件前採用直線接近的好處。" },
    examples: {
      lua: "-- Named Cartesian targets are stored in the Teach points panel\nMovJ(PickApproach, {CP=0})\nMovL(PickPoint, {CP=0})",
      python: "# Reuse the named targets from Teach points\nawait mov_j(PickApproach, cp=0)\nawait mov_l(PickPoint, cp=0)",
    },
    questions: [
      {
        en: "Which command requests a straight Cartesian TCP path in the supported subset?",
        "zh-Hant": "支援的指令子集中，哪個指令要求 TCP 沿笛卡兒直線移動？",
        options: { en: ["MovJ", "MovL", "JointMovJ"], "zh-Hant": ["MovJ", "MovL", "JointMovJ"] },
        answer: 1,
        explanation: { en: "MovL is the linear Cartesian command. MovJ and JointMovJ do not promise a straight TCP path.", "zh-Hant": "MovL 是笛卡兒直線指令；MovJ 和 JointMovJ 不保證 TCP 沿直線移動。" },
      },
      {
        en: "What can happen if a MovL target is reachable but the straight path to it is not?",
        "zh-Hant": "如果 MovL 的終點可到達，但中間直線路徑不可達，會怎樣？",
        options: { en: ["The simulation reports a path/workspace error", "The command changes into MovJ", "The block is picked automatically"], "zh-Hant": ["模擬器會回報路徑／工作範圍錯誤", "指令自動改為 MovJ", "機械臂會自動取起方塊"] },
        answer: 0,
        explanation: { en: "The simulator checks the interpolated linear path and stops with a visible diagnostic if it leaves the modeled workspace.", "zh-Hant": "模擬器會檢查直線插補路徑；若路徑離開模擬工作範圍，便會停止並顯示診斷訊息。" },
      },
    ],
  },
  {
    id: "intermediate-relative-linear-motion",
    track: "intermediate",
    durationMinutes: 18,
    evidenceProfile: { en: "Official DobotStudio Pro V2.8.0 guide · RelMovL", "zh-Hant": "DobotStudio Pro V2.8.0 官方手冊 · RelMovL" },
    title: { en: "Relative linear motion with RelMovL", "zh-Hant": "RelMovL 相對直線移動" },
    outcome: { en: "Move by a base-frame Cartesian offset from the TCP pose when the queued command starts.", "zh-Hant": "理解指令開始執行時，TCP 按基座笛卡兒座標偏移移動。" },
    prerequisite: { en: "Understand TCP coordinates and MovL from the Foundation track.", "zh-Hant": "先理解初階課程中的 TCP 座標及 MovL。" },
    explanation: [
      { en: "The official DobotStudio Pro V2.8.0 MG400 guide documents RelMovL({OffsetX, OffsetY, OffsetZ, OffsetR}); offsets are Cartesian X/Y/Z in millimetres and R in degrees. It also lists CP, SpeedL, AccL, and SYNC options. The native Lua form is a four-value positional table.", "zh-Hant": "DobotStudio Pro V2.8.0 MG400 官方手冊記載 RelMovL({OffsetX, OffsetY, OffsetZ, OffsetR})；偏移量是笛卡兒 X/Y/Z 毫米及 R 角度，亦列出 CP、SpeedL、AccL 及 SYNC 選項。原生 Lua 寫法使用四個依序排列的數值。" },
      { en: "This simulator resolves each offset from the current TCP when the queued action begins, in its base Cartesian frame. Earlier asynchronous motions therefore finish in queue order before the next relative target is calculated. V1 supports CP=0 only; speed and acceleration affect simulated time, not robot dynamics. User/tool frames and physical controller behavior are not verified here.", "zh-Hant": "本模擬器會在佇列中的指令開始執行時，以當刻 TCP 在基座笛卡兒座標系加上偏移量。因此前面的非同步移動會先按佇列完成，再計算下一個相對目標。此版本只支援 CP=0；速度和加速度只改變模擬時間，並非真實機械臂動力學。本處沒有模擬使用者／工具座標系，也沒有驗證實體控制器行為。" },
    ],
    guidedSteps: [
      { en: "Copy the example, then return to the simulator and paste it into the program editor.", "zh-Hant": "複製範例，返回模擬器後貼到程式編輯器。" },
      { en: "Run it after moving to a safe point; watch TCP Z and the run log.", "zh-Hant": "先移至安全教點再執行；觀察 TCP Z 讀數及執行紀錄。" },
      { en: "Change the third offset and predict the new Z before running again.", "zh-Hant": "修改第三個偏移值，先預測新 Z，再重新執行。" },
    ],
    practice: { en: "Move the TCP upward by 20 mm, then sideways by 15 mm in the base frame. Explain why each offset must be evaluated at execution time in a queued program.", "zh-Hant": "先令 TCP 向上移 20 mm，再沿基座座標側移 15 mm。解釋為何佇列程式應在執行當刻計算偏移目標。" },
    examples: {
      lua: "-- Offset order: X, Y, Z (mm), R (degrees)\nRelMovL({0, 0, 20, 0}, {CP=0, SpeedL=50, AccL=20})\nRelMovL({15, 0, 0, 0}, {CP=0})\nSync()",
      python: "# Simulator Python offsets: [x, y, z, r]\nawait rel_mov_l([0, 0, 20, 0], cp=0, speed_l=50, acc_l=20)\nawait rel_mov_l([15, 0, 0, 0], cp=0)\nawait sync()",
    },
    questions: [
      {
        en: "In RelMovL({0, 0, 20, 0}), what does the third value mean?",
        "zh-Hant": "在 RelMovL({0, 0, 20, 0}) 中，第三個值代表甚麼？",
        options: { en: ["Move +20 mm along Cartesian Z", "Move +20 degrees on J3", "Move to absolute Z=20 mm"], "zh-Hant": ["沿笛卡兒 Z 軸正向移動 20 mm", "J3 軸旋轉正 20 度", "移至絕對 Z=20 mm"] },
        answer: 0,
        explanation: { en: "The table holds Cartesian X/Y/Z/R offsets, so the third entry is a relative Z distance in millimetres.", "zh-Hant": "表格包含笛卡兒 X/Y/Z/R 偏移，第三項是以毫米表示的相對 Z 距離。" },
      },
      {
        en: "When does this simulator calculate the destination for a queued RelMovL?",
        "zh-Hant": "本模擬器何時為佇列中的 RelMovL 計算目的地？",
        options: { en: ["When that queued motion begins, from the then-current TCP", "When the editor loads", "From the block centre regardless of robot pose"], "zh-Hant": ["該移動開始執行時，以當刻 TCP 計算", "編輯器載入時", "不論機械臂位置，一律以方塊中心計算"] },
        answer: 0,
        explanation: { en: "Execution-time resolution preserves the intended offset after earlier queued moves have changed the robot pose.", "zh-Hant": "在執行時才計算，可確保前序佇列移動改變姿態後，仍按當刻位置套用偏移。" },
      },
    ],
  },
  {
    id: "intermediate-pick-and-place",
    track: "intermediate",
    durationMinutes: 18,
    evidenceProfile: { en: "Magnet mode · simulator-only logical DO", "zh-Hant": "磁吸模式 · 模擬器邏輯 DO" },
    title: { en: "Pick and place with the magnet", "zh-Hant": "使用磁吸工具取放方塊" },
    outcome: { en: "Order approach, pickup, retreat, placement, and release actions for the 40 × 40 × 15 mm block.", "zh-Hant": "按次序安排接近、取件、撤離、放置及釋放 40 × 40 × 15 mm 方塊。" },
    prerequisite: { en: "Complete the Foundation track and Relative linear motion.", "zh-Hant": "先完成初階課程及「RelMovL 相對直線移動」。" },
    explanation: [
      { en: "In Magnet mode, approach above the part, descend linearly, use DO1 to attach, retreat, travel to the destination, descend, use DO1 to release, and retract.", "zh-Hant": "磁吸模式會先移至工件上方，再直線下降、用 DO1 附上方塊、撤離、移至目的地、下降、用 DO1 釋放，最後退回。" },
      { en: "Here DO(1, ON) and DO(1, OFF) map to the simulator's logical magnet attach/release actions. The 3D block follows the configured TCP transform; this is not force, vacuum, contact, or grasp physics.", "zh-Hant": "此模擬器把 DO(1, ON) 及 DO(1, OFF) 映射成磁吸工具的邏輯附上／釋放動作。3D 方塊會跟隨設定的 TCP 變換，並非力度、真空、接觸或抓取物理模擬。" },
    ],
    guidedSteps: [
      { en: "Select Magnet pickup, then use Teach pick pair and Teach place pair to create the contact and approach points.", "zh-Hant": "選擇 「磁吸拾取」，再按 「示教拾取點組」 及 「示教放置點組」 建立接觸點及接近點。" },
      { en: "Keep the descent and retreat as MovL. Use DO(1, ON) only after reaching the magnet contact point; release with DO(1, OFF) at the place point.", "zh-Hant": "以 MovL 作下降及撤離。到達磁吸接觸點後才執行 DO(1, ON)；到達放置點後用 DO(1, OFF) 釋放。" },
      { en: "Run the reference program and inspect the success messages in Run log.", "zh-Hant": "執行示範程式，並在 「執行記錄」 查看成功訊息。" },
    ],
    practice: { en: "Move the drop point, regenerate its taught pair, then describe which action actually attaches the block and which merely moves it.", "zh-Hant": "移動放置位置、重新教出放置點組合，再說明哪個指令會附上方塊，哪些指令只負責移動。" },
    examples: {
      lua: "MovJ(PickApproach, {CP=0})\nMovL(PickPoint, {CP=0})\nDO(1, ON)\nRelMovL({0, 0, 80, 0}, {CP=0})\nMovJ(PlaceApproach, {CP=0})\nMovL(PlacePoint, {CP=0})\nDO(1, OFF)\nSync()",
      python: "await mov_j(PickApproach, cp=0)\nawait mov_l(PickPoint, cp=0)\ndo(1, ON)\nawait rel_mov_l([0, 0, 80, 0], cp=0)\nawait mov_j(PlaceApproach, cp=0)\nawait mov_l(PlacePoint, cp=0)\ndo(1, OFF)\nawait sync()",
    },
    questions: [
      {
        en: "Does this simulator animate gripper fingers when DO(1, ON) runs?",
        "zh-Hant": "執行 DO(1, ON) 時，模擬器會否顯示夾爪手指開合？",
        options: { en: ["No. It logically attaches the block when the TCP is in the pickup zone", "Yes, it animates a vacuum cup", "It connects to the real tool IO"], "zh-Hant": ["不會。TCP 位於取件範圍時，它會以邏輯方式附上方塊", "會，並會播放吸盤動畫", "會連接實體工具 IO"] },
        answer: 0,
        explanation: { en: "The implemented workpiece operation is logical attachment only, with a geometric pickup-zone check and no hardware path.", "zh-Hant": "目前是經幾何取件範圍檢查後，以邏輯方式附上工件，沒有硬件連線。" },
      },
      {
        en: "What is a useful reason to use a taught approach point above the block?",
        "zh-Hant": "在方塊上方教一個接近點，有甚麼好處？",
        options: { en: ["It separates safe travel from the final linear pickup", "It makes CP blending physically accurate", "It changes the block dimensions"], "zh-Hant": ["把上方移動與最後直線取件分開", "令 CP 混合變成真實物理模擬", "改變方塊尺寸"] },
        answer: 0,
        explanation: { en: "The approach waypoint provides a clear sequence: travel above the part, then make a short linear descent.", "zh-Hant": "接近點讓流程清晰：先移至工件上方，再作短距離直線下降。" },
      },
    ],
  },
  {
    id: "intermediate-rotate-carried-block",
    track: "intermediate",
    durationMinutes: 15,
    evidenceProfile: { en: "Magnet mode · simulated carried-block R-axis turn", "zh-Hant": "磁吸模式 · 模擬攜件 R 軸旋轉" },
    title: { en: "Pick first, then rotate the carried block 90°", "zh-Hant": "先取件，再把攜帶中的方塊旋轉 90°" },
    outcome: { en: "Pick the square block, lift it safely, rotate the wrist/tool and carried block by +90°, then place it in the rotated orientation.", "zh-Hant": "先拾起正方形方塊並安全抬高，再把手腕／工具及攜帶中的方塊轉 +90°，最後以旋轉後的方向放下。" },
    prerequisite: { en: "Complete the magnet pick-and-place lesson and Relative linear motion.", "zh-Hant": "先完成磁吸取放課及「RelMovL 相對直線移動」。" },
    explanation: [
      { en: "The block stays 40 × 40 × 15 mm. A dark arrow on its top and side faces points along the block's local +X direction, so you can see the quarter-turn even though the square outline looks the same.", "zh-Hant": "方塊尺寸保持 40 × 40 × 15 mm。頂面及側面的深色箭嘴指向方塊本身的 +X 方向；即使正方形外框看起來一樣，你仍能看見它轉了四分之一圈。" },
      { en: "The order matters: move down, use DO(1, ON) to attach the block in this simulator, lift 80 mm in base-frame +Z, and only then command a +90° R-axis turn. The attached block inherits the animated flange/tool transform and turns with the wrist.", "zh-Hant": "次序很重要：先向下移動，在本模擬器用 DO(1, ON) 附上方塊，沿基座座標 +Z 抬高 80 mm，然後才命令 R 軸轉 +90°。已附上的方塊會跟隨動畫中的 flange／工具變換，與手腕一同轉動。" },
      { en: "The zero-X/Y/Z RelMovL changes R while holding the TCP position at the safe height. The example makes copies of the taught place points with R increased by 90°, so the robot carries that orientation to the destination without changing the original saved points.", "zh-Hant": "X、Y、Z 為零的 RelMovL 會在安全高度維持 TCP 位置並改變 R。範例會複製已教的放置點並把 R 加 90°，讓機械臂把該方向帶到目的地，同時不修改原有教點。" },
      { en: "This is a software simulation rule: the block is rigidly attached in the scene. It does not calculate magnetic force, slipping, collisions, or a real robot's tool calibration.", "zh-Hant": "這是軟件模擬規則：場景中的方塊會以剛性方式附在工具上。本模擬不計算磁力、滑動、碰撞或實體機械臂的工具校準。" },
    ],
    guidedSteps: [
      { en: "Select Magnet pickup and confirm that PickPoint/PickApproach and PlacePoint/PlaceApproach are taught for the current cell.", "zh-Hant": "選擇 「磁吸拾取」，並確認 PickPoint／PickApproach 及 PlacePoint／PlaceApproach 已按目前工作站教好。" },
      { en: "Load the example for the selected language. Read it from top to bottom: the block attaches first, then rises, then the tool turns +90° while carrying the block.", "zh-Hant": "載入所選語言的範例，由上而下閱讀：先附上方塊，再抬高，然後才攜帶方塊把工具轉 +90°。" },
      { en: "Run the simulation and watch the dark arrow. It should turn while the block is attached, remain turned on the travel to PlacePoint, and stop changing when DO1 releases the block.", "zh-Hant": "執行模擬並觀察深色箭嘴。方塊附在工具上時箭嘴應隨工具旋轉；移往 PlacePoint 時保持轉後方向；DO1 釋放後則不再跟隨手腕改變。" },
    ],
    practice: { en: "Change the R offset from 90° to 45°, predict how the arrow will point, then restore +90° and explain why the lift comes before the turn.", "zh-Hant": "把 R 偏移由 90° 改成 45°，先預測箭嘴方向，再還原 +90°，並解釋為何要先抬高才旋轉。" },
    examples: {
      lua: "-- The block arrow points along its local +X direction.\nMovJ(PickApproach, {CP=0})\nMovL(PickPoint, {CP=0})\nDO(1, ON)\nRelMovL({0, 0, 80, 0}, {CP=0}) -- lift in base-frame +Z\nRelMovL({0, 0, 0, 90}, {CP=0}) -- turn wrist +90 while holding the block\nlocal RotatedPlaceApproach = { coordinate = { x=PlaceApproach.coordinate.x, y=PlaceApproach.coordinate.y, z=PlaceApproach.coordinate.z, r=PlaceApproach.coordinate.r + 90 } }\nlocal RotatedPlacePoint = { coordinate = { x=PlacePoint.coordinate.x, y=PlacePoint.coordinate.y, z=PlacePoint.coordinate.z, r=PlacePoint.coordinate.r + 90 } }\nMovJ(RotatedPlaceApproach, {CP=0})\nMovL(RotatedPlacePoint, {CP=0})\nDO(1, OFF)\nSync()",
      python: "# The block arrow points along its local +X direction.\nawait mov_j(PickApproach, cp=0)\nawait mov_l(PickPoint, cp=0)\ndo(1, ON)\nawait rel_mov_l([0, 0, 80, 0], cp=0)  # lift in base-frame +Z\nawait rel_mov_l([0, 0, 0, 90], cp=0)  # turn wrist +90 while holding the block\nRotatedPlaceApproach = {\"coordinate\": {\"x\": PlaceApproach[\"coordinate\"][\"x\"], \"y\": PlaceApproach[\"coordinate\"][\"y\"], \"z\": PlaceApproach[\"coordinate\"][\"z\"], \"r\": PlaceApproach[\"coordinate\"][\"r\"] + 90}}\nRotatedPlacePoint = {\"coordinate\": {\"x\": PlacePoint[\"coordinate\"][\"x\"], \"y\": PlacePoint[\"coordinate\"][\"y\"], \"z\": PlacePoint[\"coordinate\"][\"z\"], \"r\": PlacePoint[\"coordinate\"][\"r\"] + 90}}\nawait mov_j(RotatedPlaceApproach, cp=0)\nawait mov_l(RotatedPlacePoint, cp=0)\ndo(1, OFF)\nawait sync()",
    },
    questions: [
      {
        en: "When does the wrist turn +90° in this task?",
        "zh-Hant": "本任務的手腕何時轉 +90°？",
        options: { en: ["After the magnet attaches the block and it has been lifted to safe height", "Before moving to PickPoint", "After DO1 releases the block"], "zh-Hant": ["磁吸工具附上方塊並抬至安全高度之後", "移到 PickPoint 之前", "DO1 釋放方塊之後"] },
        answer: 0,
        explanation: { en: "The block must already be attached before the wrist turns, and it is lifted clear before changing R.", "zh-Hant": "手腕旋轉前必須先附上方塊，並先抬高離開工作面才改變 R。" },
      },
      {
        en: "What does the dark arrow on the block show?",
        "zh-Hant": "方塊上的深色箭嘴代表甚麼？",
        options: { en: ["The block's local +X direction", "The robot's home position", "A color sensor's reading"], "zh-Hant": ["方塊本身的 +X 方向", "機械臂的 Home 位置", "顏色感測器的讀數"] },
        answer: 0,
        explanation: { en: "The arrow is a visual orientation mark; the simulator does not include a color sensor.", "zh-Hant": "箭嘴是顯示方向的標記；模擬器沒有顏色感測器。" },
      },
    ],
  },
  {
    id: "intermediate-three-layer-tower",
    track: "intermediate",
    durationMinutes: 20,
    evidenceProfile: { en: "Magnet mode · deterministic three-layer tower", "zh-Hant": "磁吸模式 · 確定性三層方塊塔" },
    title: { en: "Build a three-layer rotated tower", "zh-Hant": "建立三層旋轉方塊塔" },
    outcome: { en: "Repeat a finite pick, lift, +90° rotate, and release cycle for three 40 × 40 × 15 mm blocks.", "zh-Hant": "以有限次循環為三個 40 × 40 × 15 mm 方塊重複取件、抬高、+90° 旋轉及釋放流程。" },
    prerequisite: { en: "Complete Pick first, then rotate the carried block 90°.", "zh-Hant": "先完成「先取件，再把攜帶中的方塊旋轉 90°」。" },
    explanation: [
      { en: "Each loop picks one source block, lifts it clear, turns the attached tool and arrow by +90°, then releases at the tower zone. The simulator assigns successive releases to layers 0, 1, and 2 using the 15 mm block thickness.", "zh-Hant": "每次循環取一個來源方塊、抬高離開工作面、把已附上的工具及箭嘴轉 +90°，再於方塔區釋放。模擬器按 15 mm 方塊厚度，把連續釋放分配到第 0、1、2 層。" },
      { en: "This is a deterministic scene rule for training. It does not simulate collision, contact, magnetic force, or physical tower stability.", "zh-Hant": "這是教學用的確定性場景規則，不會模擬碰撞、接觸、磁力或實體方塔穩定性。" },
    ],
    guidedSteps: [
      { en: "Configure three pickup blocks and teach PickPoint, PlaceApproach, and PlacePoint at the tower zone.", "zh-Hant": "設定三個取件方塊，並在方塔區教 PickPoint、PlaceApproach 及 PlacePoint。" },
      { en: "Load the finite-loop example and verify DO1 turns on only after the descent and off after each release.", "zh-Hant": "載入有限循環範例，確認 DO1 只在下降後開啟，並在每次釋放後關閉。" },
      { en: "Run and watch each arrow rotate while attached; Reset robot restores the source arrangement.", "zh-Hant": "執行並觀察每支箭嘴在附著期間旋轉；「重設機械臂」 會還原來源排列。" },
    ],
    practice: { en: "Change the loop count to two, predict the highest layer, then restore three.", "zh-Hant": "把循環次數改為兩次，預測最高層，再還原為三次。" },
    examples: {
      lua: "-- Three explicit cycles use the configured accessible tower pickup coordinates.\nlocal RotatedPlaceApproach = { coordinate = { x=PlaceApproach.coordinate.x, y=PlaceApproach.coordinate.y, z=PlaceApproach.coordinate.z, r=PlaceApproach.coordinate.r + 90 } }\nlocal RotatedPlacePoint = { coordinate = { x=PlacePoint.coordinate.x, y=PlacePoint.coordinate.y, z=PlacePoint.coordinate.z, r=PlacePoint.coordinate.r + 90 } }\nMovJ({ coordinate = { x=300, y=-80, z=15, r=0 } }, {CP=0, SYNC=1})\nDO(1, ON)\nRelMovL({0, 0, 80, 0}, {CP=0, SYNC=1})\nRelMovL({0, 0, 0, 90}, {CP=0, SYNC=1})\nMovJ(RotatedPlaceApproach, {CP=0, SYNC=1})\nMovL(RotatedPlacePoint, {CP=0, SYNC=1})\nDO(1, OFF)\nSync()\nMovJ({ coordinate = { x=340, y=-80, z=15, r=0 } }, {CP=0, SYNC=1})\nDO(1, ON)\nRelMovL({0, 0, 80, 0}, {CP=0, SYNC=1})\nRelMovL({0, 0, 0, 90}, {CP=0, SYNC=1})\nMovJ(RotatedPlaceApproach, {CP=0, SYNC=1})\nMovL(RotatedPlacePoint, {CP=0, SYNC=1})\nDO(1, OFF)\nSync()\nMovJ({ coordinate = { x=360, y=-80, z=15, r=0 } }, {CP=0, SYNC=1})\nDO(1, ON)\nRelMovL({0, 0, 80, 0}, {CP=0, SYNC=1})\nRelMovL({0, 0, 0, 90}, {CP=0, SYNC=1})\nMovJ(RotatedPlaceApproach, {CP=0, SYNC=1})\nMovL(RotatedPlacePoint, {CP=0, SYNC=1})\nDO(1, OFF)\nSync()",
      python: "# Three explicit cycles use the configured accessible tower pickup coordinates.\nRotatedPlaceApproach = {\"coordinate\": {\"x\": PlaceApproach[\"coordinate\"][\"x\"], \"y\": PlaceApproach[\"coordinate\"][\"y\"], \"z\": PlaceApproach[\"coordinate\"][\"z\"], \"r\": PlaceApproach[\"coordinate\"][\"r\"] + 90}}\nRotatedPlacePoint = {\"coordinate\": {\"x\": PlacePoint[\"coordinate\"][\"x\"], \"y\": PlacePoint[\"coordinate\"][\"y\"], \"z\": PlacePoint[\"coordinate\"][\"z\"], \"r\": PlacePoint[\"coordinate\"][\"r\"] + 90}}\nawait mov_j({\"coordinate\": {\"x\": 300, \"y\": -80, \"z\": 15, \"r\": 0}}, cp=0)\ndo(1, ON)\nawait rel_mov_l([0, 0, 80, 0], cp=0)\nawait rel_mov_l([0, 0, 0, 90], cp=0)\nawait mov_j(RotatedPlaceApproach, cp=0)\nawait mov_l(RotatedPlacePoint, cp=0)\ndo(1, OFF)\nawait sync()\nawait mov_j({\"coordinate\": {\"x\": 340, \"y\": -80, \"z\": 15, \"r\": 0}}, cp=0)\ndo(1, ON)\nawait rel_mov_l([0, 0, 80, 0], cp=0)\nawait rel_mov_l([0, 0, 0, 90], cp=0)\nawait mov_j(RotatedPlaceApproach, cp=0)\nawait mov_l(RotatedPlacePoint, cp=0)\ndo(1, OFF)\nawait sync()\nawait mov_j({\"coordinate\": {\"x\": 360, \"y\": -80, \"z\": 15, \"r\": 0}}, cp=0)\ndo(1, ON)\nawait rel_mov_l([0, 0, 80, 0], cp=0)\nawait rel_mov_l([0, 0, 0, 90], cp=0)\nawait mov_j(RotatedPlaceApproach, cp=0)\nawait mov_l(RotatedPlacePoint, cp=0)\ndo(1, OFF)\nawait sync()",
    },
    questions: [{
      en: "Why does the lift happen before the +90° turn?",
      "zh-Hant": "為甚麼要先抬高才轉 +90°？",
      options: { en: ["It keeps the carried block at the deterministic safe height before the turn", "It activates a physical force sensor", "It changes the block thickness"], "zh-Hant": ["先把攜件帶到模擬的安全高度再旋轉", "啟動實體力度感測器", "改變方塊厚度"] },
      answer: 0,
      explanation: { en: "The simulator requires the visible lift-before-turn sequence; it is a training rule, not a physical contact proof.", "zh-Hant": "模擬器要求可見的先抬高後旋轉次序；這是教學規則，不是實體接觸證明。" },
    }],
  },
  {
    id: "intermediate-black-white-sort",
    track: "intermediate",
    durationMinutes: 20,
    evidenceProfile: { en: "Magnet mode · ordered parity sorter and unload", "zh-Hant": "磁吸模式 · 有序奇偶分類及卸載" },
    title: { en: "Sort black and white blocks by parity", "zh-Hant": "按奇偶次序分類黑白方塊" },
    outcome: { en: "Use the disclosed feeder order, route odd/even items to black/white bins, rotate white blocks +45° while held, then unload every sorted block.", "zh-Hant": "使用已披露的供料次序，按奇偶次序把方塊送往黑／白箱，白色方塊附著時旋轉 +45°，最後卸載全部已分類方塊。" },
    prerequisite: { en: "Complete the three-layer tower lesson and review if/else and loops.", "zh-Hant": "先完成三層方塔課，並重溫 if/else 及循環。" },
    explanation: [
      { en: "The cell shows a deterministic feeder order (black, white, black, white). The program uses the item index and modulo parity to choose bins; it does not read a color sensor.", "zh-Hant": "工作站會顯示確定性的供料次序（黑、白、黑、白）。程式使用項目索引及 modulo 奇偶來選擇箱，不會讀取顏色感測器。" },
      { en: "Every DO1 ON follows pickup alignment and every white turn follows the safe lift. After sorting, the unload pass picks stored output blocks and places them in the unload zone.", "zh-Hant": "每次 DO1 ON 都在對準取件後執行，白色旋轉必須在安全抬高後執行。分類後，卸載流程會拾取已存放的輸出方塊並放到卸載區。" },
    ],
    guidedSteps: [
      { en: "Read Feeder order in Tool & pickup and keep four feeder blocks configured as black → white → black → white.", "zh-Hant": "閱讀 「工具與取件」 的 Feeder order，並保持四個供料方塊為黑 → 白 → 黑 → 白。" },
      { en: "Use index % 2 to select the black or white bin; rotate only the white branch after lifting the attached block.", "zh-Hant": "用 index % 2 選擇黑箱或白箱；只在附著方塊抬高後於白色分支旋轉。" },
      { en: "Run the unload pass and Reset robot to restore all four feeder blocks.", "zh-Hant": "執行卸載流程，再按 「重設機械臂」 還原四個供料方塊。" },
    ],
    practice: { en: "Swap the two bin coordinates and predict the final positions without changing the feeder order.", "zh-Hant": "交換兩個箱的座標，預測最終位置而不改變供料次序。" },
    examples: {
      lua: "-- Feeder order is disclosed: black, white, black, white.\nlocal BlackBin = { coordinate = { x=320, y=80, z=15, r=0 } }\nlocal WhiteBin = { coordinate = { x=340, y=80, z=15, r=0 } }\nlocal Unload = { coordinate = { x=300, y=180, z=15, r=0 } }\nlocal function sortOne(x, y, white, bin)\n  MovJ({ coordinate = { x=x, y=y, z=15, r=0 } }, {CP=0, SYNC=1})\n  DO(1, ON)\n  RelMovL({0, 0, 80, 0}, {CP=0, SYNC=1})\n  if white then RelMovL({0, 0, 0, 45}, {CP=0, SYNC=1}) end\n  MovJ(bin, {CP=0, SYNC=1})\n  MovL(bin, {CP=0, SYNC=1})\n  DO(1, OFF)\n  Sync()\nend\nsortOne(300, -180, false, BlackBin)\nsortOne(310, -180, true, WhiteBin)\nsortOne(320, -180, false, BlackBin)\nsortOne(315, -180, true, WhiteBin)\nlocal function unloadOne(bin)\n  MovJ(bin, {CP=0, SYNC=1})\n  DO(1, ON)\n  RelMovL({0, 0, 80, 0}, {CP=0, SYNC=1})\n  MovJ(Unload, {CP=0, SYNC=1})\n  MovL(Unload, {CP=0, SYNC=1})\n  DO(1, OFF)\n  Sync()\nend\nunloadOne(BlackBin)\nunloadOne(WhiteBin)\nunloadOne(BlackBin)\nunloadOne(WhiteBin)",
      python: "# Feeder order is disclosed: black, white, black, white.\nBlackBin = {\"coordinate\": {\"x\": 320, \"y\": 80, \"z\": 15, \"r\": 0}}\nWhiteBin = {\"coordinate\": {\"x\": 340, \"y\": 80, \"z\": 15, \"r\": 0}}\nUnload = {\"coordinate\": {\"x\": 300, \"y\": 180, \"z\": 15, \"r\": 0}}\nasync def sort_one(x, y, white, bin):\n    await mov_j({\"coordinate\": {\"x\": x, \"y\": y, \"z\": 15, \"r\": 0}}, cp=0)\n    do(1, ON)\n    await rel_mov_l([0, 0, 80, 0], cp=0)\n    if white: await rel_mov_l([0, 0, 0, 45], cp=0)\n    await mov_j(bin, cp=0)\n    await mov_l(bin, cp=0)\n    do(1, OFF)\n    await sync()\nawait sort_one(300, -180, False, BlackBin)\nawait sort_one(310, -180, True, WhiteBin)\nawait sort_one(320, -180, False, BlackBin)\nawait sort_one(315, -180, True, WhiteBin)\nasync def unload_one(bin):\n    await mov_j(bin, cp=0)\n    do(1, ON)\n    await rel_mov_l([0, 0, 80, 0], cp=0)\n    await mov_j(Unload, cp=0)\n    await mov_l(Unload, cp=0)\n    do(1, OFF)\n    await sync()\nawait unload_one(BlackBin)\nawait unload_one(WhiteBin)\nawait unload_one(BlackBin)\nawait unload_one(WhiteBin)",
    },
    questions: [{
      en: "What decides the bin in this lesson?",
      "zh-Hant": "本課由甚麼決定方塊箱？",
      options: { en: ["The disclosed feeder index and modulo parity", "A camera color sensor", "A random choice"], "zh-Hant": ["已披露的供料索引及 modulo 奇偶", "相機顏色感測器", "隨機選擇"] },
      answer: 0,
      explanation: { en: "This simulator uses configured order and program branching; it makes no color-sensing claim.", "zh-Hant": "本模擬器使用已設定次序及程式分支，沒有顏色感測器能力聲稱。" },
    }],
  },
  {
    id: "intermediate-passive-fork",
    track: "intermediate",
    durationMinutes: 15,
    evidenceProfile: { en: "Fork mode · passive insertion and lift logic", "zh-Hant": "叉臂模式 · 被動插入及抬升邏輯" },
    title: { en: "Pick and place with the unpowered fork", "zh-Hant": "使用無動力叉臂取放方塊" },
    outcome: { en: "Pick up and release the 40 × 40 × 15 mm block by sliding the passive fork beneath it and lifting, without digital output commands.", "zh-Hant": "以被動叉臂滑入 40 × 40 × 15 mm 方塊下方並抬起取件，再下降釋放，全程毋須數碼輸出指令。" },
    prerequisite: { en: "Complete the Foundation track and Relative linear motion.", "zh-Hant": "先完成初階課程及「RelMovL 相對直線移動」。" },
    explanation: [
      { en: `The fork is unpowered. The 40 × 40 × 15 mm reference block sits at Z=${FORK_SUPPORT_HEIGHT_MM} mm on three visible pads so the fork can enter beneath it. Approach from outside, slide under, and lift. The simulator attaches the block when it detects that insertion-and-lift sequence.`, "zh-Hant": `叉臂沒有動力。40 × 40 × 15 mm 示範方塊由三個可見承托墊架高至 Z=${FORK_SUPPORT_HEIGHT_MM} mm，留出叉臂插入空間。由外側接近、滑入方塊下方，再向上抬起；模擬器偵測到這個次序才會附上方塊。` },
      { en: "Lowering the supported block back onto the three pads at the drop zone releases it. DO1 is an ordinary virtual output and does not control the fork or the block.", "zh-Hant": "在放置區把方塊降回三個承托墊便會釋放。DO1 只是一般虛擬輸出，不會控制叉臂或方塊。" },
    ],
    guidedSteps: [
      { en: `Select Fork pickup. Teach PickPoint at the block centre on the ${FORK_SUPPORT_HEIGHT_MM} mm support plane, then teach PickApproach 60 mm before it along tool -X at the same height.`, "zh-Hant": `選擇 「叉臂拾取」。在方塊承托面 Z=${FORK_SUPPORT_HEIGHT_MM} mm 教 PickPoint，再沿工具 -X 方向、同一高度、於其前方 60 mm 教 PickApproach。` },
      { en: "Use MovL from PickApproach to PickPoint to slide beneath the block. Then lift in +Z; the fork picks the block automatically.", "zh-Hant": "用 MovL 從 PickApproach 水平滑至 PickPoint，再沿 +Z 抬起；叉臂會自動拾起方塊。" },
      { en: "Move to PlaceApproach, lower with MovL until the block rests on the support pads, then lift clear. Watch it release without any DO command.", "zh-Hant": "移至 PlaceApproach，再用 MovL 降至方塊放回承托墊的位置，然後向上離開；觀察方塊在沒有任何 DO 指令下釋放。" },
    ],
    practice: { en: "Change the block or drop location and re-teach the pair. Predict which motion creates insertion, which motion picks the block up, and which motion releases it.", "zh-Hant": "改變方塊或放置位置後重新教點。預測哪段移動會插入叉臂、哪段會拾起方塊，以及哪段會釋放方塊。" },
    examples: {
      lua: "JointMovJ(Home, {CP=0})\nMovJ(PickApproach, {CP=0})\nMovL(PickPoint, {CP=0}) -- slide under the block\nRelMovL({0, 0, 80, 0}, {CP=0}) -- X, Y, Z mm; R degrees; lift to pick, no DO\nMovJ(PlaceApproach, {CP=0})\nMovL(PlacePoint, {CP=0}) -- lower to release\nMovL(PlaceApproach, {CP=0})\nJointMovJ(Home, {CP=0})\nSync()",
      python: "await joint_mov_j(Home, cp=0)\nawait mov_j(PickApproach, cp=0)\nawait mov_l(PickPoint, cp=0)  # slide under the block\nawait rel_mov_l([0, 0, 80, 0], cp=0)  # lift to pick; no DO\nawait mov_j(PlaceApproach, cp=0)\nawait mov_l(PlacePoint, cp=0)  # lower to release\nawait mov_l(PlaceApproach, cp=0)\nawait joint_mov_j(Home, cp=0)\nawait sync()",
    },
    questions: [
      {
        en: "What makes the unpowered fork pick up the block in this simulator?",
        "zh-Hant": "在本模擬器中，無動力叉臂如何拾起方塊？",
        options: {
          en: [`Slide beneath it at Z=${FORK_SUPPORT_HEIGHT_MM} mm, then lift`, "Turn DO1 on", "Move vertically down from above"],
          "zh-Hant": [`在 Z=${FORK_SUPPORT_HEIGHT_MM} mm 滑入方塊下方，再向上抬起`, "開啟 DO1", "從上方垂直向下移動"],
        },
        answer: 0,
        explanation: { en: "The passive tool has no actuator. The simulator recognizes entry from outside at the fork support plane followed by an upward lift.", "zh-Hant": "被動工具沒有致動器。模擬器會識別叉臂在承托高度由外側滑入，再向上抬起的動作。" },
      },
      {
        en: "When does the fork release the supported block?",
        "zh-Hant": "叉臂何時釋放托住的方塊？",
        options: {
          en: ["When it is lowered onto the support pads at the drop zone", "When DO1 turns off", "After a fixed Wait(150)"],
          "zh-Hant": ["在放置區下降到承托墊上", "DO1 關閉時", "固定 Wait(150) 之後"],
        },
        answer: 0,
        explanation: { en: "Placement is driven by lowering the carried block onto its support pads; the fork has no powered release command.", "zh-Hant": "放置是靠把方塊降回承托墊；叉臂沒有電動釋放指令。" },
      },
    ],
  },
  {
    id: "advanced-queues-and-synchronization",
    track: "advanced",
    durationMinutes: 18,
    evidenceProfile: { en: "Pro V2.8 documented subset · worker queue behavior simulated", "zh-Hant": "Pro V2.8 已記錄指令子集 · worker 佇列行為屬模擬" },
    title: { en: "Queued motion, SYNC, and timing", "zh-Hant": "移動佇列、SYNC 與時間" },
    outcome: { en: "Reason about asynchronous move delivery, SYNC=1, Sync(), Wait(), and Sleep() in this simulator.", "zh-Hant": "理解本模擬器中的非同步移動、SYNC=1、Sync()、Wait() 及 Sleep()。" },
    prerequisite: { en: "Complete the Intermediate track.", "zh-Hant": "先完成中階課程。" },
    explanation: [
      { en: "Motion commands are asynchronous by default in the documented subset. SYNC=1 waits for that motion. Sync() waits until queued simulator actions are idle. These details are useful for reasoning about command order.", "zh-Hant": "已記錄的指令子集中，移動指令預設為非同步；SYNC=1 會等待該移動完成。Sync() 會等模擬器動作佇列清空。這些概念有助分析指令次序。" },
      { en: "In this simulator, Wait(ms) waits for queued motion, then delays the next Lua statement. Sleep(ms) delays Lua execution while queued motion may continue. Milliseconds and movement duration are simulated, not controller timing guarantees.", "zh-Hant": "本模擬器中，Wait(ms) 會先等佇列移動完成，再延遲下一行 Lua；Sleep(ms) 延遲 Lua 執行時，佇列移動仍可能繼續。毫秒等待及移動時間都屬模擬，不是控制器的時序保證。" },
    ],
    guidedSteps: [
      { en: "Run the example and observe when its final print appears.", "zh-Hant": "執行範例，觀察最後的 print 何時出現。" },
      { en: "Change SYNC=0 to SYNC=1 on the first move and compare the ordering.", "zh-Hant": "把第一個移動的 SYNC=0 改為 SYNC=1，觀察指令次序變化。" },
      { en: "Pause, resume, and stop a longer move to see the simulator's queue controls.", "zh-Hant": "對較長移動嘗試暫停、繼續及停止，了解模擬器佇列控制。" },
    ],
    practice: { en: "Place a print after two asynchronous moves and then after Sync(). Predict which print should wait for the motion queue to empty.", "zh-Hant": "在兩個非同步移動後，以及 Sync() 後各放一個 print。預測哪個 print 會等到佇列清空才執行。" },
    examples: {
      lua: "MovJ(PickApproach, {CP=0, SYNC=0})\nMovL(PickPoint, {CP=0, SYNC=0})\nSync()\nprint('Queue is idle')",
      python: "# Await the queue calls; sync=False lets them overlap queued execution\nawait mov_j(PickApproach, cp=0, sync=False)\nawait mov_l(PickPoint, cp=0, sync=False)\nawait sync()\nprint('Queue is idle')",
    },
    questions: [
      {
        en: "What does Sync() do in this simulator?",
        "zh-Hant": "本模擬器中的 Sync() 會做甚麼？",
        options: { en: ["Wait until queued simulator actions are idle", "Reset all teach points", "Change to an absolute coordinate frame"], "zh-Hant": ["等候模擬動作佇列清空", "重設所有教點", "切換至絕對座標系"] },
        answer: 0,
        explanation: { en: "Sync() is the queue barrier in the simulator's supported Lua subset.", "zh-Hant": "Sync() 是此模擬器支援 Lua 子集中的佇列同步點。" },
      },
      {
        en: "Which statement about Sleep() is correct for this implementation?",
        "zh-Hant": "以下哪項符合本模擬器對 Sleep() 的實作？",
        options: { en: ["Lua waits while already queued motion may continue", "It always stops the robot", "It makes acceleration values physically exact"], "zh-Hant": ["Lua 會等待，但已排入佇列的移動仍可能繼續", "它一定會停止機械臂", "它會使加速度數值完全符合實體"] },
        answer: 0,
        explanation: { en: "Sleep() delays Lua without first waiting for the motion queue to become idle; timing is still simulated.", "zh-Hant": "Sleep() 延遲 Lua 執行，但不會先等移動佇列清空；時序仍屬模擬。" },
      },
    ],
  },
  {
    id: "advanced-debugging-and-fidelity",
    track: "advanced",
    durationMinutes: 20,
    evidenceProfile: { en: `Simulator boundaries · curriculum ${CURRICULUM_VERSION}`, "zh-Hant": `模擬器界線 · 課程 ${CURRICULUM_VERSION}` },
    title: { en: "Debugging and knowing the boundary", "zh-Hant": "診斷錯誤與理解模擬界線" },
    outcome: { en: "Diagnose common program failures and explain what evidence is still required before physical robot use.", "zh-Hant": "診斷常見程式錯誤，並說明實際操作機械臂前仍欠缺哪些驗證。" },
    prerequisite: { en: "Complete the Foundation and Intermediate tracks, or use them as a review.", "zh-Hant": "完成初階及中階課程，或按需要重溫。" },
    explanation: [
      { en: "A visible error can come from a malformed point, an unsupported option, a target outside the modeled joint/workspace limits, or a pick outside the tolerance zone. Read the first run-log error and fix one cause at a time.", "zh-Hant": "可見錯誤可能源自教點格式不正確、不支援的選項、目標超出模擬關節／工作範圍，或取件位置超出容差。先讀取 「執行記錄」 第一個錯誤，再一次修正一個原因。" },
      { en: "This is a local kinematic training simulator using vendor URDF/STL geometry. It has no physical calibration, accurate dynamics, force/contact sensing, safety-rated collision detection, robot telemetry, or hardware command path. A successful animation does not validate a real cell.", "zh-Hant": "這是以原廠 URDF/STL 幾何建立的本機運動學教學模擬器。它沒有實體校準、精確動力學、力度／接觸感測、具安全認證的碰撞偵測、機械臂遙測或硬件控制路徑。動畫成功不代表實體工作站已驗證。" },
    ],
    guidedSteps: [
      { en: "Temporarily set a point outside the workspace and run it; read the error in Run log.", "zh-Hant": "暫時把教點設到工作範圍以外並執行，在 「執行記錄」 閱讀錯誤。" },
      { en: "Use Stop during motion and confirm the robot holds its current simulated pose.", "zh-Hant": "移動途中按 Stop，確認機械臂維持當前模擬姿態。" },
      { en: "Restore a valid point, run the reference cycle, and export a project copy for your instructor.", "zh-Hant": "還原有效教點、執行示範流程，並匯出專案副本交給導師。" },
    ],
    practice: { en: "Write a three-item commissioning checklist for a real robot that includes TCP measurement, limits/safety review, and a supervised low-speed test. State that this simulator cannot perform those checks.", "zh-Hant": "為實體機械臂寫三項試運行檢查，包括 TCP 測量、限位／安全檢查及監督下低速測試，並註明本模擬器不能代做。" },
    examples: {
      lua: "-- Deliberately invalid: diagnose before restoring a valid point\nMovL({coordinate={x=1200, y=0, z=500, r=0}}, {CP=0})\n-- Use Stop if a run does not behave as expected",
      python: "# Deliberately unreachable: inspect the diagnostic and press Stop if needed\nawait mov_l({\"coordinate\": {\"x\": 1200, \"y\": 0, \"z\": 500, \"r\": 0}}, cp=0)",
    },
    questions: [
      {
        en: "A run-log message says the target is outside the modeled workspace. What is the right first response?",
        "zh-Hant": "「執行記錄」 顯示目標超出模擬工作範圍，第一步應怎樣做？",
        options: { en: ["Inspect the target and joint/TCP setup, then choose a valid modeled point", "Assume the real robot can safely reach it", "Disable all checks and publish the code"], "zh-Hant": ["檢查目標及關節／TCP 設定，再選擇有效模擬點", "假設實體機械臂一定安全可達", "關閉所有檢查並發布程式"] },
        answer: 0,
        explanation: { en: "The error diagnoses this model's reachability; it is not proof about any particular physical robot or installation.", "zh-Hant": "錯誤說明的是這個模型中的可達性，並非任何特定實體機械臂或安裝的安全證明。" },
      },
      {
        en: "Does a successful simulation authorize running the same program on a physical MG400?",
        "zh-Hant": "模擬成功後，是否代表可以把相同程式直接放到實體 MG400 執行？",
        options: { en: ["No. Physical calibration, safety review, and supervised commissioning are still required", "Yes. The simulator is safety-rated", "Yes, because the model has vendor geometry"], "zh-Hant": ["不代表。仍須實體校準、安全檢查及監督下試運行", "可以，模擬器已具安全認證", "可以，因模型採用原廠幾何"] },
        answer: 0,
        explanation: { en: "The product has no hardware control or safety validation; a qualified instructor must validate the real robot and cell independently.", "zh-Hant": "本產品沒有硬件控制或安全驗證；必須由合資格導師獨立驗證實體機械臂及工作站。" },
      },
    ],
  },
];

export const LESSON_BY_ID = new Map(LESSONS.map((lesson) => [lesson.id, lesson]));

export function text(value: LocalizedText, language: CourseLanguage) {
  return value[language];
}
