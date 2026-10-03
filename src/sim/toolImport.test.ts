// @ts-expect-error Node-only asset check; the browser app has no Node type dependency.
import { readFileSync } from "node:fs";
import { STLLoader } from "three/examples/jsm/loaders/STLLoader.js";
import { prepareFlangeMountedToolGeometry } from "./toolMount";
import { describe, expect, it } from "vitest";
import { isLikelyStl } from "./toolImport";

const ASCII_TRIANGLE = `solid local\n facet normal 0 0 1\n  outer loop\n   vertex 0 0 0\n   vertex 1 0 0\n   vertex 0 1 0\n  endloop\n endfacet\nendsolid local\n`;

describe("tool mesh import guard", () => {
  it("accepts a small ASCII STL and rejects arbitrary bytes", () => {
    expect(isLikelyStl(new TextEncoder().encode(ASCII_TRIANGLE).buffer)).toBe(true);
    expect(isLikelyStl(new TextEncoder().encode("not an STL").buffer)).toBe(false);
  });
});

it("ships the real Body1 and flange-mounted fork as valid default assets", () => {
  const loader = new STLLoader();
  const parse = (name: string) => {
    const bytes = readFileSync(`public/models/tools/${name}`);
    const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
    expect(isLikelyStl(buffer)).toBe(true);
    return loader.parse(buffer);
  };
  const body = parse("Body1.stl");
  body.computeBoundingBox();
  expect(body.attributes.position.count).toBe(132);
  const bounds = body.boundingBox!;
  expect([bounds.max.x - bounds.min.x, bounds.max.y - bounds.min.y, bounds.max.z - bounds.min.z]).toEqual([40, 40, 40]);
  const fork = prepareFlangeMountedToolGeometry(parse("Block.stl"));
  expect(fork.attributes.position.count).toBe(4008);
  expect(fork.boundingBox!.max.z).toBeCloseTo(0, 4);
  expect(fork.boundingBox!.min.z).toBeCloseTo(-5, 4);
  body.dispose(); fork.dispose();
});

it("ships the supplied magnetic pickup tool underneath the flange", () => {
  const bytes = readFileSync("public/models/tools/magnet.stl");
  const geometry = prepareFlangeMountedToolGeometry(new STLLoader().parse(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)));
  expect(geometry.attributes.position.count).toBe(13836);
  expect(geometry.boundingBox!.max.z).toBeCloseTo(0, 4);
  expect(geometry.boundingBox!.min.z).toBeCloseTo(-5, 4);
  geometry.dispose();
});
