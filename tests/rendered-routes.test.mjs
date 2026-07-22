import assert from "node:assert/strict";
import test from "node:test";

async function render(path = "/") {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("route-test", `${process.pid}-${Date.now()}-${Math.random()}`);
  const { default: worker } = await import(workerUrl.href);
  return worker.fetch(
    new Request(`http://localhost${path}`, { headers: { accept: "text/html" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("both hospital homepages render directly with campus metadata", async () => {
  for (const [path, campus, title] of [
    ["/main-campus", "Main Campus", "Main Campus Faculty Wiki"],
    ["/akron", "Akron General", "Akron General Faculty Wiki"],
  ]) {
    const response = await render(path);
    assert.equal(response.status, 200);
    const html = await response.text();
    assert.match(html, new RegExp(campus));
    assert.match(html, new RegExp(`<title>${title}`));
    assert.match(html, /Campus overview/);
  }
});

test("representative articles render directly and expose article metadata", async () => {
  for (const [path, heading, campus] of [
    ["/main-campus/part-6-documentation-and-quality", /Documentation (?:&amp;|&) Quality/i, "Main Campus"],
    ["/akron/part-7-transitions-of-care", /Transitions of Care/i, "Akron General"],
  ]) {
    const response = await render(path);
    assert.equal(response.status, 200);
    const html = await response.text();
    assert.match(html, heading);
    assert.match(html, new RegExp(campus));
    assert.match(html, /2026 orientation source/);
  }
});

test("renamed and concise paths issue permanent canonical redirects", async () => {
  for (const [from, to] of [
    ["/main-campus/documentation-and-quality", "/main-campus/part-6-documentation-and-quality"],
    ["/akron/transitions-of-care", "/akron/part-7-transitions-of-care"],
    ["/main-campus/part-6-documentation-quality", "/main-campus/part-6-documentation-and-quality"],
  ]) {
    const response = await render(from);
    assert.equal(response.status, 308);
    assert.equal(new URL(response.headers.get("location"), "http://localhost").pathname, to);
  }
});

test("renamed and concise redirects preserve arbitrary query parameters", async () => {
  for (const [from, to] of [
    [
      "/main-campus/documentation-and-quality?q=ICH%20%26%20SAH&scope=both&chapter=one&chapter=two&empty=",
      "/main-campus/part-6-documentation-and-quality?q=ICH+%26+SAH&scope=both&chapter=one&chapter=two&empty=",
    ],
    [
      "/akron/transitions-of-care?return=%2Fsearch%3Fq%3Dstroke&type=reference-table",
      "/akron/part-7-transitions-of-care?return=%2Fsearch%3Fq%3Dstroke&type=reference-table",
    ],
  ]) {
    const response = await render(from);
    assert.equal(response.status, 308);
    const location = new URL(response.headers.get("location"), "http://localhost");
    assert.equal(`${location.pathname}${location.search}`, to);
  }
});

test("invalid hospital article paths return a campus-scoped recovery page", async () => {
  const response = await render("/akron/not-a-current-article");
  assert.equal(response.status, 404);
  const html = await response.text();
  assert.match(html, /Akron General/);
  assert.match(html, /recovery/);
  assert.match(html, /<title>Page not found \| Akron General Faculty Wiki/);
  assert.match(html, /not in the current handbook/i);
  assert.match(html, /Likely replacement pages/);
  assert.match(html, /name="scope" value="akron"/);
  assert.match(html, /name="robots" content="noindex, follow"/);
  assert.doesNotMatch(html, /rel="canonical"/);
  assert.doesNotMatch(html, /property="og:url"/);
});

test("nested invalid hospital paths preserve the recognized campus recovery context", async () => {
  for (const [campus, label] of [
    ["main-campus", "Main Campus"],
    ["akron", "Akron General"],
  ]) {
    const response = await render(`/${campus}/not/a/current/article`);
    assert.equal(response.status, 404);
    const html = await response.text();
    assert.match(html, new RegExp(`<title>Page not found \\| ${label} Faculty Wiki`));
    assert.match(html, new RegExp(`name="scope" value="${campus}"`));
    assert.doesNotMatch(html, /rel="canonical"/);
    assert.doesNotMatch(html, /property="og:url"/);
  }
});

test("search route server-renders shareable query and filter state", async () => {
  const response = await render("/search?q=ICH&scope=akron&chapter=stroke-alerts&type=reference-table");
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /value="ICH"/);
  assert.match(html, /value="akron" selected/);
  assert.match(html, /name="chapter"[\s\S]*value="stroke-alerts" selected/);
  assert.match(html, /name="type"[\s\S]*value="reference-table" selected/);
  assert.match(html, /Search \| Neurocritical Care Faculty Wiki/);
});
