import { copyFileSync, existsSync, mkdirSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const src = join(root, "node_modules/@electric-sql/pglite/dist");
const files = ["pglite.data", "pglite.wasm", "initdb.wasm"];

function walk(dir, hits = []) {
  if (!existsSync(dir)) return hits;
  let entries = [];
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return hits;
  }
  for (const ent of entries) {
    const p = join(dir, ent.name);
    if (ent.isDirectory()) {
      if (ent.name === "node_modules" || ent.name === ".git") continue;
      walk(p, hits);
    } else if (ent.name.includes("electric-sql__pglite") || ent.name === "pglite.mjs") {
      hits.push(dirname(p));
    }
  }
  return hits;
}

const dests = new Set([
  join(root, ".vercel/output/functions/__server.func/_libs"),
  join(root, ".output/server"),
  ...walk(join(root, ".vercel")),
  ...walk(join(root, ".output")),
]);

for (const dest of dests) {
  mkdirSync(dest, { recursive: true });
  for (const file of files) {
    const from = join(src, file);
    if (!existsSync(from)) {
      console.warn(`[pglite] missing ${from}`);
      continue;
    }
    copyFileSync(from, join(dest, file));
    console.log(`[pglite] copied ${file} -> ${dest}`);
  }
}
