import { mkdir, readdir } from "node:fs/promises";
import { spawn } from "node:child_process";
import { resolve } from "node:path";

const projectRoot = resolve(import.meta.dirname, "..");
const artifactRoots = ["app", "src", "docs", "public", "tests", "tools", "dist"];
const tempRoot = resolve(projectRoot, ".tmp");

function run(command, args, environment = process.env) {
  return new Promise((resolveRun, rejectRun) => {
    const child = spawn(command, args, {
      cwd: projectRoot,
      env: environment,
      stdio: "inherit",
    });
    child.on("error", rejectRun);
    child.on("exit", (code, signal) => {
      if (code === 0) resolveRun();
      else rejectRun(new Error(`${command} ${args.join(" ")} exited with ${signal ?? code}`));
    });
  });
}

async function cleanArtifacts() {
  await run(process.execPath, ["tools/remove-appledouble.mjs", ...artifactRoots]);
}

let failure;
try {
  await cleanArtifacts();
  await mkdir(tempRoot, { recursive: true });
  await run("npm", ["run", "lint"]); await run("npm", ["run", "typecheck"]); await run("npm", ["run", "build"]);
  const tests = (await readdir(resolve(projectRoot, "tests")))
    .filter((name) => !name.startsWith("._") && name.endsWith(".test.mjs"))
    .sort()
    .map((name) => `tests/${name}`);
  await run(process.execPath, ["--test", "--test-concurrency=1", ...tests], {
    ...process.env,
    TMPDIR: tempRoot,
    CHROME_BIN: process.env.CHROME_BIN || "/usr/local/bin/google-chrome",
  });
  await run(process.platform === "win32" ? "cmd" : "sh", [
    "-c",
    "pkill -9 -f '[m]iniflare' 2>/dev/null || true; ports=$(lsof -ti:3000 2>/dev/null || true); if [ -n \"$ports\" ]; then kill -9 $ports 2>/dev/null || true; fi; exit 0",
  ]);
  await run("npm", ["run", "test:e2e"]);
} catch (error) {
  failure = error;
} finally {
  try {
    await cleanArtifacts();
  } catch (cleanupError) {
    failure = failure
      ? new AggregateError([failure, cleanupError], "Release tests and final cleanup failed")
      : cleanupError;
  }
}

if (failure) throw failure;
