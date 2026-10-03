import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const forbiddenNames = /fork\.stl/i;
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
// Bundling authorized by the maintainer: accept only the exact supplied meshes.
const approvedTools = {
  "magnet.stl": "6eb33378ef210da42458c57c86b09be94a82c296d4623a4e40c014754c342f06",
  "Body1.stl": "b6a56256947fcc2dac165ba56d34d5c418bd5eaed248ac49ac7b83268491a185",
  "Block.stl": "bc4b6488f05fc8649bb874b63ed0ec8d45149e307a40be27b1a8c1e5f767a325",
};
for (const directory of ["public", "dist"]) {
  for (const [name, expected] of Object.entries(approvedTools)) {
    const path = join(root, directory, "models/tools", name);
    if (!existsSync(path) || createHash("sha256").update(readFileSync(path)).digest("hex") !== expected) throw new Error(`Missing or altered approved tool model: ${path}`);
  }
}

for (const path of ["src", "api", "vite.config.ts", "index.html"]) {
  const absolute = join(root, path);
  if (!existsSync(absolute)) continue;
  const files = statSync(absolute).isDirectory() ? readdirSync(absolute, { recursive: true, withFileTypes: true }).filter((entry) => entry.isFile()).map((entry) => join(entry.parentPath, entry.name)) : [absolute];
  for (const file of files) if (/sk-[A-Za-z0-9_-]{30,}/.test(readFileSync(file, "utf8"))) throw new Error(`Credential-like key in release source: ${file}`);
}
for (const path of [".env", ".env.local", ".env.production"]) if (existsSync(join(root, path))) throw new Error(`Local environment file must not ship: ${path}`);
console.log("Public release gate: pass (licensed vendor assets, SPA config, exact maintainer-approved Body1/fork/magnet assets, no unapproved mesh or embedded key patterns)");
