import { describe, expect, it } from "vitest";
import { FORK_SUPPORT_HEIGHT_MM } from "./domain";
import { DEFAULT_FORK_PYTHON_SCRIPT, DEFAULT_FORK_SCRIPT, DEFAULT_PYTHON_SCRIPT, DEFAULT_SCRIPT } from "./domain";
import { DEFAULT_PROJECT } from "./data/defaultProject";
import { exportProject, parseProjectFile, validateProject } from "./projectStore";

describe("project document validation", () => {
  it("accepts and clones the bundled starting project", () => {
    const result = validateProject(DEFAULT_PROJECT);
    expect(result).toEqual(DEFAULT_PROJECT);
    expect(result).not.toBe(DEFAULT_PROJECT);
  });

  it("preserves a valid project through JSON export and import", () => {
    expect(parseProjectFile(exportProject(DEFAULT_PROJECT))).toEqual(DEFAULT_PROJECT);
  });

  it("rejects a bad import without changing the source object", () => {
    const candidate = structuredClone(DEFAULT_PROJECT);
    candidate.points[0] = { ...candidate.points[0], name: "function" };
    const before = structuredClone(candidate);
    expect(() => parseProjectFile(JSON.stringify(candidate))).toThrow(/point 'function'/i);
    expect(candidate).toEqual(before);
  });

  it("rejects a joint point beyond the documented J2 lower limit", () => {
    const candidate = structuredClone(DEFAULT_PROJECT);
    const home = candidate.points.find((point) => point.kind === "joint");
    if (!home || home.kind !== "joint") throw new Error("Fixture is missing the Home joint point.");
    home.joints[1] = -0.5;
    expect(() => validateProject(candidate)).toThrow(/joint point 'Home'/i);
  });

  it("migrates schema v1 projects while preserving points and custom offsets", () => {
    const legacy = structuredClone(DEFAULT_PROJECT) as unknown as Record<string, unknown>;
    legacy.schemaVersion = 1;
    delete legacy.pythonScript;
    delete legacy.programmingLanguage;
    const legacyTool = legacy.tool as Record<string, unknown>;
    delete legacyTool.mode;
    legacyTool.tcpOffset = { x: 0, y: 0, z: -35, r: 0 };

    const migrated = validateProject(legacy);
    expect(migrated.schemaVersion).toBe(11);
    expect(migrated.points).toEqual(DEFAULT_PROJECT.points);
    expect(migrated.script).toBe(DEFAULT_PROJECT.script);
    expect(migrated.programmingLanguage).toBe("lua");
    expect(migrated.tool.mode).toBe("magnet");
    expect(migrated.tool.tcpOffsets).toEqual({
      magnet: { x: 60, y: 0, z: -5, r: 0 },
      fork: { x: 60, y: 0, z: 0, r: 0 },
    });
  });

  it("migrates schema v2 offsets to per-tool contact points and preserves custom offsets", () => {
    const legacy = structuredClone(DEFAULT_PROJECT) as unknown as Record<string, unknown>;
    legacy.schemaVersion = 2;
    const legacyTool = legacy.tool as Record<string, unknown>;
    delete legacyTool.tcpOffsets;
    legacyTool.tcpOffset = { x: 60, y: 0, z: -35, r: 0 };
    expect(validateProject(legacy).tool.tcpOffsets).toEqual({
      magnet: { x: 60, y: 0, z: -5, r: 0 },
      fork: { x: 60, y: 0, z: 0, r: 0 },
    });

    legacyTool.tcpOffset = { x: 62, y: 1, z: -35, r: 0 };
    expect(validateProject(legacy).tool.tcpOffsets.magnet).toEqual({ x: 62, y: 1, z: -35, r: 0 });
    expect(validateProject(legacy).tool.tcpOffsets.fork).toEqual({ x: 60, y: 0, z: 0, r: 0 });
  });

  it("migrates the short-lived schema v3 default without losing project state", () => {
    const legacy = structuredClone(DEFAULT_PROJECT) as unknown as Record<string, unknown>;
    legacy.schemaVersion = 3;
    const legacyTool = legacy.tool as Record<string, unknown>;
    delete legacyTool.tcpOffsets;
    legacyTool.tcpOffset = { x: 60, y: 0, z: 0, r: 0 };
    const migrated = validateProject(legacy);
    expect(migrated.tool.tcpOffsets).toEqual({
      magnet: { x: 60, y: 0, z: -5, r: 0 },
      fork: { x: 60, y: 0, z: 0, r: 0 },
    });
    expect(migrated.points).toEqual(DEFAULT_PROJECT.points);
  });

  it("retains a non-default TCP offset while migrating", () => {
    const legacy = structuredClone(DEFAULT_PROJECT) as unknown as Record<string, unknown>;
    legacy.schemaVersion = 1;
    delete legacy.pythonScript;
    delete legacy.programmingLanguage;
    const legacyTool = legacy.tool as Record<string, unknown>;
    delete legacyTool.mode;
    legacyTool.tcpOffset = { x: 12, y: 4, z: -20, r: 8 };
    expect(validateProject(legacy).tool.tcpOffsets.magnet).toEqual({ x: 12, y: 4, z: -20, r: 8 });
  });

  it("migrates an untouched v4 fork project to the passive-fork starter without replacing custom code", () => {
    const legacy = structuredClone(DEFAULT_PROJECT) as unknown as Record<string, unknown>;
    legacy.schemaVersion = 4;
    legacy.script = DEFAULT_SCRIPT;
    legacy.pythonScript = DEFAULT_PYTHON_SCRIPT;
    (legacy.tool as Record<string, unknown>).mode = "fork";

    const migrated = validateProject(legacy);
    expect(migrated.schemaVersion).toBe(11);
    expect(migrated.script).toBe(DEFAULT_FORK_SCRIPT);
    expect(migrated.pythonScript).toBe(DEFAULT_FORK_PYTHON_SCRIPT);

    legacy.script = "-- my custom program\nDO(2, ON)";
    const custom = validateProject(legacy);
    expect(custom.script).toBe("-- my custom program\nDO(2, ON)");
  });

  it("moves untouched v5 reference cells into the current shared reachable layout", () => {
    const legacy = structuredClone(DEFAULT_PROJECT) as unknown as Record<string, unknown>;
    legacy.schemaVersion = 5;
    legacy.scene = { block: { x: 300, y: -80 }, drop: { x: 300, y: 80 } };
    legacy.points = (legacy.points as Array<Record<string, unknown>>).map((point) => {
      if (point.kind !== "cartesian" || typeof point.name !== "string") return point;
      const pose = point.pose as Record<string, number>;
      if (point.name === "PickPoint") Object.assign(pose, { x: 300, z: 15 });
      if (point.name === "PickApproach") Object.assign(pose, { x: 300, z: 95 });
      if (point.name === "PlacePoint") Object.assign(pose, { x: 300, z: 15 });
      if (point.name === "PlaceApproach") Object.assign(pose, { x: 300, z: 95 });
      return point;
    });

    const migrated = validateProject(legacy);
    expect(migrated.schemaVersion).toBe(11);
    expect(migrated.scene).toMatchObject({ block: { x: 300, y: -80 }, drop: { x: 300, y: 80 } });
    expect(migrated.points.find((point) => point.name === "PickPoint")).toMatchObject({ pose: { x: 300, z: 15 } });
  });

  it("migrates an untouched v5 fork cell to its raised support plane and keeps custom cells intact", () => {
    const legacy = structuredClone(DEFAULT_PROJECT) as unknown as Record<string, unknown>;
    legacy.schemaVersion = 5;
    (legacy.tool as Record<string, unknown>).mode = "fork";
    legacy.script = DEFAULT_FORK_SCRIPT;
    legacy.pythonScript = DEFAULT_FORK_PYTHON_SCRIPT;
    legacy.scene = { block: { x: 300, y: -80 }, drop: { x: 300, y: 80 } };
    legacy.points = (legacy.points as Array<Record<string, unknown>>).map((point) => {
      if (point.kind !== "cartesian" || typeof point.name !== "string") return point;
      const pose = point.pose as Record<string, number>;
      if (point.name === "PickPoint") Object.assign(pose, { x: 300, z: 0 });
      if (point.name === "PickApproach") Object.assign(pose, { x: 240, z: 0 });
      if (point.name === "PlacePoint") Object.assign(pose, { x: 300, z: 0 });
      if (point.name === "PlaceApproach") Object.assign(pose, { x: 300, z: 80 });
      return point;
    });

    const migrated = validateProject(legacy);
    expect(migrated.scene.block).toEqual({ x: 300, y: -80 });
    expect(migrated.points.find((point) => point.name === "PickPoint")).toMatchObject({ pose: { x: 300, z: FORK_SUPPORT_HEIGHT_MM } });
    expect(migrated.points.find((point) => point.name === "PickApproach")).toMatchObject({ pose: { x: 240, z: FORK_SUPPORT_HEIGHT_MM } });
    expect(migrated.script).not.toMatch(/\bDO\s*\(/i);

    const custom = structuredClone(legacy);
    (custom.scene as Record<string, unknown>).block = { x: 310, y: -80 };
    expect(validateProject(custom).scene.block).toEqual({ x: 310, y: -80 });
  });

  it("repairs only the untouched v6 starter cell and converts it for the passive fork", () => {
    const legacy = structuredClone(DEFAULT_PROJECT) as unknown as Record<string, unknown>;
    legacy.schemaVersion = 6;
    legacy.scene = { block: { x: 300, y: -80 }, drop: { x: 300, y: 80 } };
    (legacy.tool as Record<string, unknown>).mode = "fork";
    legacy.script = DEFAULT_SCRIPT;
    legacy.pythonScript = DEFAULT_PYTHON_SCRIPT;
    legacy.points = (legacy.points as Array<Record<string, unknown>>).map((point) => {
      if (point.kind !== "cartesian" || typeof point.name !== "string") return point;
      const pose = point.pose as Record<string, number>;
      if (point.name === "PickPoint") Object.assign(pose, { x: 300, y: -80, z: 15 });
      if (point.name === "PickApproach") Object.assign(pose, { x: 300, y: -80, z: 95 });
      if (point.name === "PlacePoint") Object.assign(pose, { x: 300, y: 80, z: 15 });
      if (point.name === "PlaceApproach") Object.assign(pose, { x: 300, y: 80, z: 95 });
      return point;
    });

    const migrated = validateProject(legacy);
    expect(migrated.schemaVersion).toBe(11);
    expect(migrated.scene).toMatchObject({ block: { x: 300, y: -80 }, drop: { x: 300, y: 80 } });
    expect(migrated.points.find((point) => point.name === "PickPoint")).toMatchObject({ pose: { x: 300, y: -80, z: FORK_SUPPORT_HEIGHT_MM, r: 0 } });
    expect(migrated.points.find((point) => point.name === "PickApproach")).toMatchObject({ pose: { x: 240, y: -80, z: FORK_SUPPORT_HEIGHT_MM, r: 0 } });
    expect(migrated.points.find((point) => point.name === "PlacePoint")).toMatchObject({ pose: { x: 300, y: 80, z: FORK_SUPPORT_HEIGHT_MM, r: 0 } });
    expect(migrated.points.find((point) => point.name === "PlaceApproach")).toMatchObject({ pose: { x: 300, y: 80, z: FORK_SUPPORT_HEIGHT_MM + 80, r: 0 } });
    expect(migrated.script).toBe(DEFAULT_FORK_SCRIPT);
    expect(migrated.pythonScript).toBe(DEFAULT_FORK_PYTHON_SCRIPT);
  });

  it("migrates old v6 magnet coordinates but preserves custom v6 fork workcells and programs", () => {
    const oldMagnet = structuredClone(DEFAULT_PROJECT) as unknown as Record<string, unknown>;
    oldMagnet.schemaVersion = 6;
    oldMagnet.scene = { block: { x: 300, y: -80 }, drop: { x: 300, y: 80 } };
    oldMagnet.points = (oldMagnet.points as Array<Record<string, unknown>>).map((point) => {
      if (point.kind !== "cartesian" || typeof point.name !== "string") return point;
      const pose = point.pose as Record<string, number>;
      if (point.name === "PickPoint") Object.assign(pose, { x: 300, y: -80, z: 15 });
      if (point.name === "PickApproach") Object.assign(pose, { x: 300, y: -80, z: 95 });
      if (point.name === "PlacePoint") Object.assign(pose, { x: 300, y: 80, z: 15 });
      if (point.name === "PlaceApproach") Object.assign(pose, { x: 300, y: 80, z: 95 });
      return point;
    });
    const migratedMagnet = validateProject(oldMagnet);
    expect(migratedMagnet.scene.block).toEqual({ x: 300, y: -80 });
    expect(migratedMagnet.points.find((point) => point.name === "PickPoint")).toMatchObject({ pose: { x: 300, z: 15 } });

    const customFork = structuredClone(oldMagnet);
    (customFork.tool as Record<string, unknown>).mode = "fork";
    (customFork.scene as Record<string, unknown>).block = { x: 315, y: -80 };
    (customFork.points as Array<Record<string, unknown>>).find((point) => point.name === "PickPoint")!.pose = { x: 315, y: -80, z: 20, r: 0 };
    customFork.script = "-- custom fork lesson\nMovL(PickPoint, {CP=0})";
    customFork.pythonScript = "# custom fork lesson\nawait mov_l(PickPoint, cp=0)";
    const preserved = validateProject(customFork);
    expect(preserved.scene.block).toEqual({ x: 315, y: -80 });
    expect(preserved.points.find((point) => point.name === "PickPoint")).toMatchObject({ pose: { x: 315, y: -80, z: 20 } });
    expect(preserved.script).toBe(customFork.script);
    expect(preserved.pythonScript).toBe(customFork.pythonScript);
    expect(preserved.schemaVersion).toBe(11);
  });
});

it("preserves schema9 learner geometry, code and points when upgrading magnetic plates", () => {
  const old = structuredClone(DEFAULT_PROJECT);
  const legacy = { ...old, schemaVersion: 9, script: "print('my lesson')" };
  const result = validateProject(legacy);
  expect(result.schemaVersion).toBe(11);
  expect(result.scene.blocks.every(block => block.kind === "block")).toBe(true);
  expect(result.script).toBe(legacy.script);
  expect(result.points).toEqual(legacy.points);
});


it("converts old round items without deleting learner code, points or custom fixture height", () => {
  const legacy = JSON.parse(JSON.stringify(DEFAULT_PROJECT));
  legacy.schemaVersion = 10;
  legacy.script = 'print("my lesson")';
  legacy.scene.magnetStandHeightMm = 35;
  legacy.scene.blocks[0].kind = "puck";
  legacy.scene.initialBlocks[0].kind = "puck";
  const result = validateProject(legacy);
  expect(result.schemaVersion).toBe(11);
  expect(result.scene.blocks[0].kind).toBe("magnet");
  expect(result.scene.initialBlocks[0].kind).toBe("magnet");
  expect(result.script).toBe(legacy.script);
  expect(result.points).toEqual(legacy.points);
  expect(result.scene.magnetStandHeightMm).toBe(0);
});
it("upgrades only untouched stock magnetic contacts from the old20mm stand to a110mm shared platform", () => {
  const legacy = JSON.parse(JSON.stringify(DEFAULT_PROJECT)); legacy.schemaVersion=10; delete legacy.scene.magnetStandHeightMm;
  legacy.points = legacy.points.map((point: {kind:string;pose?:{z:number}}) => point.kind==="cartesian" ? {...point,pose:{...point.pose,z:point.pose!.z-90}} : point);
  const upgraded=validateProject(legacy);
  expect(upgraded.scene.platformHeightMm).toBe(110);
  expect(upgraded.scene.magnetStandHeightMm).toBe(0);
  expect(upgraded.points).toEqual(DEFAULT_PROJECT.points);
  legacy.points[1].pose.x=301;
  const customized=validateProject(legacy);
  expect(customized.scene.magnetStandHeightMm).toBe(0);
  expect(customized.points).toEqual(legacy.points);
});
it("rejects new round items and invalid fixture heights instead of retaining a hidden legacy mode",()=>{
 const invalid=JSON.parse(JSON.stringify(DEFAULT_PROJECT)); invalid.scene.blocks[0].kind="puck";
 expect(()=>validateProject(invalid)).toThrow(/object kind/);
 invalid.scene.blocks[0].kind="magnet";invalid.scene.magnetStandHeightMm=Infinity;
 expect(()=>validateProject(invalid)).toThrow(/stand height/);
});

it("normalizes a custom historical platform and preserves code and points for re-teaching",()=>{
 const legacy=structuredClone(DEFAULT_PROJECT) as unknown as Record<string,any>;
 legacy.schemaVersion=10;delete legacy.scene.platformHeightMm;delete legacy.scene.magnetStandHeightMm;
 legacy.scene.blocks[0].position.x=350;
 legacy.points=legacy.points.map((point:any)=>point.kind==="cartesian"?{...point,pose:{...point.pose,z:point.pose.z-90}}:point);
 const migrated=validateProject(legacy);
 expect(migrated.scene.platformHeightMm).toBe(110);expect(migrated.scene.magnetStandHeightMm).toBe(0);expect(migrated.scene.platformMigrationFromMm).toBe(0);
 expect(migrated.points).toEqual(legacy.points);expect(migrated.script).toBe(legacy.script);
});
