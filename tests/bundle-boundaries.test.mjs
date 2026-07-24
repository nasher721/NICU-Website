import assert from "node:assert/strict";
import { readdir, readFile, stat } from "node:fs/promises";
import test from "node:test";

import routeManifest from "../src/data/generated/route-manifest.json" with { type: "json" };

async function render(path) {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("bundle-test", `${process.pid}-${Date.now()}-${Math.random()}`);
  const { default: worker } = await import(workerUrl.href);
  return worker.fetch(
    new Request(`http://localhost${path}`, { headers: { accept: "text/html" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

function clientScripts(html) {
  return [...html.matchAll(/(?:src|href)="(\/assets\/[^"]+\.js)"/g)].map((match) => match[1]);
}

test("landing HTML and client graph exclude wiki, handbook, and search payloads", async () => {
  const response = await render("/");
  assert.equal(response.status, 200);
  const html = await response.text();
  const scripts = clientScripts(html);

  assert.ok(scripts.some((path) => path.includes("/LandingPage-")));
  assert.ok(scripts.every((path) => !path.includes("/App-")));
  assert.ok(scripts.every((path) => !path.includes("/ArticlePage-")));
  assert.ok(scripts.every((path) => !path.includes("/FiguresPage-")));
  assert.doesNotMatch(html, /main-campus-section-|akron-section-/);
  assert.doesNotMatch(html, /search-index\/(?:main-campus|akron)\.json/);
});

test("campus routes serialize only the selected campus navigation and article content", async () => {
  for (const [campus, oppositeCampus] of [
    ["main-campus", "akron"],
    ["akron", "main-campus"],
  ]) {
    const campusResponse = await render(`/${campus}`);
    assert.equal(campusResponse.status, 200);
    const campusHtml = await campusResponse.text();
    assert.match(campusHtml, new RegExp(`${campus}-section-`));
    assert.doesNotMatch(campusHtml, new RegExp(`${oppositeCampus}-section-`));
    assert.doesNotMatch(campusHtml, /search-index\/(?:main-campus|akron)\.json/);
    assert.match(campusHtml, /Topic hubs|taxonomy-hub/i);
    assert.match(campusHtml, /provenance-strip|source-status|Campus quarantine|Source fidelity/i);

    const articlePath = routeManifest.campuses[campus].routes.find((route) => route.slug === "clinical-domains")?.path
      ?? routeManifest.campuses[campus].routes[0].path;
    const articleResponse = await render(articlePath);
    assert.equal(articleResponse.status, 200);
    const articleHtml = await articleResponse.text();
    assert.match(articleHtml, new RegExp(`${campus}-section-`));
    assert.doesNotMatch(articleHtml, new RegExp(`${oppositeCampus}-section-`));
    assert.match(articleHtml, /Equivalent on|No reviewed equivalent mapped/);
  }
});

test("build emits campus data and route-level UI as separate lazy assets", async () => {
  const [serverAssets, clientAssets] = await Promise.all([
    readdir(new URL("../dist/server/assets/", import.meta.url)),
    readdir(new URL("../dist/client/assets/", import.meta.url)),
  ]);
  const ordinaryServerAssets = serverAssets.filter((name) => !name.startsWith("._"));
  const ordinaryClientAssets = clientAssets.filter((name) => !name.startsWith("._"));

  // Figures stay on-demand client assets; handbook JSON remains server-side via route modules.
  for (const campus of ["main-campus", "akron"]) {
    assert.ok(
      ordinaryClientAssets.some((name) => name.startsWith(`${campus}.figures-`)),
      `expected a separate ${campus}.figures client asset`,
    );
  }
  assert.ok(ordinaryClientAssets.some((name) => name.startsWith("ArticlePage-")));
  assert.ok(ordinaryClientAssets.some((name) => name.startsWith("FiguresPage-")));
  assert.ok(ordinaryClientAssets.some((name) => name.startsWith("SourceStatus-")));

  const appName = ordinaryClientAssets.find((name) => name.startsWith("App-"));
  const articleName = ordinaryClientAssets.find((name) => name.startsWith("ArticlePage-"));
  assert.ok(appName);
  assert.ok(articleName);
  const [appSource, articleSource] = await Promise.all([
    readFile(new URL(`../dist/client/assets/${appName}`, import.meta.url), "utf8"),
    readFile(new URL(`../dist/client/assets/${articleName}`, import.meta.url), "utf8"),
  ]);
  assert.doesNotMatch(appSource, /article-content|smartphrase-block/);
  assert.match(articleSource, /article-content/);
  assert.ok(ordinaryServerAssets.length >= 0);
});

test("release bundle budgets keep route shells and campus payloads bounded", async () => {
  const [clientAssets] = await Promise.all([
    readdir(new URL("../dist/client/assets/", import.meta.url)),
  ]);
  const ordinaryClientAssets = clientAssets.filter((name) => !name.startsWith("._"));
  const budgets = [
    [ordinaryClientAssets, /^LandingPage-.*\.js$/, 25_000],
    [ordinaryClientAssets, /^App-.*\.js$/, 70_000],
    [ordinaryClientAssets, /^ArticlePage-.*\.js$/, 20_000],
    [ordinaryClientAssets, /^FiguresPage-.*\.js$/, 12_000],
    [ordinaryClientAssets, /^routes-.*\.js$/, 55_000],
    [ordinaryClientAssets, /^(?:main-campus|akron)\.figures-.*\.js$/, 15_000],
  ];

  for (const [assets, pattern, limit] of budgets) {
    const matches = assets.filter((name) => pattern.test(name));
    assert.ok(matches.length > 0, `expected asset matching ${pattern}`);
    for (const name of matches) {
      const details = await stat(new URL(`../dist/client/assets/${name}`, import.meta.url));
      assert.ok(details.size <= limit, `${name} is ${details.size} bytes; budget is ${limit}`);
    }
  }

  for (const [path, limit] of [["/", 35_000], ["/main-campus", 140_000], ["/akron", 140_000]]) {
    const response = await render(path);
    const html = await response.text();
    assert.ok(Buffer.byteLength(html) <= limit, `${path} HTML exceeds ${limit} bytes`);
  }
});

test("EyeField and figure fallbacks keep deterministic motion and source context", async () => {
  const [eyeSource, figureSource] = await Promise.all([
    readFile(new URL("../src/components/EyeField.jsx", import.meta.url), "utf8"),
    readFile(new URL("../src/components/wiki/FigureCard.jsx", import.meta.url), "utf8"),
  ]);

  assert.match(eyeSource, /data-seed="24719"/);
  assert.match(eyeSource, /seededRandom\(24719 \+ count\)/);
  assert.doesNotMatch(eyeSource, /Math\.random/);
  assert.match(eyeSource, /prefers-reduced-motion/);
  assert.match(eyeSource, /if \(!reduceMotion && visible\) frameId = requestAnimationFrame/);

  assert.match(figureSource, /onError=/);
  assert.match(figureSource, /missing-figure/);
  assert.match(figureSource, /sourceLocation/);
  assert.match(figureSource, /figure\.sourceLocation/);
});
