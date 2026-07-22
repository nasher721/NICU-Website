import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import handbookData from "../src/data/handbooks.json" with { type: "json" };
import akronNavigation from "../src/data/generated/akron.navigation.json" with { type: "json" };
import mainCampusNavigation from "../src/data/generated/main-campus.navigation.json" with { type: "json" };
import {
  buildContentsTree,
  flattenContentsTree,
  getArticleSections,
  groupContentBlocks,
} from "../src/components/wiki/wiki-model.js";

const navigationByCampus = {
  "main-campus": mainCampusNavigation,
  akron: akronNavigation,
};

test("shared contents trees preserve every campus section and parent relationship", () => {
  for (const handbook of handbookData.handbooks) {
    const navigation = navigationByCampus[handbook.id];
    const tree = buildContentsTree(navigation.sections);
    const flattened = flattenContentsTree(tree);

    assert.equal(flattened.length, navigation.sections.length);
    assert.deepEqual(
      flattened.map((item) => item.id).sort(),
      navigation.sections.map((item) => item.id).sort(),
    );
    for (const item of flattened) {
      if (!item.parentId) continue;
      assert.ok(flattened.some((candidate) => candidate.id === item.parentId));
    }
  }
});

test("article grouping preserves block order and consecutive list text", () => {
  const blocks = [
    { type: "paragraph", text: "Before" },
    { type: "list-item", text: "One" },
    { type: "list-item", text: "Two" },
    { type: "table", rows: [["Header"], ["Cell"]] },
    { type: "image", src: "", alt: "Missing source figure" },
    { type: "paragraph", text: "After" },
  ];
  const grouped = groupContentBlocks(blocks);

  assert.deepEqual(grouped.map((block) => block.type), ["paragraph", "list", "table", "image", "paragraph"]);
  assert.deepEqual(grouped[1].items, ["One", "Two"]);
  assert.deepEqual(blocks[1], { type: "list-item", text: "One" });
  assert.equal(grouped[3].alt, "Missing source figure");
});

test("article section expansion remains source ordered and complete", () => {
  for (const handbook of handbookData.handbooks) {
    const selected = handbook.sections.find((section) => section.slug === "appendix-a-smartphrase-library");
    const expanded = getArticleSections(handbook, selected);
    assert.equal(expanded[0].id, selected.id);
    assert.ok(expanded.length > 1);
    assert.ok(expanded.some((section) => section.searchText.includes("smartphrase")));
    assert.ok(expanded.every((section, index) => index === 0 || section.level > selected.level));
  }
});

test("source status metadata stays campus-specific and reviewable", () => {
  for (const handbook of handbookData.handbooks) {
    const navigation = navigationByCampus[handbook.id];
    assert.equal(navigation.campus, handbook.id);
    assert.equal(navigation.sourceStatus.handbookYear, 2026);
    assert.match(navigation.sourceStatus.verifiedOn, /^\d{4}-\d{2}-\d{2}$/);
    assert.match(navigation.sourceStatus.reviewStatus, /review/i);
    assert.ok(navigation.sourceStatus.warning.length > 40);
  }
  assert.match(mainCampusNavigation.sourceStatus.warning, /Akron General labels and pathways/);
});

test("wiki component and stylesheet contracts include accessible drawer and print behavior", async () => {
  const [contentsSource, blocksSource, styles] = await Promise.all([
    readFile(new URL("../src/components/wiki/WikiContents.jsx", import.meta.url), "utf8"),
    readFile(new URL("../src/components/wiki/ContentBlocks.jsx", import.meta.url), "utf8"),
    readFile(new URL("../src/styles.css", import.meta.url), "utf8"),
  ]);

  assert.match(contentsSource, /aria-controls=/);
  assert.match(contentsSource, /aria-expanded=/);
  assert.match(contentsSource, /aria-current=/);
  assert.match(contentsSource, /event\.key === "Escape"/);
  assert.match(contentsSource, /triggerRef\.current\?\.focus/);
  assert.match(blocksSource, /missing-figure/);
  assert.match(blocksSource, /smartphrase-block/);
  assert.match(styles, /@media \(max-width: 390px\)/);
  assert.match(styles, /@media \(min-width: 391px\) and \(max-width: 768px\)/);
  assert.match(styles, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(styles, /@media print/);
  assert.match(styles, /overflow-x:\s*auto/);
});
