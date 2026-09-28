/** Lightweight client-side guard before STLLoader parses a learner file. */
export function isLikelyStl(bytes: ArrayBuffer): boolean {
  if (bytes.byteLength < 32) return false;
  const view = new Uint8Array(bytes);
  const header = new TextDecoder().decode(view.subarray(0, Math.min(256, view.length))).toLowerCase();
  if (header.trimStart().startsWith("solid")) return header.includes("facet") && header.includes("vertex");
  if (bytes.byteLength < 84) return false;
  const triangles = new DataView(bytes).getUint32(80, true);
  return triangles > 0 && 84 + triangles * 50 <= bytes.byteLength;
}
