import { BLOCK_SIZE_MM, TEACHING_PLATFORM, cellBlockSize, cellBlockTopZ, type BlockColor, type CellBlock, type ProjectDocument, type ToolMode } from "../domain";

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
  return blocks.map((block) => ({ ...block, position: { ...block.position }, ...(block.physicalPose ? {physicalPose: structuredClone(block.physicalPose)} : {}) }));
}

export function resetCell(project: ProjectDocument): ProjectDocument {
  const blocks = cloneCellBlocks(project.scene.initialBlocks).map(({physicalPose: _pose,...block})=>block);
  return {
    ...project,
    scene: {
      ...project.scene,
      blocks,
      feederOrder: project.scene.initialBlocks.filter((block) => block.source === "feeder").map((block) => block.id),
      block: { ...(blocks[0]?.position ?? project.scene.block) },
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

export function cellBlockIsOccluded(target: CellBlock, blocks: CellBlock[], mode: ToolMode, standHeightMm: number, platformHeightMm: number): boolean {
  const targetSize = cellBlockSize(target, mode);
  const targetTop = cellBlockTopZ(target, mode, standHeightMm, platformHeightMm);
  return blocks.some((block) => {
    if (block.id === target.id || block.source === "unloaded") return false;
    const size = cellBlockSize(block, mode);
    const top = cellBlockTopZ(block, mode, standHeightMm, platformHeightMm);
    const bottom = top - size.z;
    if (bottom < targetTop - 1e-6 || top <= targetTop + 1e-6) return false;
    const a = target.r * Math.PI / 180, b = block.r * Math.PI / 180;
    return [a, a + Math.PI / 2, b, b + Math.PI / 2].every((angle) => {
      const x = Math.cos(angle), y = Math.sin(angle);
      const radius = (width: number, depth: number, rotation: number) => width / 2 * Math.abs(Math.cos(rotation - angle)) + depth / 2 * Math.abs(Math.sin(rotation - angle));
      return Math.abs((block.position.x - target.position.x) * x + (block.position.y - target.position.y) * y)
        < radius(targetSize.x, targetSize.y, a) + radius(size.x, size.y, b) - 1e-6;
    });
  });
}

export function setCellBlockColor(block: CellBlock, color: BlockColor): CellBlock {
  return { ...block, color };
}

export function validateCellBlocks(blocks: CellBlock[], feederOrder: string[]): void {
  if (blocks.length > 32) throw new Error("Cell must contain at most 32 blocks.");
  const ids = new Set<string>();
  for (const block of blocks) {
    if (!/^[a-z0-9][a-z0-9-]{0,63}$/.test(block.id) || ids.has(block.id)) throw new Error("Cell block IDs must be unique lowercase identifiers.");
    ids.add(block.id);
    if (!["block", "magnet", undefined].includes(block.kind) || !["neutral", "black", "white"].includes(block.color) || !["pickup", "feeder", "output", "unloaded"].includes(block.source)) throw new Error("Cell object kind, color or source is invalid.");
    if(block.physicalPose) {
      const {position,quaternion,settled}=block.physicalPose;
      if((block.physicalPose.outsideCell!==undefined && typeof block.physicalPose.outsideCell!=="boolean") || !position || !quaternion || typeof settled!=="boolean" || ![position.x,position.y,position.z,quaternion.x,quaternion.y,quaternion.z,quaternion.w].every(Number.isFinite) || Math.max(Math.abs(position.x),Math.abs(position.y),Math.abs(position.z))>10000 || Math.abs(Math.hypot(quaternion.x,quaternion.y,quaternion.z,quaternion.w)-1)>.001) throw new Error("Invalid physical workpiece pose.");
    }
    if (block.geometry !== undefined && block.geometry !== "body1") throw new Error("Unknown workpiece geometry.");
    if (block.stackLevel !== undefined && (!Number.isInteger(block.stackLevel) || block.stackLevel < 0 || block.stackLevel > (block.geometry === "body1" ? 2 : block.kind === "magnet" ? 9 : 2))) throw new Error("Cell block stack levels must be valid integer layers for the selected workpiece.");
    if (![block.position.x, block.position.y, block.r, block.z ?? 0].every(Number.isFinite) || (block.position.x < -500 || block.position.x > Math.max(500,TEACHING_PLATFORM.x+TEACHING_PLATFORM.width/2)) || Math.abs(block.position.y) > 500 || (block.z ?? 0) < 0 || (block.z ?? 0) > 300 || Math.abs(block.r) > 360) throw new Error("Cell object position is outside the supported reachable range.");
  }
  if (new Set(feederOrder).size !== feederOrder.length || feederOrder.some((id) => !ids.has(id) || blocks.find((block) => block.id === id)?.source !== "feeder")) throw new Error("Feeder order must reference feeder blocks exactly once.");
  if (blocks.some((block) => block.position.x < -500 || block.position.x > Math.max(500,TEACHING_PLATFORM.x+TEACHING_PLATFORM.width/2) || block.position.y < -500 || block.position.y > 500)) throw new Error(`Cell block dimensions ${BLOCK_SIZE_MM.x} × ${BLOCK_SIZE_MM.y} exceed the supported cell bounds.`);
}
