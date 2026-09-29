import { describe, expect, it } from "vitest";
import { DEFAULT_PROJECT } from "../data/defaultProject";
import { canAttachCellBlock, resetCell, validateCellBlocks } from "./multiBlockCell";

describe("deterministic multi-block cell state", () => {
  it("ships stable IDs, visible colors, and an explicit feeder order", () => {
    const { blocks, initialBlocks, feederOrder } = DEFAULT_PROJECT.scene;
    expect(blocks).toHaveLength(7);
    expect(blocks.map((block) => block.id)).toEqual(initialBlocks.map((block) => block.id));
    expect(feederOrder.map((id) => blocks.find((block) => block.id === id)?.color)).toEqual(["black", "white", "black", "white"]);
    expect(() => validateCellBlocks(blocks, feederOrder)).not.toThrow();
  });

  it("allows one eligible source block and rejects a second attachment or output block", () => {
    expect(canAttachCellBlock(DEFAULT_PROJECT, "feed-black-1", null)).toBe(true);
    expect(canAttachCellBlock(DEFAULT_PROJECT, "feed-white-1", "feed-black-1")).toBe(false);
    const project = structuredClone(DEFAULT_PROJECT);
    project.scene.blocks[3].source = "output";
    expect(canAttachCellBlock(project, "feed-black-1", null)).toBe(false);
  });

  it("reset restores changed positions and source order", () => {
    const project = structuredClone(DEFAULT_PROJECT);
    project.scene.blocks[0].position.x = 99;
    project.scene.blocks.reverse();
    project.scene.feederOrder.reverse();
    const reset = resetCell(project);
    expect(reset.scene.blocks).toEqual(reset.scene.initialBlocks);
    expect(reset.scene.feederOrder).toEqual(DEFAULT_PROJECT.scene.feederOrder);
    expect(reset.scene.block).toEqual(DEFAULT_PROJECT.scene.initialBlocks[0].position);
  });

  it("accepts deterministic three-layer tower levels and rejects unsupported levels", () => {
    const blocks = DEFAULT_PROJECT.scene.blocks.slice(0, 3).map((block, stackLevel) => ({ ...block, source: "output" as const, stackLevel }));
    expect(() => validateCellBlocks(blocks, [])).not.toThrow();
    expect(() => validateCellBlocks([{ ...blocks[0], stackLevel: 3 }], [])).toThrow(/stack levels/);
  });

  it("keeps a Free Mode magnet puck distinct from a 40 mm block and single-attachment safe", () => {
    const project = structuredClone(DEFAULT_PROJECT);
    project.scene.blocks.push({ id: "puck-8", kind: "puck", color: "neutral", source: "pickup", position: { x: 280, y: -220 }, r: 0 });
    project.scene.initialBlocks.push({ id: "puck-8", kind: "puck", color: "neutral", source: "pickup", position: { x: 280, y: -220 }, r: 0 });
    expect(() => validateCellBlocks(project.scene.blocks, project.scene.feederOrder)).not.toThrow();
    expect(project.scene.blocks.find((block) => block.id === "puck-8")?.kind).toBe("puck");
    expect(canAttachCellBlock(project, "puck-8", null)).toBe(true);
    expect(canAttachCellBlock(project, "puck-8", "tower-1")).toBe(false);
    expect(() => validateCellBlocks([{ ...project.scene.blocks[0], z: 40 }], [])).not.toThrow();
    expect(() => validateCellBlocks([{ ...project.scene.blocks[0], z: 301 }], [])).toThrow(/reachable range/);
  });
});
