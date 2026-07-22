import { createRequire } from "node:module";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const require = createRequire(new URL("../package.json", import.meta.url));
const viteEntry = require.resolve("vite");
const vite = await import(
  `${pathToFileURL(viteEntry).href}?hospital-wiki-native-loader`
);
const cacheDir = resolve(process.cwd(), ".vite-cache");

function withProjectStorage(config = {}) {
  return {
    ...config,
    cacheDir,
    configLoader: "native",
  };
}

export const version = vite.version;
export const createLogger = (...args) => vite.createLogger(...args);
export const createBuilder = (config) =>
  vite.createBuilder(withProjectStorage(config));
export const createServer = (config) =>
  vite.createServer(withProjectStorage(config));
export const build = (config) => vite.build(withProjectStorage(config));
export const loadConfigFromFile = (
  configEnv,
  configFile,
  configRoot,
  logLevel,
  customLogger,
) =>
  vite.loadConfigFromFile(
    configEnv,
    configFile,
    configRoot,
    logLevel,
    customLogger,
    "native",
  );
