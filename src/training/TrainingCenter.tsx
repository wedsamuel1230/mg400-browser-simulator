import { useEffect, useMemo, useRef, useState } from "react";
import { BookOpenCheck, Check, ChevronLeft, ChevronRight, Clipboard, X } from "lucide-react";
import { body1ForkProgram, type ForkContactProfile, type ProgramLanguage } from "../domain";
import { CURRICULUM_VERSION, LESSONS, TRACKS, type CourseLanguage, type Lesson } from "./curriculum";
import { loadCourseProgress, saveCourseProgress, type CourseProgress } from "./courseProgress";

type Props = {
  open: boolean;
  programLanguage: ProgramLanguage;
  forkContactProfile?: ForkContactProfile;
  initialLessonId?: string | null;
  onClose: () => void;
  onUseExample: (example: string, language: ProgramLanguage) => void;
};

export function TrainingCenter({ open, programLanguage, forkContactProfile = "reference", initialLessonId, onClose, onUseExample }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [progress, setProgress] = useState<CourseProgress>(() => loadCourseProgress());
  const [lessonId, setLessonId] = useState(progress.lastLessonId);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [feedback, setFeedback] = useState("");
  const [copyError, setCopyError] = useState(false);
  const [confirmExampleReplacement, setConfirmExampleReplacement] = useState(false);
  const [courseLanguage, setCourseLanguage] = useState<CourseLanguage>(progress.language);
  const lesson = useMemo(() => {
    const base = LESSONS.find((item) => item.id === lessonId) ?? LESSONS[0];
    if (base.id !== "intermediate-passive-fork" || forkContactProfile !== "body1") return base;
    return { ...base,
      outcome: { en: "Insert the measured Body1 grooves, lift, release and withdraw without digital output.", "zh-Hant": "沿已量度 Body1 槽插入、抬升、放下及水平退出，全程毋須數碼輸出。" },
      explanation: [{ en: "Body1 is 40×40×40 mm with local-Y grooves at Z15–25. Its bottom rests at Z20. A 5 mm fork plate enters with TCP Z42.5 and supports/releases at Z45. This calibrated contact sequence is not arbitrary STL physics.", "zh-Hant": "Body1 為 40×40×40 mm，槽沿本體 Y 方向、位於 Z15–25。底面放在 Z20；5 mm 叉板於 TCP Z42.5 插入，Z45 承托／釋放。這是指定模型的接觸校準，不是任意 STL 的物理模擬。" }],
      guidedSteps: [
        { en: "Import Body1 and select its measured calibration. Re-teach both pairs: PickPoint Z42.5, PlacePoint Z45; fork R follows block R−90°.", "zh-Hant": "匯入 Body1 並選擇已量度校準，重新示教兩組教點：拾取 Z42.5、放置 Z45；叉臂 R 為方塊 R−90°。" },
        { en: "Slide 60 mm along tool +X into the grooves, then lift to carry.", "zh-Hant": "沿工具 +X 滑入 60 mm，再抬升承托工件。" },
        { en: "Lower to Z45 to release, lower the fork to Z42.5, withdraw 60 mm along tool −X, then lift clear.", "zh-Hant": "降至 Z45 釋放，再把叉臂降至 Z42.5，沿工具 −X 水平退出 60 mm，最後抬高離開。" },
      ], questions: [
        { en: "How does the measured Body1 fork pick up?", "zh-Hant": "已量度 Body1 叉臂如何拾取？",
          options: { en: ["Slide at Z42.5, then lift to Z45", "Slide at Z20", "Turn DO1 on"], "zh-Hant": ["在 Z42.5 沿槽滑入，再抬至 Z45", "在 Z20 滑入", "開啟 DO1"] }, answer: 0,
          explanation: { en: "Z42.5 centres the 5 mm plate in the groove; Z45 contacts its upper surface and supports the workpiece.", "zh-Hant": "Z42.5 令 5 mm 叉板位於槽中間；Z45 接觸槽上表面並承托工件。" } },
        { en: "How does Body1 release and clear the fork?", "zh-Hant": "Body1 如何釋放並退出叉臂？",
          options: { en: ["Release at Z45, lower to Z42.5, withdraw along tool −X60 before lifting", "Lift first, then withdraw", "Turn DO1 off"], "zh-Hant": ["在 Z45 釋放，降至 Z42.5，沿工具 −X 退出60 mm後抬高", "先抬高再退出", "關閉 DO1"] }, answer: 0,
          explanation: { en: "Clearance must be restored at Z42.5 before aligned horizontal withdrawal; lifting while still in the groove is invalid.", "zh-Hant": "須先降回 Z42.5 恢復槽內間隙，再沿槽水平退出；仍在槽內時抬高不是有效退出。" } },
      ], examples: { lua: body1ForkProgram("lua"), python: body1ForkProgram("python") },
    };
  }, [lessonId, forkContactProfile]);
  const track = TRACKS.find((item) => item.id === lesson.track)!;
  const strings = courseLanguage === "en" ? englishUi : chineseUi;
  const completed = new Set(progress.completedLessonIds);
  const allCorrect = lesson.questions.every((question, index) => answers[index] === question.answer);
  const answerCount = Object.keys(answers).length;
  const displayText = (value: { en: string; "zh-Hant": string }) => value[courseLanguage];

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  useEffect(() => {
    if (!open || !initialLessonId) return;
    const initialLesson = LESSONS.find((item) => item.id === initialLessonId);
    if (!initialLesson || initialLesson.id === lessonId) return;
    setLessonId(initialLesson.id);
    setAnswers({});
    setFeedback("");
    setCopyError(false);
    setConfirmExampleReplacement(false);
  }, [open, initialLessonId]);

  useEffect(() => {
    if (!open) setConfirmExampleReplacement(false);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const next = { ...progress, language: courseLanguage, lastLessonId: lessonId };
    setProgress(next);
    saveCourseProgress(next);
  }, [courseLanguage, lessonId, open]);

  function selectLesson(item: Lesson) {
    setLessonId(item.id);
    setAnswers({});
    setFeedback("");
    setCopyError(false);
    setConfirmExampleReplacement(false);
  }

  function submitAssessment() {
    const attempts = (progress.attemptsByLesson[lesson.id] ?? 0) + 1;
    const next = {
      ...progress,
      attemptsByLesson: { ...progress.attemptsByLesson, [lesson.id]: attempts },
      completedLessonIds: allCorrect && !completed.has(lesson.id)
        ? [...progress.completedLessonIds, lesson.id]
        : progress.completedLessonIds,
    };
    setProgress(next);
    saveCourseProgress(next);
    setFeedback(allCorrect ? strings.pass : strings.tryAgain);
  }

  async function copyExample() {
    try {
      await navigator.clipboard.writeText(lesson.examples[programLanguage]);
      setCopyError(false);
      setFeedback(strings.copied);
    } catch {
      setCopyError(true);
      setFeedback(strings.copyFallback);
    }
  }

  function useExample() {
    if (!confirmExampleReplacement) {
      setConfirmExampleReplacement(true);
      return;
    }
    setConfirmExampleReplacement(false);
    onUseExample(lesson.examples[programLanguage], programLanguage);
    onClose();
  }

  const exampleSection = (
    <section className="lesson-code-section">
      <div className="lesson-section-title"><div><h4>{strings.example}</h4><span>{programLanguage === "lua" ? strings.luaSubset : strings.pythonApi}</span></div><button className="training-copy-button" onClick={() => void copyExample()}><Clipboard size={14} />{strings.copy}</button></div>
      <pre className="lesson-code" role="group" tabIndex={copyError ? 0 : undefined} aria-label={`${strings.example} ${programLanguage}`} onClick={(event) => { if (copyError) event.currentTarget.focus(); }}><code>{lesson.examples[programLanguage]}</code></pre>
      {copyError && <p className="training-copy-hint">{strings.copyFallback}</p>}
      <button className="training-use-button" onClick={useExample}>{strings.useExample}</button>
      {confirmExampleReplacement && <div className="training-example-confirmation" role="alert">
        <p>{strings.replaceWarning[programLanguage]}</p>
        <div className="training-example-confirmation-actions">
          <button className="training-example-cancel-button" onClick={() => setConfirmExampleReplacement(false)}>{strings.cancelReplace}</button>
          <button className="training-example-confirm-button" onClick={useExample}>{strings.confirmReplace}</button>
        </div>
      </div>}
    </section>
  );

  return (
    <dialog
      ref={dialogRef}
      className="training-dialog"
      aria-labelledby="training-title"
      aria-label={strings.title}
      onKeyDown={(event) => {
        if (event.key !== "Tab") return;
        const tabbable = [...event.currentTarget.querySelectorAll<HTMLElement>(
          'a[href], button:not(:disabled), input:not(:disabled):not([type="hidden"]), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])',
        )].filter((element) => !element.closest('[hidden], [aria-hidden="true"]'));
        if (tabbable.length === 0) {
          event.preventDefault();
          event.currentTarget.focus();
          return;
        }
        const first = tabbable[0];
        const last = tabbable[tabbable.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }}
      onCancel={(event) => { event.preventDefault(); onClose(); }}
      onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}
    >
      <div className="training-window">
        <header className="training-header">
          <div className="training-heading-icon"><BookOpenCheck size={19} /></div>
          <div className="training-heading-copy"><h2 id="training-title">{strings.title}</h2><p>{strings.subtitle} · {strings.version}</p></div>
          <div className="training-header-actions">
            <div className="training-language-toggle" role="group" aria-label={strings.courseLanguage}>
              <button className={courseLanguage === "en" ? "active" : ""} onClick={() => setCourseLanguage("en")} aria-pressed={courseLanguage === "en"}>EN</button>
              <button className={courseLanguage === "zh-Hant" ? "active" : ""} onClick={() => setCourseLanguage("zh-Hant")} aria-pressed={courseLanguage === "zh-Hant"}>繁中</button>
            </div>
            <button className="training-close" aria-label={strings.close} onClick={onClose}><X size={18} /></button>
          </div>
        </header>

        <div className="training-layout">
          <nav className="training-sidebar" aria-label={strings.lessons}>
            <div className="training-progress"><strong>{completed.size} / {LESSONS.length}</strong><span>{strings.completed}</span><div className="training-progress-track"><span style={{ width: `${(completed.size / LESSONS.length) * 100}%` }} /></div></div>
            {TRACKS.map((item) => {
              const lessons = LESSONS.filter((entry) => entry.track === item.id);
              return <section className="training-track" key={item.id} aria-label={displayText(item.title)}>
                <h3>{displayText(item.title)}</h3>
                <p>{displayText(item.summary)}</p>
                {lessons.map((entry) => <button key={entry.id} className={`training-lesson-link ${entry.id === lesson.id ? "selected" : ""}`} onClick={() => selectLesson(entry)} aria-current={entry.id === lesson.id ? "page" : undefined}>
                  <span className={`lesson-status ${completed.has(entry.id) ? "done" : ""}`}>{completed.has(entry.id) ? <Check size={11} /> : null}</span>
                  <span>{displayText(entry.title)}</span>
                </button>)}
              </section>;
            })}
          </nav>

          <article className="training-content">
            <div className="training-kicker">{displayText(track.title)} <span>·</span> {lesson.durationMinutes} {strings.minutes}</div>
            <h3>{displayText(lesson.title)}</h3>
            <div className="lesson-outcome"><strong>{strings.outcome}</strong><span>{displayText(lesson.outcome)}</span></div>
            {lesson.id === "foundation-first-program" && exampleSection}
            <div className="lesson-context"><span><strong>{strings.prerequisite}</strong> {displayText(lesson.prerequisite)}</span><span><strong>{strings.source}</strong> {displayText(lesson.evidenceProfile)}</span></div>

            <section className="lesson-section"><h4>{strings.explanation}</h4>{lesson.explanation.map((item, index) => <p key={index}>{displayText(item)}</p>)}</section>
            <section className="lesson-section"><h4>{strings.guidedActivity}</h4><ol>{lesson.guidedSteps.map((item, index) => <li key={index}>{displayText(item)}</li>)}</ol></section>
            <section className="lesson-practice"><strong>{strings.practice}</strong><p>{displayText(lesson.practice)}</p></section>

            {lesson.id !== "foundation-first-program" && exampleSection}

            <section className="lesson-assessment">
              <div className="lesson-section-title"><div><h4>{strings.checkLearning}</h4><span>{answerCount} / {lesson.questions.length} {strings.answered}</span></div><span className="attempt-count">{strings.attempts}: {progress.attemptsByLesson[lesson.id] ?? 0}</span></div>
              {lesson.questions.map((question, index) => <fieldset className="assessment-question" key={index}>
                <legend>{index + 1}. {displayText(question)}</legend>
                {question.options[courseLanguage].map((option, optionIndex) => <label className="assessment-option" key={optionIndex}>
                  <input type="radio" name={`${lesson.id}-${index}`} checked={answers[index] === optionIndex} onChange={() => setAnswers((current) => ({ ...current, [index]: optionIndex }))} />
                  <span>{option}</span>
                </label>)}
                {answers[index] !== undefined && <p className={`assessment-explanation ${answers[index] === question.answer ? "correct" : "incorrect"}`}>{displayText(question.explanation)}</p>}
              </fieldset>)}
              <div className="assessment-actions"><button className="training-submit-button" onClick={submitAssessment} disabled={answerCount !== lesson.questions.length}>{strings.checkAnswers}</button>{feedback && <span role="status" className={allCorrect ? "pass-feedback" : "try-feedback"}>{feedback}</span>}</div>
            </section>

            <div className="training-navigation">
              <button onClick={() => { const index = LESSONS.findIndex((item) => item.id === lesson.id); if (index > 0) selectLesson(LESSONS[index - 1]); }} disabled={LESSONS[0].id === lesson.id}><ChevronLeft size={15} />{strings.previous}</button>
              <button onClick={() => { const index = LESSONS.findIndex((item) => item.id === lesson.id); if (index < LESSONS.length - 1) selectLesson(LESSONS[index + 1]); }} disabled={LESSONS[LESSONS.length - 1].id === lesson.id}>{strings.next}<ChevronRight size={15} /></button>
            </div>
          </article>
        </div>
      </div>
    </dialog>
  );
}

const englishUi = {
  title: "Training center", subtitle: "MG400 virtual lab", version: `Curriculum ${CURRICULUM_VERSION}`, close: "Close training center",
  courseLanguage: "Course language", lessons: "Lessons", completed: "lessons completed", minutes: "min",
  outcome: "Learning outcome", prerequisite: "Prerequisite:", source: "Reference:", explanation: "What you need to know",
  guidedActivity: "Try it in the simulator", practice: "Practice task", example: "Code example", luaSubset: "Lua · simulator subset",
  pythonApi: "Python · simulator-only", copy: "Copy", copied: "Example copied. Paste it into the program editor when you are ready.",
  copyFallback: "Clipboard access is unavailable. Select the code below and copy it manually.", useExample: "Load this example…",
  replaceWarning: { lua: "This replaces your current Lua program. Copy or export it first if you need to keep it.", python: "This replaces your current Python program. Copy or export it first if you need to keep it." },
  cancelReplace: "Keep current code", confirmReplace: "Replace current program",
  checkLearning: "Check your learning", answered: "answered", attempts: "Attempts", checkAnswers: "Check answers",
  pass: "All correct. Lesson complete.", tryAgain: "Review the explanations, then try again.", previous: "Previous lesson", next: "Next lesson",
};

const chineseUi = {
  title: "訓練中心", subtitle: "MG400 虛擬實驗室", version: `課程 ${CURRICULUM_VERSION}`, close: "關閉訓練中心",
  courseLanguage: "課程語言", lessons: "課程列表", completed: "課已完成", minutes: "分鐘",
  outcome: "學習目標", prerequisite: "先修：", source: "參考：", explanation: "需要掌握的概念",
  guidedActivity: "在模擬器試做", practice: "練習任務", example: "程式範例", luaSubset: "Lua · 模擬器子集",
  pythonApi: "Python · 僅供模擬器", copy: "複製", copied: "範例已複製。準備好後可貼到程式編輯器。",
  copyFallback: "無法使用剪貼簿，請選取下方程式碼再手動複製。", useExample: "載入此範例…",
  replaceWarning: { lua: "這會替換目前的 Lua 程式。如需保留，請先複製或匯出。", python: "這會替換目前的 Python 程式。如需保留，請先複製或匯出。" },
  cancelReplace: "保留目前程式", confirmReplace: "確認替換程式",
  checkLearning: "自我檢查", answered: "題已作答", attempts: "嘗試次數", checkAnswers: "檢查答案",
  pass: "全部答對，已完成本課。", tryAgain: "重溫解釋後再試一次。", previous: "上一課", next: "下一課",
};
