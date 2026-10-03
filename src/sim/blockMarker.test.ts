import { describe, expect, it } from "vitest";
import { Group, Vector3, Mesh, MeshBasicMaterial } from "three";
import { BLOCK_SIZE_MM, MAGNET_SIZE_MM } from "../domain";
import { createReferenceBlock, setWorkpieceColor } from "./blockMarker";

describe("reference-block direction marker", () => {
  it("keeps the 40 × 40 × 15 mm block and marks its local +X direction on the top and sides", () => {
    const block = createReferenceBlock();
    expect(block.geometry.parameters).toMatchObject({ width: BLOCK_SIZE_MM.x, height: BLOCK_SIZE_MM.y, depth: BLOCK_SIZE_MM.z });
    expect(block.userData.orientationMarker.meaning).toContain("local +X");
    expect(block.children.map(({ name }) => name)).toEqual([
      "Block orientation arrow on top (+X)",
      "Block orientation arrow on -Y side (+X)",
      "Block orientation arrow on +Y side (+X)",
    ]);
    expect(block.children.every((marker) => marker.userData.directionAxis === "+X")).toBe(true);
    expect(block.children[0].position.z).toBeGreaterThan(BLOCK_SIZE_MM.z / 2);
    expect(Math.abs(block.children[1].position.y)).toBeGreaterThan(BLOCK_SIZE_MM.y / 2);
    expect(Math.abs(block.children[2].position.y)).toBeGreaterThan(BLOCK_SIZE_MM.y / 2);
  });

  it("rotates the visible marker with the block when the tool flange turns 90 degrees", () => {
    const tool = new Group();
    const block = createReferenceBlock();
    tool.add(block);

    const direction = () => new Vector3(1, 0, 0).transformDirection(block.children[0].matrixWorld);
    tool.updateMatrixWorld(true);
    const before = direction();
    tool.rotation.z = Math.PI / 2;
    tool.updateMatrixWorld(true);
    const after = direction();

    expect(before.x).toBeCloseTo(1);
    expect(before.y).toBeCloseTo(0);
    expect(after.x).toBeCloseTo(0);
    expect(after.y).toBeCloseTo(1);
  });
});

it("makes the requested marked 35×35×4 magnetic plate with arrows inside its thin sides", () => {
  const plate = createReferenceBlock("neutral", MAGNET_SIZE_MM);
  expect(plate.geometry.parameters).toMatchObject({ width: 35, height: 35, depth: 4 });
  expect(plate.children[0].position.z).toBe(2.25);
  expect(plate.children[1].scale.y).toBeCloseTo(1 / 3);
});

it("keeps rotation arrows visible on black and recolored pieces",()=>{
 const piece=createReferenceBlock("black",MAGNET_SIZE_MM);const marker=piece.children[0] as Mesh<import("three").BufferGeometry,MeshBasicMaterial>;
 expect(marker.material.color.getHexString()).toBe("eef4ef");
 setWorkpieceColor(piece,"white");expect(marker.material.color.getHexString()).toBe("152326");
 setWorkpieceColor(piece,"black");expect(marker.material.color.getHexString()).toBe("eef4ef");
});
