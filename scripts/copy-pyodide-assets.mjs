import { copyFile, mkdir, stat } from "node:fs/promises";
import { resolve } from "node:path";

const packageDirectory = resolve("node_modules/pyodide");
const destinationDirectory = resolve("public/pyodide");
const runtimeFiles = [
  "pyodide.mjs",
  "pyodide.asm.mjs",
  "pyodide.asm.wasm",
  "python_stdlib.zip",
  "pyodide-lock.json",
];

await mkdir(destinationDirectory, { recursive: true });
let totalBytes = 0;
for (const filename of runtimeFiles) {
  const source = resolve(packageDirectory, filename);
  const destination = resolve(destinationDirectory, filename);
  try {
    totalBytes += (await stat(source)).size;
  } catch {
    throw new Error(`Pyodide ${filename} is missing. Install the pinned pyodide dependency before running the app.`);
  }
  await copyFile(source, destination);
}
console.log(`Copied ${runtimeFiles.length} local Pyodide runtime files (${(totalBytes / 1024 / 1024).toFixed(1)} MiB).`);
