import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  BOTH_CAMPUSES,
  createSearchIndexLoader,
  loadCampusSearchIndex,
  normalizeCampusIndex,
  SEARCH_INDEX_URLS,
} from "../src/search/search-index.js";
import {
  createMatchContext,
  getNoResultsRecovery,
  normalizeSearchQuery,
  rankSearchResults,
  rankSearchSuggestions,
} from "../src/search/rank-results.js";

const generatedUrl = new URL("../src/data/generated/", import.meta.url);
const metadata = JSON.parse(
  await readFile(new URL("../src/data/wiki-metadata.json", import.meta.url), "utf8"),
);

async function readIndex(campus) {
  return JSON.parse(await readFile(new URL(`${campus}.search-index.json`, generatedUrl), "utf8"));
}

function record(overrides = {}) {
  const campus = overrides.campus ?? "main-campus";
  const id = overrides.id ?? `${campus}-fixture`;
  return {
    id,
    campus,
    campusLabel: campus === "akron" ? "Akron General" : "Main Campus",
    title: "Fixture topic",
    slug: id,
    path: `/${campus}/${id}`,
    parentId: null,
    parentSlug: null,
    contentType: "article",
    priority: 0,
    heading: "fixture topic",
    parentHeading: "",
    body: "",
    aliases: [],
    chapterId: `${campus}-chapter`,
    chapterSlug: "fixture-chapter",
    chapterTitle: "Fixture chapter",
    ...overrides,
  };
}

test("campus indexes normalize without mutating source records and derive root chapters", async () => {
  const raw = await readIndex("main-campus");
  const before = JSON.stringify(raw);
  const normalized = normalizeCampusIndex(raw, "main-campus");
  assert.equal(JSON.stringify(raw), before);
  assert.ok(Object.isFrozen(normalized));
  assert.ok(Object.isFrozen(normalized.records));
  assert.equal(normalized.records.length, 102);
  for (const item of normalized.records) {
    assert.equal(item.campus, "main-campus");
    assert.equal(item.campusLabel, "Main Campus");
    assert.ok(item.chapterId && item.chapterSlug && item.chapterTitle);
  }
  const nested = normalized.records.find((item) => item.parentId);
  assert.notEqual(nested.chapterId, nested.id);
});

test("the default loader fetches the packaged campus index URL independently", async () => {
  const originalFetch = globalThis.fetch;
  const requests = [];
  globalThis.fetch = async (url) => {
    requests.push(url);
    return {
      ok: true,
      json: () => readIndex("main-campus"),
    };
  };
  try {
    const index = await loadCampusSearchIndex("main-campus", { retry: true });
    assert.equal(index.campus, "main-campus");
    assert.equal(index.records.length, 102);
    assert.deepEqual(requests, [SEARCH_INDEX_URLS["main-campus"]]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("Both campuses loads the second index only after scope expansion and reuses the first", async () => {
  const calls = [];
  const raw = {
    "main-campus": await readIndex("main-campus"),
    akron: await readIndex("akron"),
  };
  const loader = createSearchIndexLoader({
    readers: {
      "main-campus": async () => {
        calls.push("main-campus");
        return raw["main-campus"];
      },
      akron: async () => {
        calls.push("akron");
        return raw.akron;
      },
    },
  });

  const campusOnly = await loader.loadScope({ activeCampus: "main-campus" });
  assert.equal(campusOnly.scope, "main-campus");
  assert.deepEqual(calls, ["main-campus"]);
  assert.equal(campusOnly.records.length, 102);

  const both = await loader.loadScope({
    scope: BOTH_CAMPUSES,
    activeCampus: "main-campus",
    preferredCampus: "main-campus",
  });
  assert.deepEqual(calls, ["main-campus", "akron"]);
  assert.equal(both.status, "ready");
  assert.deepEqual(both.campuses, ["main-campus", "akron"]);
  assert.equal(both.records.length, 207);
  assert.ok(both.records.every((item) => item.campusLabel));

  loader.clear();
  calls.length = 0;
  const preferredOnly = await loader.loadScope({ preferredCampus: "akron" });
  assert.equal(preferredOnly.scope, "akron");
  assert.deepEqual(calls, ["akron"]);
  assert.equal(preferredOnly.records.length, 105);
});

test("index failures are retryable and preserve the campus that loaded", async () => {
  const mainCampus = await readIndex("main-campus");
  const akron = await readIndex("akron");
  let mainAttempts = 0;
  let akronAttempts = 0;
  const loader = createSearchIndexLoader({
    readers: {
      "main-campus": async () => {
        mainAttempts += 1;
        return mainCampus;
      },
      akron: async () => {
        akronAttempts += 1;
        if (akronAttempts === 1) throw new Error("Akron index unavailable");
        return akron;
      },
    },
  });

  const partial = await loader.loadScope({ scope: BOTH_CAMPUSES, preferredCampus: "main-campus" });
  assert.equal(partial.status, "partial");
  assert.equal(partial.retryable, true);
  assert.equal(partial.records.length, 102);
  assert.deepEqual(partial.errors, [{ campus: "akron", message: "Akron index unavailable" }]);

  const recovered = await loader.loadScope({ scope: BOTH_CAMPUSES, preferredCampus: "main-campus" });
  assert.equal(recovered.status, "ready");
  assert.equal(recovered.records.length, 207);
  assert.equal(mainAttempts, 1);
  assert.equal(akronAttempts, 2);
});

test("explicit retry can still reload every campus index", async () => {
  const mainCampus = await readIndex("main-campus");
  const akron = await readIndex("akron");
  const calls = [];
  const loader = createSearchIndexLoader({
    readers: {
      "main-campus": async () => {
        calls.push("main-campus");
        return mainCampus;
      },
      akron: async () => {
        calls.push("akron");
        return akron;
      },
    },
  });

  await loader.loadScope({ scope: BOTH_CAMPUSES, preferredCampus: "main-campus" });
  await loader.loadScope({ scope: BOTH_CAMPUSES, preferredCampus: "main-campus", retry: true });
  assert.deepEqual(calls, ["main-campus", "akron", "main-campus", "akron"]);
});

test("ranking enforces exact title, alias, heading, curated priority, then body", () => {
  const records = [
    record({ id: "body", title: "General topic", heading: "general topic", body: "stroke source passage" }),
    record({ id: "priority", title: "Priority topic", heading: "priority topic", body: "stroke source passage", priority: 100 }),
    record({ id: "heading", title: "Stroke pathways", heading: "stroke pathways", body: "source passage" }),
    record({ id: "alias", title: "Cerebrovascular care", heading: "cerebrovascular care", body: "source passage", aliases: ["stroke"] }),
    record({ id: "exact", title: "Stroke!", heading: "stroke", body: "source passage", priority: 0 }),
    record({ id: "unrelated", title: "Unrelated", heading: "unrelated", body: "nothing here", priority: 999 }),
  ];
  const results = rankSearchResults(records, " stroke ");
  assert.deepEqual(results.map((item) => item.id), ["exact", "alias", "heading", "priority", "body"]);
  assert.deepEqual(results.map((item) => item.match.kind), [
    "exact-title",
    "reviewed-alias",
    "heading",
    "curated-priority",
    "body",
  ]);
});

test("reviewed acronym searches resolve against real campus indexes with labeled source context", async () => {
  const loader = createSearchIndexLoader({
    readers: {
      "main-campus": () => readIndex("main-campus"),
      akron: () => readIndex("akron"),
    },
  });
  const scope = await loader.loadScope({ scope: BOTH_CAMPUSES, preferredCampus: "main-campus" });
  const results = rankSearchSuggestions(scope.records, "ICH", { preferredCampus: "main-campus" });
  assert.equal(results.length, 6);
  assert.ok(results.every((item) => item.match.kind === "reviewed-alias"));
  assert.ok(results.every((item) => item.campusLabel && item.context.ranges.length > 0));
  assert.ok(results.some((item) => item.campus === "main-campus"));
  const completeResults = rankSearchResults(scope.records, "ICH", { limit: 30 });
  assert.ok(completeResults.some((item) => item.campus === "main-campus"));
  assert.ok(completeResults.some((item) => item.campus === "akron"));
});

test("expanded neuro ICU aliases are available in editorial metadata", () => {
  const terms = new Set(metadata.aliases.map((alias) => alias.term));
  for (const term of ["SE", "ICP", "TTM", "DCI", "EVT", "LVO", "aSAH"]) {
    assert.ok(terms.has(term), `missing alias ${term}`);
  }
  assert.ok(metadata.equivalents.some((item) => item.slug === "clinical-domains"));
});

test("preferred campus only breaks otherwise equal scores and every result stays labeled", () => {
  const records = [
    record({ id: "main", campus: "main-campus", body: "shared workflow" }),
    record({ id: "akron", campus: "akron", body: "shared workflow" }),
    record({ id: "stronger", campus: "main-campus", body: "shared workflow shared workflow" }),
  ];
  const results = rankSearchResults(records, "shared workflow", { preferredCampus: "akron" });
  assert.equal(results[0].id, "stronger", "preferred campus cannot override a stronger score");
  assert.deepEqual(results.slice(1).map((item) => item.id), ["akron", "main"]);
  assert.deepEqual(results.map((item) => item.campusLabel), ["Main Campus", "Akron General", "Main Campus"]);
});

test("campus, chapter, and content-type filters compose without changing source records", () => {
  const records = [
    record({ id: "mc-table", campus: "main-campus", chapterId: "docs", chapterSlug: "documentation", contentType: "reference-table", body: "billing workflow" }),
    record({ id: "mc-article", campus: "main-campus", chapterId: "docs", chapterSlug: "documentation", contentType: "article", body: "billing workflow" }),
    record({ id: "ak-table", campus: "akron", chapterId: "ak-docs", chapterSlug: "documentation", contentType: "reference-table", body: "billing workflow" }),
  ];
  const before = structuredClone(records);
  const results = rankSearchResults(records, "billing", {
    campus: "main-campus",
    chapter: "documentation",
    contentType: "reference-table",
  });
  assert.deepEqual(results.map((item) => item.id), ["mc-table"]);
  assert.deepEqual(records, before);
});

test("suggestions require two characters, cap at six, and are deterministic", () => {
  const records = Array.from({ length: 9 }, (_, index) => record({
    id: `stroke-${index}`,
    title: `Stroke topic ${index}`,
    heading: `stroke topic ${index}`,
  }));
  assert.deepEqual(rankSearchSuggestions(records, "s"), []);
  const first = rankSearchSuggestions(records, "stroke");
  const second = rankSearchSuggestions(records, "stroke");
  assert.equal(first.length, 6);
  assert.deepEqual(first, second);
});

test("contexts expose plain source text and safe highlight ranges rather than markup", () => {
  const item = record({
    title: "Security-sensitive source",
    body: "prefix words <script>alert patient</script> trailing source words",
  });
  const context = createMatchContext(item, "script", { maxLength: 48 });
  assert.equal("html" in context, false);
  assert.equal(context.sourceField, "body");
  assert.equal(context.ranges.length, 1);
  const [{ start, end }] = context.ranges;
  assert.equal(context.text.slice(start, end), "script");
  assert.ok(start >= 0 && end <= context.text.length);
});

test("contexts follow the winning match field instead of unrelated reviewed aliases", () => {
  const item = record({
    title: "Intracerebral hemorrhage pathway",
    heading: "Intracerebral hemorrhage pathway",
    body: "An unrelated EVD passage must not become the context for this result.",
    aliases: ["ICH", "EVD"],
  });
  const [result] = rankSearchResults([item], "ICH");
  assert.equal(result.match.kind, "reviewed-alias");
  assert.equal(result.match.term, "ICH");
  assert.equal(result.context.sourceField, "reviewed-alias");
  const [{ start, end }] = result.context.ranges;
  assert.equal(result.context.text.slice(start, end), "ICH");
  assert.doesNotMatch(result.context.text, /EVD/);
});

test("normalized Unicode and punctuation matches retain exact source offsets", () => {
  const item = record({
    title: "Reference topic",
    heading: "Reference topic",
    body: "Open the Café—Stroke‑Alert pathway before calling transport.",
  });
  const [result] = rankSearchResults([item], "cafe stroke alert");
  assert.equal(result.context.sourceField, "body");
  const [{ start, end }] = result.context.ranges;
  const highlightedSource = result.context.text.slice(start, end);
  assert.equal(highlightedSource, "Café—Stroke‑Alert");
  assert.equal(normalizeSearchQuery(highlightedSource), "cafe stroke alert");

  const decomposed = record({
    id: "decomposed",
    title: "Other topic",
    heading: "Other topic",
    body: "Use Cafe\u0301 protocol.",
  });
  const decomposedContext = createMatchContext(decomposed, "café");
  const [decomposedRange] = decomposedContext.ranges;
  assert.equal(decomposedContext.text.slice(decomposedRange.start, decomposedRange.end), "Cafe\u0301");
});

test("reviewed aliases and nearby indexed titles provide deterministic no-results recovery", () => {
  const records = [
    record({
      id: "ich-workflow",
      title: "Intracerebral Hemorrhage Workflow",
      heading: "intracerebral hemorrhage workflow",
      aliases: ["ICH", "intracerebral hemorrhage"],
    }),
    record({ id: "stroke-alert", title: "Stroke Alert", heading: "stroke alert" }),
  ];
  assert.deepEqual(rankSearchResults(records, "intracerebral hemorhage"), []);
  const first = getNoResultsRecovery(records, "intracerebral hemorhage", {
    reviewedAliases: metadata.aliases,
    campus: "main-campus",
  });
  const second = getNoResultsRecovery(records, "intracerebral hemorhage", {
    reviewedAliases: metadata.aliases,
    campus: "main-campus",
  });
  assert.deepEqual(first, second);
  assert.ok(first.aliasAlternatives.some((item) => item.term === "ICH"));
  assert.ok(first.spellingAlternatives.includes("intracerebral hemorrhage"));
  assert.equal(first.nearbyTopics[0].id, "ich-workflow");
  assert.equal(first.nearbyTopics[0].title, "Intracerebral Hemorrhage Workflow");
});

test("malformed and empty queries fail closed", () => {
  const records = [record({ body: "stroke" })];
  for (const value of [null, undefined, {}, [], "", "   ", "x"]) {
    assert.equal(normalizeSearchQuery(value).length <= 1, true);
    assert.deepEqual(rankSearchResults(records, value), []);
  }
});

test("invalid index parent relationships and campus mismatches are rejected", async () => {
  const raw = await readIndex("main-campus");
  const missingParent = structuredClone(raw);
  missingParent.records[1].parentId = "missing";
  assert.throws(() => normalizeCampusIndex(missingParent, "main-campus"), /missing parent/);
  assert.throws(() => normalizeCampusIndex(raw, "akron"), /Invalid search index/);
});
