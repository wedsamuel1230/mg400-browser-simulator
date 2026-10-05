import { useEffect, useRef, useState } from "react";
import { BookOpenCheck, Check, ChevronLeft, ChevronRight, Clipboard, X } from "lucide-react";
import { type ForkContactProfile, type JointAngles, type ProgramLanguage, type ProjectDocument } from "../domain";
import type { MG400Kinematics } from "../sim/mg400Kinematics";
import { CURRICULUM_VERSION, LESSONS, TRACKS, type CourseLanguage, type Lesson } from "./curriculum";
import { loadCourseProgress, saveCourseProgress, type CourseProgress } from "./courseProgress";
import { RelMovLMathActivity } from "./RelMovLMathActivity";

type Props = {
  open: boolean;
  programLanguage: ProgramLanguage;
  forkContactProfile?: ForkContactProfile;
  project?: ProjectDocument;
  joints?: JointAngles;
  kinematics?: Pick<MG400Kinematics, "solve">;
  modelError?: string;
  initialLessonId?: string | null;
  onClose: () => void;
  onUseExample: (example: string, language: ProgramLanguage, lessonId?: string) => void;
};

export function TrainingCenter({ open, programLanguage, project, joints, kinematics, modelError, initialLessonId, onClose, onUseExample }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const lessonHeadingRef = useRef<HTMLHeadingElement>(null);
  const focusLessonHeadingRef = useRef(false);
  const [progress, setProgress] = useState<CourseProgress>(() => loadCourseProgress());
  const [lessonId, setLessonId] = useState(progress.lastLessonId);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [feedback, setFeedback] = useState("");
  const [copyError, setCopyError] = useState(false);
  const [copied, setCopied] = useState(false);
  const [confirmExampleReplacement, setConfirmExampleReplacement] = useState(false);
  const [courseLanguage, setCourseLanguage] = useState<CourseLanguage>(progress.language);
  const lesson = LESSONS.find((item) => item.id === lessonId) ?? LESSONS[0];
  const track = TRACKS.find((item) => item.id === lesson.track)!;
  const strings = courseLanguage === "en" ? englishUi : chineseUi;
  const completed = new Set(progress.completedLessonIds);
  const allCorrect = lesson.questions.every((question, index) => answers[index] === question.answer);
  const answerCount = Object.keys(answers).length;
  const displayText = (value: { en: string; "zh-Hant": string }) => value[courseLanguage];
  const guidedSteps = lesson.id === "foundation-first-program"
    ? strings.firstProgramSteps
    : lesson.guidedSteps.map(displayText);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      const activeElement = document.activeElement;
      returnFocusRef.current = activeElement instanceof HTMLElement ? activeElement : null;
      dialog.showModal();
    }
    if (!open && dialog.open) {
      dialog.close();
      const returnFocusTo = returnFocusRef.current;
      returnFocusRef.current = null;
      if (returnFocusTo?.isConnected && !returnFocusTo.hasAttribute("disabled")) returnFocusTo.focus();
    }
  }, [open]);

  useEffect(() => {
    if (!open || !initialLessonId) return;
    const initialLesson = LESSONS.find((item) => item.id === initialLessonId);
    if (!initialLesson || initialLesson.id === lessonId) return;
    setLessonId(initialLesson.id);
    setAnswers({});
    setFeedback("");
    setCopyError(false);
    setCopied(false);
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

  useEffect(() => {
    if (!open || !focusLessonHeadingRef.current) return;
    focusLessonHeadingRef.current = false;
    lessonHeadingRef.current?.focus();
  }, [lessonId, open]);

  function selectLesson(item: Lesson) {
    focusLessonHeadingRef.current = true;
    setLessonId(item.id);
    setAnswers({});
    setFeedback("");
    setCopyError(false);
    setCopied(false);
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
      setCopied(true);
    } catch {
      setCopyError(true);
      setCopied(false);
    }
  }

  function useExample() {
    if (!confirmExampleReplacement) {
      setConfirmExampleReplacement(true);
      return;
    }
    setConfirmExampleReplacement(false);
    onUseExample(lesson.examples[programLanguage], programLanguage, lesson.id);
    onClose();
  }

  const exampleSection = (
    <section className="lesson-code-section">
      <div className="lesson-section-title"><div><h4>{strings.example}</h4><span>{programLanguage === "lua" ? strings.luaSubset : strings.pythonApi}</span></div><button className="training-copy-button" onClick={() => void copyExample()}><Clipboard size={14} />{strings.copy}</button></div>
      <p className="lesson-preview-note">{strings.previewNote}</p>
      <pre className="lesson-code" role="group" tabIndex={0} aria-label={`${strings.example} ${programLanguage}`}><code>{lesson.examples[programLanguage]}</code></pre>
      {copied && <p role="status" className="training-copy-hint">{strings.copied}</p>}
      {copyError && <p role="status" className="training-copy-hint">{strings.copyFallback}</p>}
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
          'a[href], button:not(:disabled), summary, input:not(:disabled):not([type="hidden"]), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])',
        )].filter((element) => {
          if (element.closest('[hidden], [aria-hidden="true"]')) return false;
          // Closed disclosures expose their summary, but none of their contents.
          return ![...event.currentTarget.querySelectorAll('details:not([open])')]
            .some((details) => details.contains(element) && details.querySelector(':scope > summary') !== element);
        });
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
              return <details className="training-track" key={`${item.id}-${lesson.track}`} open={item.id === lesson.track}>
                <summary>{displayText(item.title)} <span>{lessons.filter((entry) => completed.has(entry.id)).length} / {lessons.length}</span></summary>
                <div className="training-track-lessons">
                {lessons.map((entry) => <button key={entry.id} className={`training-lesson-link ${entry.id === lesson.id ? "selected" : ""}`} onClick={() => selectLesson(entry)} aria-current={entry.id === lesson.id ? "page" : undefined}>
                  <span className={`lesson-status ${completed.has(entry.id) ? "done" : ""}`}>{completed.has(entry.id) ? <Check size={11} /> : null}</span>
                  <span>{displayText(entry.title)}</span>
                </button>)}
                </div>
              </details>;
            })}
          </nav>

          <article className="training-content" key={lesson.id}>
            <div className="training-kicker">{displayText(track.title)} <span>·</span> {lesson.durationMinutes} {strings.minutes}</div>
            <h3 ref={lessonHeadingRef} tabIndex={-1}>{displayText(lesson.title)}</h3>
            <div className="lesson-outcome"><strong>{strings.outcome}</strong><span>{displayText(lesson.outcome)}</span></div>
            <section className="lesson-section"><h4>{strings.guidedActivity}</h4><ol>{guidedSteps.map((item, index) => <li key={index}>{item}</li>)}</ol></section>
            {lesson.id === "intermediate-relative-linear-motion" && <RelMovLMathActivity language={courseLanguage} project={project} joints={joints} kinematics={kinematics} modelError={modelError} />}
            <section className="lesson-launch" aria-label={strings.startPractice}>
              <button className="training-use-button" onClick={useExample} aria-expanded={confirmExampleReplacement}>{lesson.id === "intermediate-relative-linear-motion" ? strings.loadRelMovLDemo : strings.useExample}</button>
              <p className="lesson-launch-hint">{lesson.id === "foundation-first-program" ? strings.firstProgramHint : lesson.id === "intermediate-relative-linear-motion" ? strings.relmovlLaunchHint : strings.launchHint}</p>
              {confirmExampleReplacement && <div className="training-example-confirmation" role="alert">
                <p>{strings.replaceWarning[programLanguage]}</p>
                <div className="training-example-confirmation-actions">
                  <button className="training-example-cancel-button" onClick={() => setConfirmExampleReplacement(false)}>{strings.cancelReplace}</button>
                  <button className="training-example-confirm-button" onClick={useExample}>{strings.confirmReplace}</button>
                </div>
              </div>}
            </section>
            <details className="lesson-disclosure lesson-preview">
              <summary>{strings.previewExample} · {programLanguage === "lua" ? "Lua" : "Python"}</summary>
              <div className="lesson-disclosure-body">{exampleSection}</div>
            </details>
            <details className="lesson-disclosure lesson-reference">
              <summary>{strings.referenceDetails}</summary>
              <div className="lesson-disclosure-body">
                <div className="lesson-context"><span><strong>{strings.prerequisite}</strong> {displayText(lesson.prerequisite)}</span><span><strong>{strings.source}</strong> {displayText(lesson.evidenceProfile)}</span></div>
                <section className="lesson-section"><h4>{strings.explanation}</h4>{lesson.explanation.map((item, index) => <p key={index}>{displayText(item)}</p>)}</section>
                <section className="lesson-practice"><strong>{strings.practice}</strong><p>{displayText(lesson.practice)}</p></section>
              </div>
            </details>
            <details className="lesson-disclosure lesson-assessment">
              <summary className="lesson-assessment-summary">{strings.checkLearning} · {completed.has(lesson.id) ? strings.lessonComplete : `${lesson.questions.length} ${strings.questionCount}`}</summary>
              <div className="lesson-disclosure-body">
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
              </div>
            </details>

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
  copyFallback: "Clipboard access is unavailable. Select the code below and copy it manually.", useExample: "Load and start practising",
  startPractice: "Start practice", launchHint: "Loading returns you to the practice guide. Choose Prepare this practice, then follow the steps to run it.",
  loadRelMovLDemo: "Load the two-move demo", relmovlLaunchHint: "Separate from the math activity: this fixed demo moves to sample P₀, then +Z 20 mm and +X 15 mm. For your selected count and pattern, use the math activity's Copy buttons.",
  firstProgramHint: "Loading returns you to the practice guide. This text example is ready to run straight away.",
  previewExample: "Preview code", previewNote: "Read-only course preview. Load it to follow the practice guide; open Program when you want to edit it.",
  referenceDetails: "Concepts and further practice", lessonComplete: "Completed", questionCount: "questions",
  firstProgramSteps: ["Choose Load and start practising and confirm replacing the editor program.", "Back in the practice guide, press Run practice and read the message. The robot stays still.", "Open Program, change the message inside the quotes, then press Run practice again."],
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
  copyFallback: "無法使用剪貼簿，請選取下方程式碼再手動複製。", useExample: "載入並開始練習",
  startPractice: "開始練習", launchHint: "載入後會返回練習指引。先按「準備這個練習」，再跟著步驟執行。",
  loadRelMovLDemo: "載入兩步移動示範", relmovlLaunchHint: "這是獨立的固定示範：先移至示範首點 P₀，再 +Z 20 mm、+X 15 mm。如要載入上方數學練習所選的排列及件數，請使用該練習的「複製程式碼」按鈕。",
  firstProgramHint: "載入後會返回練習指引。這個文字範例已準備好，可直接執行。",
  previewExample: "查看程式範例", previewNote: "這裡是唯讀課程預覽。載入後跟著練習指引執行；想修改時再開啟「程式」。",
  referenceDetails: "概念解說與延伸練習", lessonComplete: "已完成", questionCount: "題",
  firstProgramSteps: ["按「載入並開始練習」並確認替換編輯器程式。", "返回練習指引後按「執行練習」，查看問候訊息；機械臂會保持不動。", "開啟「程式」，修改引號內的文字，再按「執行練習」。"],
  replaceWarning: { lua: "這會替換目前的 Lua 程式。如需保留，請先複製或匯出。", python: "這會替換目前的 Python 程式。如需保留，請先複製或匯出。" },
  cancelReplace: "保留目前程式", confirmReplace: "確認替換程式",
  checkLearning: "自我檢查", answered: "題已作答", attempts: "嘗試次數", checkAnswers: "檢查答案",
  pass: "全部答對，已完成本課。", tryAgain: "重溫解釋後再試一次。", previous: "上一課", next: "下一課",
};
