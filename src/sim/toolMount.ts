import type { BufferGeometry } from "three";

/** CAD-derived attachment centre for the owner-supplied magnet and fork meshes. */
export const TOOL_MOUNT_DATUM_MM = Object.freeze({ x: 0, y: -4.711511831, z: 9.734620571 });
export const TOOL_MOUNT_ROTATION_RAD = Math.PI / 2;

/**
 * Put the mesh's bolt-circle centre on the flange origin, its mounting face on
 * flange Z=0, and point the working end along local +X. The 5 mm plate body
 * then extends below the flange plane.
 */
export function prepareFlangeMountedToolGeometry(geometry: BufferGeometry): BufferGeometry {
  geometry.translate(-TOOL_MOUNT_DATUM_MM.x, -TOOL_MOUNT_DATUM_MM.y, -TOOL_MOUNT_DATUM_MM.z);
  geometry.rotateZ(TOOL_MOUNT_ROTATION_RAD);
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}
