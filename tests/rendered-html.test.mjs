import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

async function render(path = "/") {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  return worker.fetch(
    new Request(`http://localhost${path}`, { headers: { accept: "text/html" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("server renders the faculty wiki landing page", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);
  const html = await response.text();
  assert.match(html, /Neurocritical Care Faculty Wiki/i);
  assert.match(html, /NEUROCRITICAL/i);
  assert.match(html, /Open the right faculty wiki/i);
  assert.match(html, /Source figures/i);
});

test("unknown non-campus paths render stable global recovery UI", async () => {
  const response = await render("/not-a-campus/topic");
  assert.equal(response.status, 404);
  const html = await response.text();
  assert.match(html, /Main Campus/);
  assert.match(html, /recovery/);
  assert.match(html, /This article path is not in the current handbook/);
  assert.match(html, /name="scope" value="main-campus"/);
});

test("the figures page renders the handbook figure library", async () => {
  const source = await readFile(new URL("../src/components/wiki/FiguresPage.jsx", import.meta.url), "utf8");
  assert.match(source, /Figures from both faculty handbooks/i);
  assert.match(source, /figure-library-grid/i);
});
