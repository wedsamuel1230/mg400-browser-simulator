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
});
