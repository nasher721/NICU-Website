import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const payload = JSON.parse(
  await readFile(new URL("../src/data/handbooks.json", import.meta.url), "utf8"),
);

test("both supplied handbooks are represented", () => {
  assert.deepEqual(
    payload.handbooks.map((handbook) => handbook.id),
    ["main-campus", "akron"],
  );
});

test("the full source structure is retained", () => {
  const [mainCampus, akron] = payload.handbooks;
  assert.equal(mainCampus.stats.sections, 79);
  assert.equal(mainCampus.stats.tables, 49);
  assert.equal(mainCampus.stats.figures, 11);
  assert.equal(akron.stats.sections, 82);
  assert.equal(akron.stats.tables, 62);
  assert.equal(akron.stats.figures, 12);
});

test("high-value clinical sections remain searchable", () => {
  for (const handbook of payload.handbooks) {
    const corpus = handbook.sections.map((section) => section.searchText).join(" ");
    for (const phrase of ["first shift", "stroke alert", "documentation", "transitions of care", "smartphrase"]) {
      assert.ok(corpus.includes(phrase), `${handbook.id} is missing ${phrase}`);
    }
  }
});

test("all source figures point to extracted media", async () => {
  for (const handbook of payload.handbooks) {
    for (const section of handbook.sections) {
      for (const block of section.blocks) {
        if (block.type === "image") {
          assert.match(block.src, /^\/handbook-media\/[a-z0-9.-]+$/i);
          await access(new URL(`../public${block.src}`, import.meta.url));
        }
      }
    }
  }
});

test("every audited source image is represented in the wiki data", () => {
  const figureCounts = Object.fromEntries(payload.handbooks.map((handbook) => [handbook.id, handbook.stats.figures]));
  assert.deepEqual(figureCounts, { "main-campus": 11, akron: 12 });
});
