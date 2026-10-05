import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TrainingCenter } from "./TrainingCenter";

describe("TrainingCenter example replacement", () => {
  beforeEach(() => {
    Object.defineProperty(HTMLDialogElement.prototype, "showModal", {
      configurable: true,
      value(this: HTMLDialogElement) { this.open = true; this.setAttribute("open", ""); },
    });
    Object.defineProperty(HTMLDialogElement.prototype, "close", {
      configurable: true,
      value(this: HTMLDialogElement) { this.open = false; this.removeAttribute("open"); },
    });
    localStorage.clear();
  localStorage.setItem("mg400-course-progress-v1", JSON.stringify({ schemaVersion: 1, curriculumVersion: "1.3.7", language: "en", completedLessonIds: [], attemptsByLesson: {}, lastLessonId: "foundation-first-program" }));
  });

  afterEach(() => {
    cleanup();
    localStorage.clear();
  });

  function OpenableTrainingCenter() {
    const [open, setOpen] = useState(false);
    return <>
      <button type="button" onClick={() => setOpen(true)}>Open training center</button>
      <TrainingCenter open={open} programLanguage="lua" onClose={() => setOpen(false)} onUseExample={vi.fn()} />
    </>;
  }

  it("keeps the editor untouched until the learner confirms, and allows cancellation", async () => {
    const user = userEvent.setup();
    const onUseExample = vi.fn();
    const onClose = vi.fn();
    render(<TrainingCenter open programLanguage="lua" onClose={onClose} onUseExample={onUseExample} />);

    expect(screen.getByRole("dialog", { name: "Training center" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Training center", level: 2 })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Your first program: show a message", level: 3 })).toBeInTheDocument();
    expect(screen.getByText(/This text example is ready to run straight away/)).toBeInTheDocument();
    expect(document.querySelector(".lesson-preview")).not.toHaveAttribute("open");
    expect(document.querySelector(".lesson-reference")).not.toHaveAttribute("open");
    expect(document.querySelector(".lesson-assessment")).not.toHaveAttribute("open");
    await user.click(screen.getByText("Preview code · Lua"));
    expect(screen.getByRole("heading", { name: "Code example", level: 4 })).toBeInTheDocument();
    expect(screen.getByText(/Read-only course preview/)).toBeInTheDocument();
    expect(onUseExample).not.toHaveBeenCalled();
    await user.click(screen.getByText("Concepts and further practice"));
    expect(screen.getByRole("heading", { name: "What you need to know", level: 4 })).toBeInTheDocument();
    expect(screen.getByText(/Lua is the MG400 training language/)).toBeInTheDocument();
    expect(screen.getByText(/Python is for this simulator only/)).toBeInTheDocument();
    expect(screen.getByText(/Lua · simulator subset/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Load and start practising" }));
    expect(onUseExample).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent("This replaces your current Lua program");

    await user.click(screen.getByRole("button", { name: "Keep current code" }));
    expect(onUseExample).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Load and start practising" }));
    await user.click(screen.getByRole("button", { name: "Replace current program" }));
    expect(onUseExample).toHaveBeenCalledWith(
      "-- A comment is a note for people\nlocal greeting = \"Hello, robot!\"\nprint(greeting)",
      "lua",
      "foundation-first-program",
    );
    expect(onClose).toHaveBeenCalledOnce();
  }, 10_000);

  it("warns in Traditional Chinese and applies the Python example only after confirmation", async () => {
    const user = userEvent.setup();
    const onUseExample = vi.fn();
    render(<TrainingCenter open programLanguage="python" onClose={vi.fn()} onUseExample={onUseExample} />);

    expect(screen.getByText("Python · simulator-only")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "繁中" }));
    expect(screen.getByRole("dialog", { name: "訓練中心" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "第一個程式：顯示文字" })).toBeInTheDocument();
    expect(screen.getByText(/程式不能在實體 Dobot 控制器執行/)).toBeInTheDocument();
    expect(screen.getByText("Python · 僅供模擬器")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "載入並開始練習" }));
    expect(screen.getByRole("alert")).toHaveTextContent("這會替換目前的 Python 程式");
    expect(onUseExample).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "確認替換程式" }));
    expect(onUseExample).toHaveBeenCalledWith(
      "def task():\n    # A comment is a note for people\n    greeting = \"Hello, robot!\"\n    print(greeting)\ntask()",
      "python",
      "foundation-first-program",
    );
  });

  it("allows navigation between the separate If/else and Loops lessons", async () => {
    const user = userEvent.setup();
    render(<TrainingCenter open programLanguage="lua" initialLessonId="foundation-first-program" onClose={vi.fn()} onUseExample={vi.fn()} />);

    expect(screen.getByRole("heading", { name: "Your first program: show a message" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "First robot move: go to the approach point" }));
    expect(screen.getByRole("heading", { name: "First robot move: go to the approach point" })).toBeInTheDocument();
    expect(screen.getByText(/Choose Prepare this practice, then follow the steps/)).toBeInTheDocument();
    expect(document.querySelector(".lesson-code")?.textContent).toContain("MovJ(PickApproach, {CP=0})");
    expect(document.querySelector(".lesson-code")?.textContent).not.toContain("DO(");
    expect(document.querySelector(".lesson-code")?.textContent).not.toContain("MovL(");
    expect(screen.getByText(/completed course progress stay saved/)).toBeInTheDocument();
    expect(screen.getByText(/save automatically with this local project/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "繁中" }));
    expect(screen.getByText(/已完成進度會保留/)).toBeInTheDocument();
    expect(screen.getByText(/自動儲存到本機專案/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "EN" }));
    await user.click(screen.getByRole("button", { name: "Your first program: show a message" }));
    await user.click(screen.getByRole("button", { name: "If and else: choose a path" }));
    expect(screen.getByRole("heading", { name: "If and else: choose a path" })).toBeInTheDocument();
    expect(screen.getByText(/if blockHeight > 10 then/)).toBeInTheDocument();
    expect(screen.queryByText(/for step = 1, 3 do/)).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Loops: repeat a small task" }));
    expect(screen.getByRole("heading", { name: "Loops: repeat a small task" })).toBeInTheDocument();
    expect(document.querySelector(".lesson-code")?.textContent).toContain("for step = 1, 3 do");
    expect(document.querySelector(".lesson-code")?.textContent).toContain("while count < 3 do");
  });

  it("shows the Intermediate fork-first order and prerequisites in Traditional Chinese", async () => {
    const user = userEvent.setup();
    render(<TrainingCenter open programLanguage="lua" onClose={vi.fn()} onUseExample={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: "繁中" }));
    const intermediateTrack = [...document.querySelectorAll<HTMLDetailsElement>(".training-track")]
      .find((item) => item.querySelector("summary")?.textContent?.startsWith("中階"));
    expect(intermediateTrack).toBeDefined();
    await user.click(intermediateTrack!.querySelector("summary")!);
    expect([...intermediateTrack!.querySelectorAll(".training-lesson-link")].map((button) => button.textContent?.trim())).toEqual([
      "Body1 被動叉臂取放",
      "Body1 取件後旋轉 90°",
      "Body1 三層塔 0°／90°／0°",
      "RelMovL 相對直線移動",
      "磁吸片取放",
      "黑白磁吸片獨立堆疊",
    ]);

    await user.click(screen.getByRole("button", { name: "Body1 被動叉臂取放" }));
    await user.click(screen.getByText("概念解說與延伸練習"));
    expect(screen.getByText(/只提供一件 40 × 40 × 40 Body1 及無動力叉臂/)).toBeInTheDocument();
  });

  it("wraps Tab and Shift+Tab at the ends of the training dialog", async () => {
    const user = userEvent.setup();
    const { container } = render(<TrainingCenter open programLanguage="lua" onClose={vi.fn()} onUseExample={vi.fn()} />);
    const dialog = screen.getByRole("dialog", { name: "Training center" });
    const tabbable = [...dialog.querySelectorAll<HTMLElement>(
      'a[href], button:not(:disabled), summary, input:not(:disabled):not([type="hidden"]), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])',
    )].filter((element) => !element.closest('[hidden], [aria-hidden="true"]') &&
      ![...dialog.querySelectorAll('details:not([open])')].some((details) => details.contains(element) && details.querySelector(':scope > summary') !== element));
    const first = tabbable[0];
    const last = tabbable[tabbable.length - 1];

    expect(first).toBeInstanceOf(HTMLElement);
    expect(last).toBeInstanceOf(HTMLElement);
    last.focus();
    await user.keyboard("{Tab}");
    expect(document.activeElement).toBe(first);
    first.focus();
    await user.keyboard("{Shift>}{Tab}{/Shift}");
    expect(document.activeElement).toBe(last);
    expect(container.querySelector("dialog")?.open).toBe(true);
  });

  it("returns focus to the launcher when Escape closes the dialog", async () => {
    const user = userEvent.setup();
    render(<OpenableTrainingCenter />);
    const launcher = screen.getByRole("button", { name: "Open training center" });

    await user.click(launcher);
    const dialog = screen.getByRole("dialog", { name: "Training center" });
    screen.getByRole("button", { name: "Close training center" }).focus();
    const cancel = new Event("cancel", { bubbles: true, cancelable: true });
    fireEvent(dialog, cancel);

    await waitFor(() => expect(dialog).not.toHaveAttribute("open"));
    expect(cancel.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(launcher);
  });

  it("returns focus to the launcher when the close button is used", async () => {
    const user = userEvent.setup();
    const { container } = render(<OpenableTrainingCenter />);
    const launcher = screen.getByRole("button", { name: "Open training center" });

    await user.click(launcher);
    await user.click(screen.getByRole("button", { name: "Close training center" }));

    await waitFor(() => expect(container.querySelector("dialog")?.open).toBe(false));
    expect(document.activeElement).toBe(launcher);
  });


it("shows and loads the calibrated Body1 no-output withdrawal example", async () => {
  const onUseExample=vi.fn();
  render(<TrainingCenter open programLanguage="lua" forkContactProfile="body1" initialLessonId="intermediate-passive-fork" onClose={vi.fn()} onUseExample={onUseExample} />);
  await waitFor(()=>expect(document.querySelector(".lesson-code")?.textContent).toContain("z=z-2.5"));
  expect(document.querySelector(".lesson-code")?.textContent).toContain("z=132.5");
  expect(document.querySelector(".lesson-code")?.textContent).not.toMatch(/\b(?:DO|Pick|Place)\s*\(/);
  expect(screen.getByText("Confirm the supplied Body1 is on the common Z = 110 mm platform.")).toBeInTheDocument();
  expect(screen.queryByText(/Import Body1 and select/)).not.toBeInTheDocument();
});

it("uses measured Body1 quiz contact heights instead of generic Z20",async()=>{
 render(<TrainingCenter open programLanguage="lua" forkContactProfile="body1" initialLessonId="intermediate-passive-fork" onClose={vi.fn()} onUseExample={vi.fn()} />);
 await waitFor(()=>expect(document.querySelector(".lesson-code")?.textContent).toContain("z=z-2.5"));
 const user=userEvent.setup();
 await user.click(screen.getByRole("button",{name:"EN"}));
 await user.click(screen.getByText("Check your learning · 1 questions"));
 await user.click(screen.getByRole("radio",{name:"Lower to Z = 135 mm, then Z = 132.5 mm, and withdraw 60 mm horizontally"}));
 expect(screen.getAllByText(/One supplied 40 × 40 × 40 Body1 rests directly/).length).toBeGreaterThan(0);
 expect(screen.queryByText(/Z ?= ?20 mm/)).not.toBeInTheDocument();
});

it("distinguishes the generated math exercise from the fixed two-move RelMovL demo", async () => {
  const user = userEvent.setup();
  const onUseExample = vi.fn();
  render(<TrainingCenter open programLanguage="lua" initialLessonId="intermediate-relative-linear-motion" onClose={vi.fn()} onUseExample={onUseExample} />);

  await user.click(screen.getByRole("button", { name: "繁中" }));
  expect(screen.getByText(/在互動數學練習選擇物件、堆疊或排列方式及件數/)).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "載入兩步移動示範" })).toBeInTheDocument();
  expect(document.querySelector(".lesson-launch-hint")).toHaveTextContent("這是獨立的固定示範");
  expect(screen.getByRole("button", { name: "複製程式碼 · Lua" })).toBeInTheDocument();

  await user.click(screen.getByRole("button", { name: "載入兩步移動示範" }));
  await user.click(screen.getByRole("button", { name: "確認替換程式" }));
  const loadedProgram = onUseExample.mock.calls[0][0] as string;
  expect(loadedProgram).toContain("MovJ(P0");
  expect(loadedProgram).toContain("RelMovL({0, 0, 20, 0}");
  expect(loadedProgram.indexOf("MovJ(P0")).toBeLessThan(loadedProgram.indexOf("RelMovL("));
});

it("keeps completion progress and next-lesson navigation available after the folded quiz", async () => {
  const user = userEvent.setup();
  render(<TrainingCenter open programLanguage="lua" onClose={vi.fn()} onUseExample={vi.fn()} />);
  await user.click(screen.getByText("Check your learning · 1 questions"));
  expect(screen.getByRole("button", { name: "Check answers" })).toBeDisabled();
  await user.click(screen.getByRole("radio", { name: "Display the greeting in Run output" }));
  await user.click(screen.getByRole("button", { name: "Check answers" }));
  expect(screen.getByRole("status")).toHaveTextContent("All correct. Lesson complete.");
  expect(screen.getByText("Check your learning · Completed")).toBeInTheDocument();
  expect(JSON.parse(localStorage.getItem("mg400-course-progress-v1")!).completedLessonIds).toContain("foundation-first-program");
  await user.click(screen.getByRole("button", { name: "Next lesson" }));
  expect(screen.getByRole("heading", { name: "First robot move: go to the approach point" })).toBeInTheDocument();
  expect(document.querySelector(".lesson-assessment")).not.toHaveAttribute("open");
});

it("opens an advanced track on demand and resets pending replacement on lesson change", async () => {
  const user = userEvent.setup();
  const onUseExample = vi.fn();
  render(<TrainingCenter open programLanguage="lua" onClose={vi.fn()} onUseExample={onUseExample} />);
  const advanced = [...document.querySelectorAll(".training-track")].find((element) => element.querySelector("summary")?.textContent?.startsWith("Advanced"))!;
  expect(advanced).not.toHaveAttribute("open");
  await user.click(advanced.querySelector("summary")!);
  expect(advanced).toHaveAttribute("open");
  await user.click(screen.getByRole("button", { name: "Load and start practising" }));
  await user.click(screen.getByRole("button", { name: "Next lesson" }));
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  expect(onUseExample).not.toHaveBeenCalled();
});

});
