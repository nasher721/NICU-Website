import assert from "node:assert/strict";

const workerUrl = new URL(`../dist/server/index.js?build=${Date.now()}`, import.meta.url);
const { default: worker } = await import(workerUrl);
const seen = [];
const env = {
  ASSETS: {
    fetch(request) {
      seen.push(new URL(request.url).pathname);
      return new Response("ok", { status: 200 });
    },
  },
};

assert.equal((await worker.fetch(new Request("https://example.test/"), env)).status, 200);
assert.equal((await worker.fetch(new Request("https://example.test/wiki/article"), env)).status, 200);
assert.equal((await worker.fetch(new Request("https://example.test/assets/app.js"), env)).status, 200);
assert.deepEqual(seen, ["/index.html", "/index.html", "/assets/app.js"]);
