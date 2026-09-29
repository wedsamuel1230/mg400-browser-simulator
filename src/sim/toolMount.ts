import { BoxGeometry, type BufferGeometry } from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

/** CAD-derived attachment centre for the owner-supplied magnet and fork meshes. */
export const TOOL_MOUNT_DATUM_MM = Object.freeze({ x: 0, y: -4.711511831, z: 9.734620571 });
export const TOOL_MOUNT_ROTATION_RAD = Math.PI / 2;

/** A simple, project-authored U-fork silhouette in the same source frame as the local STL. */
export function createFallbackForkGeometry(): BufferGeometry {
  const pieces = [
    new BoxGeometry(24, 12, 5), // crossbar
    new BoxGeometry(6, 72, 5), // left tine
    new BoxGeometry(6, 72, 5), // right tine
  ];
  const plateCenterZ = TOOL_MOUNT_DATUM_MM.z - 2.5;
  pieces[0].translate(0, 9, plateCenterZ);
  pieces[1].translate(-9, -39, plateCenterZ);
  pieces[2].translate(9, -39, plateCenterZ);
  const merged = mergeGeometries(pieces, false);
  pieces.forEach((geometry) => geometry.dispose());
  if (!merged) throw new Error("Could not create the fallback fork silhouette.");
  return merged;
}

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
