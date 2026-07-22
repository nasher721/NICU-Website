import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { buildSearchPath, normalizeSearchState } from "../src/routing/routes.js";
import { rankSearchSuggestions } from "../src/search/rank-results.js";
import { createSearchIndexLoader } from "../src/search/search-index.js";

const sourceUrl = new URL("../src/components/search/", import.meta.url);
const generatedUrl = new URL("../src/data/generated/", import.meta.url);

async function source(name) {
  return readFile(new URL(name, sourceUrl), "utf8");
}

async function index(campus) {
  return JSON.parse(await readFile(new URL(`${campus}.search-index.json`, generatedUrl), "utf8"));
}

test("SearchBox declares the complete combobox relationship and interaction contract", async () => {
  const contents = await source("SearchBox.jsx");
  assert.match(contents, /role="combobox"/);
  assert.match(contents, /aria-autocomplete="list"/);
  assert.match(contents, /aria-controls=\{showPanel \? listboxId : undefined\}/);
  assert.match(contents, /aria-expanded=\{showPanel\}/);
  assert.match(contents, /aria-activedescendant=/);
  assert.match(contents, /role="status" aria-live="polite"/);
  assert.match(contents, /event\.key === "ArrowDown"/);
  assert.match(contents, /event\.key === "ArrowUp"/);
  assert.match(contents, /event\.key === "Enter"/);
  assert.match(contents, /event\.key === "Escape"/);
  assert.match(contents, /document\.addEventListener\("pointerdown"/);
  assert.match(contents, /normalizedQuery\.length < 2/);
  assert.match(contents, /rankSearchSuggestions/);
});

test("suggestions preserve input focus and expose source, campus, type, and chapter labels", async () => {
  const contents = await source("SearchSuggestions.jsx");
  assert.match(contents, /role="listbox"/);
  assert.match(contents, /aria-busy=\{loadState\.status === "loading"\}/);
  assert.doesNotMatch(contents, /\{hasResults && \(\s*<ul/);
  assert.match(contents, /role="option"/);
  assert.match(contents, /aria-selected=\{selected\}/);
  assert.match(contents, /onPointerDown=\{\(event\) => event\.preventDefault\(\)\}/);
  assert.match(contents, /onClick=/);
  assert.match(contents, /result\.context\.text/);
  assert.match(contents, /result\.campusLabel/);
  assert.match(contents, /result\.contentType/);
  assert.match(contents, /result\.chapterTitle/);
});

test("full results keep every filter in a shareable URL and label cross-campus sources", async () => {
  const state = normalizeSearchState({
    q: "ICH",
    scope: "both",
    chapter: "stroke-alerts",
    type: "reference-table",
  });
  assert.equal(
    buildSearchPath(state),
    "/search?q=ICH&scope=both&chapter=stroke-alerts&type=reference-table",
  );
  const contents = await source("SearchResults.jsx");
  for (const field of ["q", "scope", "chapter", "type"]) {
    assert.match(contents, new RegExp(`name="${field}"`));
  }
  assert.match(contents, /result\.campusLabel/);
  assert.match(contents, /result\.context\.ranges/);
  assert.match(contents, /result\.chapterTitle/);
  assert.match(contents, /Search both campuses without changing your saved campus/);
});

test("Both-campus suggestions remain deterministic and capped at six through the UI data path", async () => {
  const raw = {
    "main-campus": await index("main-campus"),
    akron: await index("akron"),
  };
  const loader = createSearchIndexLoader({
    readers: {
      "main-campus": async () => raw["main-campus"],
      akron: async () => raw.akron,
    },
  });
  const loaded = await loader.loadScope({
    scope: "both",
    activeCampus: "main-campus",
    preferredCampus: "main-campus",
  });
  const first = rankSearchSuggestions(loaded.records, "ICH", { preferredCampus: "main-campus" });
  const second = rankSearchSuggestions(loaded.records, "ICH", { preferredCampus: "main-campus" });
  assert.equal(first.length, 6);
  assert.deepEqual(first, second);
  assert.ok(first.every((result) => result.campusLabel && result.context.ranges.length === 1));
});

test("loading failures are retryable without replacing campus contents or direct links", async () => {
  const box = await source("SearchBox.jsx");
  const suggestions = await source("SearchSuggestions.jsx");
  const results = await source("SearchResults.jsx");
  assert.match(box, /const retry = retryNextRequest\.current/);
  assert.match(box, /retryNextRequest\.current = false/);
  assert.match(results, /const retry = retryNextRequest\.current/);
  assert.match(results, /retryNextRequest\.current = false/);
  assert.match(suggestions, /Retry search/);
  assert.match(suggestions, /Campus contents and direct article links remain available/);
  assert.match(results, /Retry search index/);
  assert.match(results, /Use the campus contents or direct article links/);
  assert.match(results, /status === "partial"/);
});
