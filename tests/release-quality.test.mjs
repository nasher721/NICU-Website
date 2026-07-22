import assert from "node:assert/strict";
import { readdir, readFile, stat } from "node:fs/promises";
import test from "node:test";

import akronContent from "../src/data/generated/akron.content.json" with { type: "json" };
import mainCampusContent from "../src/data/generated/main-campus.content.json" with { type: "json" };
import routeManifest from "../src/data/generated/route-manifest.json" with { type: "json" };
import { removeAppleDoubleRoots } from "../tools/remove-appledouble.mjs";

let workerPromise;
async function getWorker() {
  if (!workerPromise) {
    const workerUrl = new URL("../dist/server/index.js", import.meta.url);
    workerUrl.searchParams.set("release-test", `${process.pid}-${Date.now()}`);
    workerPromise = import(workerUrl.href).then((module) => module.default);
  }
  return workerPromise;
}

async function render(path) {
  const worker = await getWorker();
  return worker.fetch(
    new Request(`http://localhost${path}`, { headers: { accept: "text/html" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

async function inBatches(items, size, action) {
  for (let index = 0; index < items.length; index += size) {
    await Promise.all(items.slice(index, index + size).map(action));
  }
}

async function findAppleDouble(root) {
  let entries;
  try {
    entries = await readdir(root, { withFileTypes: true });
  } catch (error) {
    if (error.code === "ENOENT") return [];
    throw error;
  }
  const matches = [];
  for (const entry of entries) {
    const path = new URL(`${entry.name}${entry.isDirectory() ? "/" : ""}`, root);
    if (entry.name.startsWith("._")) matches.push(path.pathname);
    else if (entry.isDirectory()) matches.push(...await findAppleDouble(path));
  }
  return matches;
}

test("every declared article and redirect resolves through the production worker", { timeout: 45_000 }, async () => {
  const articlePaths = Object.values(routeManifest.campuses).flatMap((campus) =>
    campus.routes.map((route) => route.path));
  await inBatches(articlePaths, 12, async (path) => {
    const response = await render(path);
    assert.equal(response.status, 200, path);
    assert.match(response.headers.get("content-type") ?? "", /text\/html/);
  });

  await inBatches(routeManifest.redirects, 12, async (redirect) => {
    const response = await render(redirect.from);
    assert.equal(response.status, 308, redirect.from);
    assert.equal(new URL(response.headers.get("location"), "http://localhost").pathname, redirect.to);
  });
});

test("release route matrix and primary internal links have intentional outcomes", async () => {
  const routeMatrix = [
    ["/", 200],
    ["/main-campus", 200],
    ["/akron", 200],
    ["/main-campus/part-6-documentation-and-quality", 200],
    ["/akron/part-7-transitions-of-care", 200],
    ["/search?q=ICH&scope=both", 200],
    ["/main-campus/documentation-and-quality", 308],
    ["/akron/not-a-current-article", 404],
  ];
  const knownPaths = new Set([
    "/",
    "/main-campus",
    "/akron",
    "/search",
    "/sources",
    "/figures",
    ...Object.values(routeManifest.campuses).flatMap((campus) => campus.routes.map((route) => route.path)),
    ...routeManifest.redirects.flatMap((redirect) => [redirect.from, redirect.to]),
  ]);
  const linkedPages = ["/", "/main-campus", "/akron", routeMatrix[3][0], routeMatrix[4][0], routeMatrix[5][0]];

  for (const [path, expectedStatus] of routeMatrix) {
    const response = await render(path);
    assert.equal(response.status, expectedStatus, path);
  }

  for (const path of linkedPages) {
    const html = await (await render(path)).text();
    const hrefs = [...html.matchAll(/href="([^"]+)"/g)].map((match) => match[1].replaceAll("&amp;", "&"));
    for (const href of hrefs) {
      if (/^(?:#|https?:|mailto:|tel:)/.test(href)) continue;
      const linkedPath = new URL(href, "http://localhost").pathname;
      if (linkedPath.startsWith("/assets/")) continue;
      if (/\.(?:png|jpe?g|gif|webp|svg|ico)$/i.test(linkedPath)) continue;
      assert.ok(knownPaths.has(linkedPath), `${path} links to undeclared route ${linkedPath}`);
    }
  }
});

test("every packaged search and handbook-media asset exists in source and build output", async () => {
  const assetPaths = new Set(["/cleveland-clinic-symbol.png", "/og.png"]);
  for (const content of [mainCampusContent, akronContent]) {
    for (const section of content.sections) {
      for (const block of section.blocks ?? []) {
        if (block.type === "image" && block.src?.startsWith("/")) assetPaths.add(block.src);
      }
    }
  }
  for (const campus of ["main-campus", "akron"]) assetPaths.add(`/search-index/${campus}.json`);

  for (const assetPath of assetPaths) {
    const relative = assetPath.slice(1);
    const [source, built] = await Promise.all([
      stat(new URL(`../public/${relative}`, import.meta.url)),
      stat(new URL(`../dist/client/${relative}`, import.meta.url)),
    ]);
    assert.ok(source.size > 0, `${assetPath} source is empty`);
    assert.equal(built.size, source.size, `${assetPath} build copy drifted`);
  }
});

test("release artifacts exclude AppleDouble files and retain the clinical review boundary", async () => {
  await removeAppleDoubleRoots([
    new URL("../app/", import.meta.url),
    new URL("../src/", import.meta.url),
    new URL("../docs/", import.meta.url),
    new URL("../public/", import.meta.url),
    new URL("./", import.meta.url),
    new URL("../tools/", import.meta.url),
    new URL("../dist/", import.meta.url),
  ].map((url) => url.pathname));
  const appleDouble = [
    ...await findAppleDouble(new URL("../app/", import.meta.url)),
    ...await findAppleDouble(new URL("../src/", import.meta.url)),
    ...await findAppleDouble(new URL("../docs/", import.meta.url)),
    ...await findAppleDouble(new URL("../public/", import.meta.url)),
    ...await findAppleDouble(new URL("./", import.meta.url)),
    ...await findAppleDouble(new URL("../tools/", import.meta.url)),
    ...await findAppleDouble(new URL("../dist/", import.meta.url)),
  ];
  assert.deepEqual(appleDouble, []);

  for (const campus of ["main-campus", "akron"]) {
    const response = await render(`/${campus}`);
    const html = await response.text();
    assert.match(html, /Named human review required/);
    assert.match(html, /Clinical review/);
  }
  const governance = await readFile(new URL("../docs/release-quality-gates.md", import.meta.url), "utf8");
  assert.match(governance, /do not approve clinical or operational correctness/i);
  assert.match(governance, /named\s+human reviewer/i);
});
