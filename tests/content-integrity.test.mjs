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
  assert.equal(mainCampus.stats.sections, 102);
  assert.equal(mainCampus.stats.tables, 60);
  assert.equal(mainCampus.stats.figures, 11);
  assert.equal(akron.stats.sections, 105);
  assert.equal(akron.stats.tables, 73);
  assert.equal(akron.stats.figures, 12);
});

test("main campus remains quarantined while contamination warning is active", () => {
  const [mainCampus, akron] = payload.handbooks;
  assert.equal(mainCampus.sourceStatus.approvalState, "quarantined");
  assert.equal(mainCampus.sourceStatus.quarantine.active, true);
  assert.match(mainCampus.sourceStatus.warning, /Akron General labels and pathways/);
  assert.notEqual(akron.sourceStatus.approvalState, "quarantined");
  assert.equal(Boolean(akron.sourceStatus.quarantine?.active), false);
});

test("curated expansion hubs ship as draft navigational content on both campuses", () => {
  for (const handbook of payload.handbooks) {
    const curated = handbook.sections.filter((section) => section.contentOrigin === "curated");
    assert.equal(curated.length, 23);
    for (const section of curated) {
      assert.equal(section.review.approvalState, "draft");
      assert.ok(section.equivalent?.path);
      assert.ok(section.taxonomyIds.length > 0);
    }
    assert.ok(handbook.sections.some((section) => section.slug === "clinical-domains"));
    assert.ok(handbook.sections.some((section) => section.slug === "neuromonitoring-topic-map"));
  }
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
