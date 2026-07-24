import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { legacyHashDestination, legacyHashToPath } from "../src/routing/legacy-hash.js";
import {
  appendSearchParams,
  buildSearchPath,
  metadataForRoute,
  metadataForNotFound,
  normalizeSearchState,
  resolveHospitalPath,
  routeManifest,
} from "../src/routing/routes.js";

test("real campus URLs are authoritative and resolve canonical articles", () => {
  assert.deepEqual(resolveHospitalPath("/main-campus"), {
    kind: "campus",
    pathname: "/main-campus",
    campus: "main-campus",
  });
  assert.deepEqual(resolveHospitalPath("/akron"), {
    kind: "campus",
    pathname: "/akron",
    campus: "akron",
  });

  const mainArticle = resolveHospitalPath("/main-campus/part-6-documentation-and-quality");
  const akronArticle = resolveHospitalPath("/akron/part-7-transitions-of-care");
  assert.equal(mainArticle.kind, "article");
  assert.equal(mainArticle.campus, "main-campus");
  assert.equal(akronArticle.kind, "article");
  assert.equal(akronArticle.campus, "akron");
  assert.match(metadataForRoute(mainArticle).title, /Main Campus Faculty Wiki/);
  assert.match(metadataForRoute(akronArticle).title, /Akron General Faculty Wiki/);
});

test("reviewed and convenience paths resolve only through manifest redirects", () => {
  for (const redirect of routeManifest.redirects) {
    const route = resolveHospitalPath(redirect.from);
    assert.equal(route.kind, "redirect");
    assert.equal(route.destination, redirect.to);
    assert.equal(route.stableId, redirect.stableId);
    assert.equal(route.redirectKind, redirect.kind);
  }
  assert.equal(resolveHospitalPath("/main-campus/not-a-real-article").kind, "not-found");
  assert.equal(resolveHospitalPath("/unknown-campus/topic").campus, null);
  assert.equal(resolveHospitalPath("/akron/not/a/current/article").campus, "akron");
  assert.equal(resolveHospitalPath("/main-campus/not/a/current/article").campus, "main-campus");
});

test("curated expansion hubs resolve on both campuses", () => {
  for (const campus of ["main-campus", "akron"]) {
    for (const slug of ["clinical-domains", "procedures-and-devices", "campus-operations", "neuromonitoring-topic-map"]) {
      const route = resolveHospitalPath(`/${campus}/${slug}`);
      assert.equal(route.kind, "article");
      assert.equal(route.campus, campus);
      assert.equal(route.slug, slug);
    }
  }
});

test("legacy hash URLs migrate to safe real paths", () => {
  assert.equal(legacyHashToPath("#/wiki", "akron"), "/akron");
  assert.equal(
    legacyHashToPath("#/wiki/main-campus/critical-contacts", "akron"),
    "/main-campus/critical-contacts",
  );
  assert.equal(legacyHashToPath("#/wiki/akron/transitions-of-care"), "/akron/transitions-of-care");
  assert.equal(legacyHashToPath("#/wiki/figures"), "/figures");
  assert.equal(legacyHashToPath("#/something-else"), null);
  assert.equal(legacyHashToPath("#/wiki/%E0%A4%A"), null);
  assert.equal(legacyHashToPath("#/wiki/akron/topic/unexpected"), null);
  assert.equal(legacyHashToPath("#/wiki/unknown-campus/topic"), null);
  assert.equal(legacyHashToPath("#/wiki//akron"), null);
  assert.equal(
    legacyHashDestination("/", "#/wiki/main-campus/critical-contacts", "akron"),
    "/main-campus/critical-contacts",
  );
  assert.equal(
    legacyHashDestination("/akron", "#/wiki/main-campus/critical-contacts", "akron"),
    null,
  );
  assert.equal(legacyHashDestination("/main-campus", "#/wiki/akron", "akron"), null);
});

test("canonical redirects preserve every incoming query value", () => {
  assert.equal(
    appendSearchParams("/akron/part-7-transitions-of-care", {
      q: "ICH & SAH",
      scope: "both",
      chapter: ["one", "two"],
      empty: "",
    }),
    "/akron/part-7-transitions-of-care?q=ICH+%26+SAH&scope=both&chapter=one&chapter=two&empty=",
  );
  assert.equal(
    appendSearchParams("/main-campus/part-6-documentation-and-quality", new URLSearchParams([
      ["filter", "notes"],
      ["filter", "quality"],
    ])),
    "/main-campus/part-6-documentation-and-quality?filter=notes&filter=quality",
  );
});

test("invalid hospital articles emit campus-specific noindex metadata without canonical URLs", () => {
  for (const campus of ["main-campus", "akron"]) {
    const metadata = metadataForNotFound(campus);
    assert.match(metadata.title, /Page not found/);
    assert.equal(metadata.robots.index, false);
    assert.deepEqual(metadata.alternates, {});
    assert.equal(Object.hasOwn(metadata.openGraph, "url"), false);
    assert.match(metadata.openGraph.title, /Page not found/);
  }
});

test("search query and filter state round-trips through the URL", () => {
  const state = normalizeSearchState({
    q: " ICH ",
    scope: "akron",
    chapter: "stroke-alerts",
    type: "reference-table",
  });
  assert.deepEqual(state, {
    q: "ICH",
    scope: "akron",
    chapter: "stroke-alerts",
    type: "reference-table",
  });
  assert.equal(
    buildSearchPath(state),
    "/search?q=ICH&scope=akron&chapter=stroke-alerts&type=reference-table",
  );
  assert.equal(normalizeSearchState({ scope: "invalid" }).scope, "main-campus");
  assert.equal(normalizeSearchState({ scope: "both" }).scope, "both");
});

test("application navigation no longer uses hash routing as its source of truth", async () => {
  const source = await readFile(new URL("../src/App.jsx", import.meta.url), "utf8");
  assert.doesNotMatch(source, /window\.location\.hash|hashchange|href=["']#\/wiki/);
  assert.match(source, /href="\/main-campus"/);
  assert.match(source, /window\.location\.assign\(campusUrl/);
});

test("campus recovery routes use navigation metadata without loading handbook content", async () => {
  const source = await readFile(new URL("../src/routing/RoutePages.jsx", import.meta.url), "utf8");
  assert.match(source, /const navigation = await loadCampusNavigation\(campus\);\n\s\sreturn <FacultyWiki route=\{\{ kind: "not-found"/);
  assert.doesNotMatch(source, /HospitalNotFoundRoute[\s\S]*?loadCampusHandbook\(campus\)/);
  const app = await readFile(new URL("../src/App.jsx", import.meta.url), "utf8");
  assert.match(app, /navigation\.sections\.filter\(\(section\) => section\.level === 1\)/);
  assert.match(app, /const FigurePreview = lazy\(\(\) => import\("\.\/components\/wiki\/FigurePreview\.jsx"\)\)/);
});
