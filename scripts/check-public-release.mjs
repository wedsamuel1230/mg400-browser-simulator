import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const forbiddenNames = /(?:fork|magnet)\.stl|bc4b6488f05fc8649|6eb33378ef210da4/i;
const required = ["LICENSE", "vercel.json", "public/models/mg400/mg400_description/LICENSE"];
for (const path of required) if (!existsSync(join(root, path))) throw new Error(`Missing release file: ${path}`);
const scan = (directory) => {
  if (!existsSync(directory)) return;
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) scan(path);
    else if (forbiddenNames.test(entry.name) || forbiddenNames.test(readFileSync(path).toString("utf8"))) throw new Error(`Unknown-rights mesh or hash in release artifact: ${path}`);
  }
};
scan(join(root, "dist"));
for (const path of ["src", "api", "vite.config.ts", "index.html"]) {
  const absolute = join(root, path);
  if (!existsSync(absolute)) continue;
  const files = statSync(absolute).isDirectory() ? readdirSync(absolute, { recursive: true, withFileTypes: true }).filter((entry) => entry.isFile()).map((entry) => join(entry.parentPath, entry.name)) : [absolute];
  for (const file of files) if (/sk-[A-Za-z0-9_-]{30,}/.test(readFileSync(file, "utf8"))) throw new Error(`Credential-like key in release source: ${file}`);
}
for (const path of [".env", ".env.local", ".env.production"]) if (existsSync(join(root, path))) throw new Error(`Local environment file must not ship: ${path}`);
console.log("Public release gate: pass (licensed vendor assets, SPA config, no unknown tool meshes, hashes, or embedded key patterns)");
