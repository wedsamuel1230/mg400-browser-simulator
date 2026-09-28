import { describe, expect, it } from "vitest";
import { isLikelyStl } from "./toolImport";

const ASCII_TRIANGLE = `solid local\n facet normal 0 0 1\n  outer loop\n   vertex 0 0 0\n   vertex 1 0 0\n   vertex 0 1 0\n  endloop\n endfacet\nendsolid local\n`;

describe("tool mesh import guard", () => {
  it("accepts a small ASCII STL and rejects arbitrary bytes", () => {
    expect(isLikelyStl(new TextEncoder().encode(ASCII_TRIANGLE).buffer)).toBe(true);
    expect(isLikelyStl(new TextEncoder().encode("not an STL").buffer)).toBe(false);
  });
});
