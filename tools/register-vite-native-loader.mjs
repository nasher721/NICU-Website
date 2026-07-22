import { mkdirSync } from "node:fs";
import { registerHooks } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const projectRoot = process.cwd();
const tempDir = resolve(projectRoot, ".tmp");
const proxyUrl = pathToFileURL(
  resolve(dirname(fileURLToPath(import.meta.url)), "vite-native-proxy.mjs"),
).href;

mkdirSync(tempDir, { recursive: true });
process.env.TMPDIR = tempDir;

registerHooks({
  resolve(specifier, context, nextResolve) {
    const resolution = nextResolve(specifier, context);
    const loadedByVinextCli = context.parentURL?.includes("/vinext/dist/cli.js");
    const isViteEntry = /\/vite\/dist\/node\/index\.js(?:\?|$)/.test(
      resolution.url,
    );

    if (loadedByVinextCli && isViteEntry) {
      return { url: proxyUrl, shortCircuit: true };
    }

    return resolution;
  },
});
