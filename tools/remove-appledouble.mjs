import { readdir, rm } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

export async function removeAppleDouble(root) {
  let entries;
  try {
    entries = await readdir(root, { withFileTypes: true });
  } catch (error) {
    if (error.code === "ENOENT") return 0;
    throw error;
  }

  let removed = 0;
  for (const entry of entries) {
    const path = resolve(root, entry.name);
    if (entry.name.startsWith("._")) {
      await rm(path, { recursive: true, force: true });
      removed += 1;
    } else if (entry.isDirectory()) {
      removed += await removeAppleDouble(path);
    }
  }
  return removed;
}

export async function removeAppleDoubleRoots(roots) {
  let removed = 0;
  for (const root of roots) removed += await removeAppleDouble(resolve(root));
  return removed;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const roots = process.argv.slice(2);
  if (!roots.length) {
    throw new Error("Pass one or more artifact directories to clean");
  }
  const removed = await removeAppleDoubleRoots(roots);
  if (removed) console.log(`Removed ${removed} AppleDouble artifact${removed === 1 ? "" : "s"}`);
}
