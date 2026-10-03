import {
  DEFAULT_SCRIPT,
  DEFAULT_PYTHON_SCRIPT,
  DEFAULT_FLANGE_OFFSET,
  DEFAULT_TCP_OFFSETS,
  PROJECT_FORMAT,
  PROJECT_SCHEMA_VERSION,
  rad,
  type ProjectDocument,
} from "../domain";
import { cloneCellBlocks, DEFAULT_CELL_BLOCKS, DEFAULT_FEEDER_ORDER } from "../sim/multiBlockCell";

const point = (name: string, x: number, y: number, z: number) => ({
  id: name.toLowerCase(),
  name,
  kind: "cartesian" as const,
  pose: { x, y, z, r: 0 },
});

export const DEFAULT_PROJECT: ProjectDocument = {
  format: PROJECT_FORMAT,
  schemaVersion: PROJECT_SCHEMA_VERSION,
  script: DEFAULT_SCRIPT,
  pythonScript: DEFAULT_PYTHON_SCRIPT,
  programmingLanguage: "lua",
  points: [
    {
      id: "home",
      name: "Home",
      kind: "joint",
      joints: [rad(0), rad(30), rad(45), rad(0)],
    },
    point("PickPoint", 300, -80, 24),
    point("PickApproach", 300, -80, 104),
    point("PlacePoint", 300, 80, 24),
    point("PlaceApproach", 300, 80, 104),
  ],
  scene: {
    block: { x: 300, y: -80 },
    drop: { x: 300, y: 80 },
    blocks: cloneCellBlocks(DEFAULT_CELL_BLOCKS),
    initialBlocks: cloneCellBlocks(DEFAULT_CELL_BLOCKS),
    feederOrder: [...DEFAULT_FEEDER_ORDER],
  },
  tool: {
    mode: "magnet",
    flangeOffset: { ...DEFAULT_FLANGE_OFFSET },
    tcpOffsets: {
      magnet: { ...DEFAULT_TCP_OFFSETS.magnet },
      fork: { ...DEFAULT_TCP_OFFSETS.fork },
    },
    pickupTolerance: { xy: 12, z: 8 },
  },
  simulation: { speed: 100 },
};
