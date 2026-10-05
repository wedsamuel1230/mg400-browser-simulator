/** Decompresses a pre-compressed public model asset without adding a runtime dependency. */
const modelAssetRequests = new Map<string, Promise<ArrayBuffer>>();

export async function readGzipModelAsset(response: Response): Promise<ArrayBuffer> {
  if (!response.ok) {
    throw new Error(`Model asset request failed with HTTP ${response.status}${response.url ? `: ${response.url}` : ""}`);
  }
  if (!response.body) throw new Error("Model asset response has no body.");
  // Fetch transparently decodes HTTP Content-Encoding bodies. Vite and some
  // static hosts infer this header from the .gz suffix, while others return
  // the gzip bytes unchanged, so support both serving conventions.
  if (response.headers.has("content-encoding")) return response.arrayBuffer();
  if (typeof DecompressionStream === "undefined") throw new Error("This browser cannot decompress the bundled model assets.");

  const decompressed = response.body.pipeThrough(new DecompressionStream("gzip"));
  return new Response(decompressed).arrayBuffer();
}

/** Shares only in-flight downloads across overlapping viewport mounts. */
export function fetchGzipModelAsset(url: string): Promise<ArrayBuffer> {
  const existing = modelAssetRequests.get(url);
  if (existing) return existing;

  const request = fetch(url).then(readGzipModelAsset);
  modelAssetRequests.set(url, request);
  void request.finally(() => {
    if (modelAssetRequests.get(url) === request) modelAssetRequests.delete(url);
  }).catch(() => undefined);
  return request;
}
