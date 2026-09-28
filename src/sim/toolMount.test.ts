import { BoxGeometry } from "three";
import { describe, expect, it } from "vitest";
import { prepareFlangeMountedToolGeometry, TOOL_MOUNT_DATUM_MM } from "./toolMount";

describe("owner-supplied tool flange mounting frame", () => {
  it("centres the CAD bolt datum at the flange and keeps the print below its mounting plane", () => {
    const sourceBounds = {
      minY: -82.31122589111328,
      maxY: 15.275145530700684,
      minZ: 4.734620571136475,
      maxZ: 9.734620094299316,
    };
    const geometry = new BoxGeometry(
      40,
      sourceBounds.maxY - sourceBounds.minY,
      sourceBounds.maxZ - sourceBounds.minZ,
    );
    geometry.translate(
      0,
      (sourceBounds.minY + sourceBounds.maxY) / 2,
      (sourceBounds.minZ + sourceBounds.maxZ) / 2,
    );

    const mounted = prepareFlangeMountedToolGeometry(geometry);
    const bounds = mounted.boundingBox;
    expect(bounds).not.toBeNull();
    expect(bounds!.min.x).toBeCloseTo(-19.986657, 4);
    expect(bounds!.max.x).toBeCloseTo(77.599714, 4);
    expect(bounds!.min.y).toBeCloseTo(-20, 4);
    expect(bounds!.max.y).toBeCloseTo(20, 4);
    expect(bounds!.min.z).toBeCloseTo(-5, 4);
    expect(bounds!.max.z).toBeCloseTo(0, 4);
    expect(TOOL_MOUNT_DATUM_MM).toEqual({ x: 0, y: -4.711511831, z: 9.734620571 });
  });
});
