import { BLOCK_SIZE_MM, type BlockColor, type CellBlock, type ProjectDocument } from "../domain";

export const DEFAULT_CELL_BLOCKS: CellBlock[] = [
  { id: "tower-1", color: "neutral", source: "pickup", position: { x: 300, y: -80 }, r: 0 },
  { id: "tower-2", color: "neutral", source: "pickup", position: { x: 340, y: -80 }, r: 0 },
  { id: "tower-3", color: "neutral", source: "pickup", position: { x: 360, y: -80 }, r: 0 },
  { id: "feed-black-1", color: "black", source: "feeder", position: { x: 300, y: -180 }, r: 0 },
  { id: "feed-white-1", color: "white", source: "feeder", position: { x: 310, y: -180 }, r: 0 },
  { id: "feed-black-2", color: "black", source: "feeder", position: { x: 320, y: -180 }, r: 0 },
  { id: "feed-white-2", color: "white", source: "feeder", position: { x: 315, y: -180 }, r: 0 },
];

export const DEFAULT_FEEDER_ORDER = ["feed-black-1", "feed-white-1", "feed-black-2", "feed-white-2"];

export function cloneCellBlocks(blocks: CellBlock[]): CellBlock[] {
  return blocks.map((block) => ({ ...block, position: { ...block.position } }));
}

export function resetCell(project: ProjectDocument): ProjectDocument {
  const blocks = cloneCellBlocks(project.scene.initialBlocks);
  return {
    ...project,
    scene: {
      ...project.scene,
      blocks,
      feederOrder: project.scene.initialBlocks.filter((block) => block.source === "feeder").map((block) => block.id),
      block: { ...blocks[0].position },
    },
  };
}

export function findCellBlock(project: ProjectDocument, id: string): CellBlock | undefined {
  return project.scene.blocks.find((block) => block.id === id);
}

export function canAttachCellBlock(project: ProjectDocument, id: string, attachedId: string | null): boolean {
  if (attachedId !== null) return false;
  const block = findCellBlock(project, id);
  return Boolean(block && block.source !== "output");
}

export function setCellBlockColor(block: CellBlock, color: BlockColor): CellBlock {
  return { ...block, color };
}

export function validateCellBlocks(blocks: CellBlock[], feederOrder: string[]): void {
  if (blocks.length < 1 || blocks.length > 32) throw new Error("Cell must contain between 1 and 32 blocks.");
  const ids = new Set<string>();
  for (const block of blocks) {
    if (!/^[a-z0-9][a-z0-9-]{0,63}$/.test(block.id) || ids.has(block.id)) throw new Error("Cell block IDs must be unique lowercase identifiers.");
    ids.add(block.id);
    if (!["neutral", "black", "white"].includes(block.color) || !["pickup", "feeder", "output", "unloaded"].includes(block.source)) throw new Error("Cell block color or source is invalid.");
    if (block.stackLevel !== undefined && (!Number.isInteger(block.stackLevel) || block.stackLevel < 0 || block.stackLevel > 2)) throw new Error("Cell block stack levels must be integer tower layers 0, 1, or 2.");
    if (![block.position.x, block.position.y, block.r].every(Number.isFinite) || Math.abs(block.position.x) > 500 || Math.abs(block.position.y) > 500 || Math.abs(block.r) > 360) throw new Error("Cell block position is outside the supported range.");
  }
  if (new Set(feederOrder).size !== feederOrder.length || feederOrder.some((id) => !ids.has(id) || blocks.find((block) => block.id === id)?.source !== "feeder")) throw new Error("Feeder order must reference feeder blocks exactly once.");
  if (blocks.some((block) => block.position.x < -500 || block.position.x > 550 || block.position.y < -500 || block.position.y > 500)) throw new Error(`Cell block dimensions ${BLOCK_SIZE_MM.x} × ${BLOCK_SIZE_MM.y} exceed the supported cell bounds.`);
}
