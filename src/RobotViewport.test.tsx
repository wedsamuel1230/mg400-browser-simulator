import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { RobotViewport } from "./RobotViewport";
import { DEFAULT_PROJECT } from "./data/defaultProject";
import { MODEL_PALETTE, ROBOT_COLOR_GROUPS } from "./sim/modelPalette";

vi.mock("./sim/SimulatorScene", () => ({
  SimulatorScene: {
    create: async (_canvas: HTMLCanvasElement, _urdfXml: string, onStatus: (status: { kind: "ready" }) => void) => {
      onStatus({ kind: "ready" });
      return { setState() {}, setLocalToolMeshes() {}, dispose() {}, resetCamera() {} };
    },
  },
}));

const rgb = (hex: string) => {
  const value = hex.slice(1);
  return `rgb(${parseInt(value.slice(0, 2), 16)}, ${parseInt(value.slice(2, 4), 16)}, ${parseInt(value.slice(4, 6), 16)})`;
};

function getSwatchColors(label: string) {
  const row = screen.getByText(label, { exact: true }).closest("li");
  return [...(row?.querySelectorAll<HTMLElement>(".model-swatch") ?? [])].map((swatch) => swatch.style.backgroundColor);
}

describe("RobotViewport color guide", () => {
  afterEach(cleanup);

  it("reports URDF fetch failure instead of leaving the viewport loading", async () => {
    render(<RobotViewport joints={[0, 0, 0, 0]} project={DEFAULT_PROJECT}
      blockPosition={{ x: 360, y: -80 }} attached={false} target={null}
      cameraResetToken={0} urdfXml={null} modelError="Could not load the bundled MG400 kinematic model." />);
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Model could not load"));
    expect(screen.getByRole("status")).toHaveTextContent("Could not load the bundled MG400 kinematic model.");
    expect(screen.queryByText("Loading robot model")).toBeNull();
  });

  it("localizes the canvas and simulation region for Traditional Chinese", async () => {
    render(<RobotViewport
      joints={[0, 0, 0, 0]}
      project={DEFAULT_PROJECT}
      blockPosition={{ x: 360, y: -80 }}
      attached={false}
      target={null}
      cameraResetToken={0}
      urdfXml="<robot />"
      uiLanguage="zh-Hant"
    />);

    expect(screen.getByRole("region", { name: "互動式 MG400 三維模擬" })).toBeInTheDocument();
    expect(screen.getByLabelText("MG400 機械臂、工作台及工件")).toBeInTheDocument();
    await waitFor(() => expect(document.querySelector(".viewport-overlay")).toBeNull());
  });

  it("renders swatches from the same colors used by the robot, tool, TCP, target, and block", async () => {
    render(<RobotViewport
      joints={[0, 0, 0, 0]}
      project={DEFAULT_PROJECT}
      blockPosition={{ x: 360, y: -80 }}
      attached={false}
      target={null}
      cameraResetToken={0}
      urdfXml="<robot />"
    />);
    await waitFor(() => expect(document.querySelector(".viewport-overlay")).toBeNull());

    for (const group of ROBOT_COLOR_GROUPS) {
      expect(getSwatchColors(group.label)).toEqual(group.colors.map(rgb));
    }
    expect(getSwatchColors("Active tool: Magnet")).toEqual([rgb(MODEL_PALETTE.magnet)]);
    expect(getSwatchColors("TCP reference")).toEqual([rgb(MODEL_PALETTE.tcp)]);
    expect(getSwatchColors("Selected point")).toEqual([rgb(MODEL_PALETTE.target), rgb(MODEL_PALETTE.targetCenter)]);
    expect(getSwatchColors("40 × 40 × 15 mm workpiece")).toEqual([rgb(MODEL_PALETTE.block)]);
    expect(screen.getByText("Training palette overlays the vendor geometry for teaching; it does not represent factory paint.")).toBeInTheDocument();
  });
});
