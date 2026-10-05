import { gzipSync } from "node:zlib";
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const root = join(process.cwd(), "public", "models");
const walk = (directory) => readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
  const path = join(directory, entry.name);
  return entry.isDirectory() ? walk(path) : /\.stl$/i.test(entry.name) ? [path] : [];
});

const models = walk(root);
if (models.length === 0) throw new Error(`No STL model assets found under ${root}`);

let sourceBytes = 0;
let compressedBytes = 0;
for (const path of models) {
  const source = readFileSync(path);
  const compressed = gzipSync(source, { level: 9, mtime: 0 });
  writeFileSync(`${path}.gz`, compressed);
  sourceBytes += source.byteLength;
  compressedBytes += compressed.byteLength;
}

console.log(`Compressed ${models.length} STL models: ${sourceBytes} -> ${compressedBytes} bytes (${Math.round((1 - compressedBytes / sourceBytes) * 100)}% smaller).`);
