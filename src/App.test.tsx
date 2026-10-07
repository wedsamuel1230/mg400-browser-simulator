import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ControllerEvents } from "./sim/SimulationController";
import type { ProjectDocument } from "./domain";
import App from "./App";

const scenario = vi.hoisted(() => ({ ready: false, runtimeError: false }));
vi.mock("./RobotViewport", () => ({ RobotViewport: () => null }));
vi.mock("./CodeAssistant", () => ({ CodeAssistant: () => null }));
vi.mock("./training/TrainingCenter", () => ({ TrainingCenter: () => null }));
vi.mock("@monaco-editor/react", () => ({ default: () => null, loader: { config() {} } }));
vi.mock("monaco-editor", () => ({}));
vi.mock("./sim/mg400Kinematics", () => ({
  MG400Kinematics: { fromUrdf: () => ({ forward: () => ({ x: 300, y: -80, z: 135, r: 0 }) }) },
}));
vi.mock("./sim/gzipModelAsset", () => ({ readGzipModelAsset: async () => new ArrayBuffer(84) }));
vi.mock("./sim/toolImport", () => ({ isLikelyStl: () => true }));
vi.mock("./sim/codeRecommendation", async (importOriginal) => ({
  ...await importOriginal<typeof import("./sim/codeRecommendation")>(),
  recommendPickAndPlace: (project: ProjectDocument) => ({
    ready: scenario.ready && project.scene.blocks.some(block => block.source === "pickup"),
    message: "", checks: [], code: "",
  }),
}));
vi.mock("./sim/SimulationController", () => ({
  SimulationController: class {
    events: ControllerEvents;
    constructor(_kinematics: unknown, events: ControllerEvents) { this.events = events; }
    stop() {}
    run() {
      if (scenario.runtimeError) {
        this.events.addLog("Runtime failure remains visible", "error");
        this.events.setStatus("error");
      } else {
        this.events.setCellBlocks?.(this.events.getProject().scene.blocks.map(block => ({ ...block, source: "output" })));
        this.events.setStatus("complete");
      }
    }
  },
}));

beforeEach(() => {
  localStorage.clear();
  scenario.ready = false;
  scenario.runtimeError = false;
  vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, text: async () => "<robot />" })));
  vi.spyOn(window, "confirm").mockReturnValue(true);
});
afterEach(() => { cleanup(); localStorage.clear(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

async function selectTower() {
  const button = screen.getByRole("button", { name: /三層積木塔/ });
  await waitFor(() => expect(button).toBeEnabled());
  fireEvent.click(button);
}

it("shows failed preflight in selected practice and other views, but hides it in the chooser", async () => {
  const { container } = render(<App />);
  await selectTower();
  expect(screen.getByRole("alert")).toHaveTextContent("Body1 校準未完成");
  expect(screen.getByRole("button", { name: "執行練習" })).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: "選另一個練習" }));
  expect(screen.queryByRole("alert")).toBeNull();
  expect(screen.getByText(/先按「開始第一個練習」/)).toBeInTheDocument();
  for (const name of ["程式", "教點與移動"]) {
    fireEvent.click(within(container.querySelector("nav")!).getByRole("button", { name }));
    expect(screen.getByRole("alert")).toHaveTextContent("Body1 校準未完成");
  }
});

it("keeps the completed scene when returning to the chooser and still checks it in Code", async () => {
  scenario.ready = true;
  const { container } = render(<App />);
  await selectTower();
  fireEvent.click(screen.getByRole("button", { name: "執行練習" }));
  expect(screen.getByText("程式已完成。看看工件位置有甚麼改變。")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "選另一個練習" }));
  expect(screen.queryByRole("alert")).toBeNull();
  expect(screen.getByText("程式已完成。看看工件位置有甚麼改變。")).toBeInTheDocument();
  fireEvent.click(within(container.querySelector("nav")!).getByRole("button", { name: "程式" }));
  expect(screen.getByRole("alert")).toHaveTextContent("Body1 校準未完成");
});

it("preserves runtime errors after returning to the practice chooser", async () => {
  scenario.ready = true;
  scenario.runtimeError = true;
  render(<App />);
  await selectTower();
  fireEvent.click(screen.getByRole("button", { name: "執行練習" }));
  fireEvent.click(screen.getByRole("button", { name: "選另一個練習" }));
  expect(within(screen.getByRole("region", { name: "執行結果" })).getByText("Runtime failure remains visible")).toBeInTheDocument();
});
