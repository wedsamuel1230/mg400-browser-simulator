// @ts-expect-error Node built-ins are used only by Vitest fixtures; production code stays browser-only.
import { gzipSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { readGzipModelAsset } from "./gzipModelAsset";

describe("readGzipModelAsset", () => {
  it("decompresses a successful model response", async () => {
    const source = new TextEncoder().encode("solid model\nendsolid model");
    const result = await readGzipModelAsset(new Response(gzipSync(source)));
    expect([...new Uint8Array(result)]).toEqual([...source]);
  });

  it("accepts bodies already decoded by HTTP Content-Encoding", async () => {
    const source = new TextEncoder().encode("solid model\nendsolid model");
    const response = new Response(source, { headers: { "content-encoding": "gzip" } });
    const result = await readGzipModelAsset(response);
    expect([...new Uint8Array(result)]).toEqual([...source]);
  });

  it("reports failed HTTP responses before attempting decompression", async () => {
    await expect(readGzipModelAsset(new Response("missing", { status: 404 }))).rejects.toThrow("HTTP 404");
  });
});
