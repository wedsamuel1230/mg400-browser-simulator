import {
  BoxGeometry,
  BufferGeometry,
  DoubleSide,
  Mesh,
  MeshBasicMaterial,
  Shape,
  MeshStandardMaterial,
  ShapeGeometry,
} from "three";
import { BLOCK_SIZE_MM, type BlockColor } from "../domain";
import { MODEL_PALETTE } from "./modelPalette";

const MARKER_COLOR = "#152326";

/** Creates the unchanged 40 × 40 × 15 mm teaching block with a visible local +X arrow. */
export function createReferenceBlock(color: BlockColor = "neutral", size: { x: number; y: number; z: number } = BLOCK_SIZE_MM): Mesh<BoxGeometry, MeshStandardMaterial> {
  const blockColor = color === "black" ? "#202629" : color === "white" ? "#eef4ef" : MODEL_PALETTE.block;
  const block = new Mesh(
    new BoxGeometry(size.x, size.y, size.z),
    new MeshStandardMaterial({ color: blockColor, roughness: 0.46, metalness: 0.03 }),
  );
  block.name = `${color} ${size.x} x ${size.y} x ${size.z} mm workpiece`;

  const arrow = new Shape();
  arrow.moveTo(-15, -2);
  arrow.lineTo(5, -2);
  arrow.lineTo(5, -5);
  arrow.lineTo(14, 0);
  arrow.lineTo(5, 5);
  arrow.lineTo(5, 2);
  arrow.lineTo(-15, 2);
  arrow.closePath();
  const geometry = new ShapeGeometry(arrow);
  const material = new MeshBasicMaterial({
    color: color === "black" ? "#eef4ef" : MARKER_COLOR,
    side: DoubleSide,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -1,
  });

  const top = new Mesh(geometry, material);
  top.name = "Block orientation arrow on top (+X)";
  top.position.z = size.z / 2 + 0.25;
  top.userData.directionAxis = "+X";
  block.add(top);

  // Side marks stay visible when the magnet hides the block's top face.
  for (const side of [-1, 1] as const) {
    const sideArrow = new Mesh(geometry, material);
    sideArrow.name = `Block orientation arrow on ${side < 0 ? "-Y" : "+Y"} side (+X)`;
    sideArrow.scale.y = Math.min(1, size.z / 12);
    sideArrow.rotation.x = side < 0 ? Math.PI / 2 : -Math.PI / 2;
    sideArrow.position.y = side * (size.y / 2 + 0.25);
    sideArrow.userData.directionAxis = "+X";
    block.add(sideArrow);
  }

  block.userData.orientationMarker = {
    meaning: "The arrow points along the block's local +X direction.",
    color: color === "black" ? "#eef4ef" : MARKER_COLOR,
  };
  return block;
}

export function setWorkpieceColor(mesh: Mesh<BufferGeometry, MeshStandardMaterial>, color: BlockColor): void {
  mesh.material.color.set(color === "black" ? "#202629" : color === "white" ? "#eef4ef" : MODEL_PALETTE.block);
  for (const marker of mesh.children) {
    if (marker instanceof Mesh && marker.userData.directionAxis === "+X" && marker.material instanceof MeshBasicMaterial) marker.material.color.set(color === "black" ? "#eef4ef" : MARKER_COLOR);
  }
}
