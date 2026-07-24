"use client";

import { lazy, Suspense, useEffect, useState } from "react";
import Brand from "./components/Brand.jsx";
import HospitalWikiHome from "./components/wiki/HospitalWikiHome.jsx";
import WikiContents from "./components/wiki/WikiContents.jsx";
import { titleWithoutPart } from "./components/wiki/wiki-model.js";
import {
  CAMPUS_PREFERENCE_KEY,
  DEFAULT_CAMPUS,
  articlePath,
  buildSearchPath,
  campusHomePath,
  CAMPUS_SUMMARIES,
} from "./routing/routes.js";

const SOURCE_WARNING =
  "Operational contacts, schedules, policies, and pathways can change. Confirm time-sensitive details in current Cleveland Clinic systems.";

const ArticlePage = lazy(() => import("./components/wiki/ArticlePage.jsx"));
const FiguresPage = lazy(() => import("./components/wiki/FiguresPage.jsx"));
const FigurePreview = lazy(() => import("./components/wiki/FigurePreview.jsx"));
const SearchResults = lazy(() => import("./components/search/SearchResults.jsx"));
const searchBoxModule = import("./components/search/SearchBox.jsx");
const SearchBox = lazy(() => searchBoxModule);

const figureLoaders = Object.freeze({
  "main-campus": () => import("./data/generated/main-campus.figures.json"),
  akron: () => import("./data/generated/akron.figures.json"),
});

function campusUrl(campus, slug = "") {
  return articlePath(campus, slug);
}

function WikiSkeleton({ label = "Loading…" }) {
  return (
    <main className="wiki-main" id="wiki-content" aria-busy="true" aria-live="polite">
      <p className="sr-only">{label}</p>
      <div className="wiki-skeleton" aria-hidden="true">
        <span className="wiki-skeleton-line title" />
        <span className="wiki-skeleton-line lede" />
        <span className="wiki-skeleton-line" />
        <span className="wiki-skeleton-line short" />
        <span className="wiki-skeleton-line" />
        <span className="wiki-skeleton-line lede" />
      </div>
    </main>
  );
}

function WikiHeader({ handbooks, activeCampus, onCampusChange, searchState }) {
  return (
    <header className="wiki-header">
      <div className="wiki-branding">
        <Brand compact />
        <a className="wiki-title" href={campusHomePath(activeCampus)}>
          <span>Faculty Wiki</span>
          <small>Orientation · 2026</small>
        </a>
      </div>
      <Suspense fallback={<div className="wiki-search search-combobox" aria-hidden="true" />}>
        <SearchBox
          activeCampus={activeCampus}
          initialQuery={searchState?.q ?? ""}
          initialScope={searchState?.scope ?? activeCampus}
        />
      </Suspense>
      <label className="campus-picker">
        <span>Campus</span>
        <select value={activeCampus} onChange={(event) => onCampusChange(event.target.value)}>
          {handbooks.map((handbook) => <option key={handbook.id} value={handbook.id}>{handbook.name}</option>)}
        </select>
      </label>
    </header>
  );
}

function SourcesPage({ handbooks }) {
  return (
    <main className="wiki-main sources-page" id="wiki-content">
      <div className="wiki-breadcrumbs"><a href="/main-campus">Faculty Wiki</a><span>/</span><span>Sources</span></div>
      <p className="eyebrow">Source library</p>
      <h1>About this faculty wiki</h1>
      <p className="wiki-lede">This site converts the supplied 2026 Word handbooks into a searchable, cross-campus neuro ICU reference while preserving source language, tables, and figures. Curated expansion hubs can grow the catalog without inventing clinical answers.</p>
      <div className="source-grid expanded">
        {handbooks.map((source) => (
          <a href={campusUrl(source.id)} key={source.id}>
            <span className="campus-monogram">{source.shortName}</span>
            <div><strong>{source.sourceLabel}</strong><p>{source.sourceFile}</p><small>{source.stats.sections} sections · {source.stats.tables} tables · {source.stats.figures} figures</small></div>
            <span aria-hidden="true">↗</span>
          </a>
        ))}
      </div>
      <a className="source-figures-link" href="/figures">Browse every source figure <span aria-hidden="true">↗</span></a>
      <section className="editorial-policy">
        <h2>How to use it</h2>
        <div><strong>Search broadly</strong><p>The search bar checks headings, prose, lists, and reference tables across both campuses.</p></div>
        <div><strong>Check the campus</strong><p>Every article identifies its source campus. Main Campus remains quarantined while Akron General language is still present in that source file.</p></div>
        <div><strong>Verify live operations</strong><p>{SOURCE_WARNING}</p></div>
      </section>
    </main>
  );
}

function RouteAnnouncer({ message, routeKey }) {
  const [announcement, setAnnouncement] = useState("");
  useEffect(() => {
    setAnnouncement(message);
  }, [message, routeKey]);
  return <p className="sr-only" role="status" aria-live="polite" aria-atomic="true">{announcement}</p>;
}

function SearchPreferenceSync({ search, scopeExplicit }) {
  useEffect(() => {
    if (scopeExplicit) return;
    let preferredCampus = DEFAULT_CAMPUS;
    try {
      preferredCampus = window.localStorage.getItem(CAMPUS_PREFERENCE_KEY) || DEFAULT_CAMPUS;
    } catch {
      // Preference storage is optional.
    }
    window.location.replace(buildSearchPath({ ...search, scope: preferredCampus }));
  }, [scopeExplicit, search]);
  return null;
}

function HospitalNotFound({ handbook, navigation }) {
  const likelySections = navigation.sections.filter((section) => section.level === 1).slice(0, 5);
  return (
    <main className="wiki-main sources-page" id="wiki-content">
      <div className="wiki-breadcrumbs"><a href={campusHomePath(handbook.id)}>Faculty Wiki</a><span>/</span><span>Page not found</span></div>
      <p className="eyebrow">{handbook.name} recovery</p>
      <h1>This article path is not in the current handbook.</h1>
      <p className="wiki-lede">The section may have been renamed. Search this hospital or return to its contents; direct article navigation remains available.</p>
      <form className="wiki-search" action="/search" method="get" role="search">
        <label className="sr-only" htmlFor={`recovery-search-${handbook.id}`}>Search {handbook.name}</label>
        <input id={`recovery-search-${handbook.id}`} name="q" type="search" placeholder={`Search ${handbook.name}…`} />
        <input type="hidden" name="scope" value={handbook.id} />
        <button type="submit">Search</button>
      </form>
      <section className="browse-section" aria-labelledby="recovery-heading">
        <div className="section-heading"><div><p className="eyebrow">Current contents</p><h2 id="recovery-heading">Likely replacement pages</h2></div></div>
        <div className="chapter-list">
          {likelySections.map((section, index) => (
            <a href={campusUrl(handbook.id, section.slug)} key={section.slug}>
              <span className="chapter-index">{String(index + 1).padStart(2, "0")}</span>
              <div><strong>{titleWithoutPart(section.title)}</strong><small>Open the current source section</small></div>
              <span aria-hidden="true">↗</span>
            </a>
          ))}
        </div>
      </section>
      <a className="source-figures-link" href={campusHomePath(handbook.id)}>Return to {handbook.name} contents <span aria-hidden="true">↗</span></a>
    </main>
  );
}

function DeferredFigurePreview({ handbook }) {
  const [figures, setFigures] = useState(null);

  useEffect(() => {
    let cancelled = false;
    const load = figureLoaders[handbook.id];
    if (!load) {
      setFigures([]);
      return undefined;
    }
    load()
      .then((module) => {
        if (!cancelled) setFigures(module.default?.figures ?? module.figures ?? []);
      })
      .catch(() => {
        if (!cancelled) setFigures([]);
      });
    return () => {
      cancelled = true;
    };
  }, [handbook.id]);

  if (figures === null) {
    return <section className="figures-preview" aria-live="polite"><div className="wiki-skeleton"><span className="wiki-skeleton-line title" /><span className="wiki-skeleton-line" /><span className="wiki-skeleton-line short" /></div></section>;
  }

  return (
    <Suspense fallback={<section className="figures-preview" aria-live="polite"><div className="wiki-skeleton"><span className="wiki-skeleton-line title" /><span className="wiki-skeleton-line" /></div></section>}>
      <FigurePreview handbook={handbook} figures={figures} />
    </Suspense>
  );
}

export function GlobalNotFoundPage() {
  return (
    <div className="wiki-shell">
      <a className="skip-link wiki-skip" href="#wiki-content">Skip to recovery</a>
      <header className="wiki-header">
        <div className="wiki-branding">
          <Brand compact />
          <a className="wiki-title" href="/">
            <span>Faculty Wiki</span>
            <small>Recovery</small>
          </a>
        </div>
        <nav className="campus-picker" aria-label="Campus recovery links">
          <span>Browse a campus</span>
          {CAMPUS_SUMMARIES.map((campus) => (
            <a key={campus.id} href={campusHomePath(campus.id)}>{campus.name}</a>
          ))}
        </nav>
      </header>
      <main className="wiki-main sources-page" id="wiki-content">
        <div className="wiki-breadcrumbs"><a href="/">Faculty wikis</a><span>/</span><span>Recovery</span></div>
        <p className="eyebrow">Faculty wiki recovery</p>
        <h1>We couldn’t find that page.</h1>
        <p className="wiki-lede">This article path is not in the current handbook. Choose a campus, search the source content, or return to the landing page.</p>
        <form className="wiki-search" action="/search" method="get" role="search">
          <label className="sr-only" htmlFor="global-recovery-search">Search the faculty handbooks</label>
          <input id="global-recovery-search" name="q" type="search" placeholder="Search both campuses…" />
          <input type="hidden" name="scope" value="main-campus" />
          <button type="submit">Search</button>
        </form>
        <section className="browse-section" aria-labelledby="global-recovery-heading">
          <div className="section-heading"><div><p className="eyebrow">Current contents</p><h2 id="global-recovery-heading">Open a campus homepage</h2></div></div>
          <div className="chapter-list">
            {CAMPUS_SUMMARIES.map((campus, index) => (
              <a href={campusHomePath(campus.id)} key={campus.id}>
                <span className="chapter-index">{String(index + 1).padStart(2, "0")}</span>
                <div><strong>{campus.name}</strong><small>Browse the current source contents</small></div>
                <span aria-hidden="true">↗</span>
              </a>
            ))}
          </div>
        </section>
        <a className="source-figures-link" href="/">Return to the landing page <span aria-hidden="true">↗</span></a>
      </main>
      <footer className="wiki-footer"><span>Neurocritical Care Faculty Wiki</span><span>Recovery page</span><a href="/">Return to landing page</a></footer>
    </div>
  );
}

function WikiApp({ route, handbook, navigation, figureIndexes = [] }) {
  const handbooks = CAMPUS_SUMMARIES;
  const requestedCampus = route.campus;
  const searchCampus = route.search?.scope;
  const activeCampus = handbooks.some((item) => item.id === requestedCampus)
    ? requestedCampus
    : handbooks.some((item) => item.id === searchCampus)
      ? searchCampus
      : DEFAULT_CAMPUS;
  const slug = route.slug;
  const selected = handbook.sections?.find((section) => section.slug === slug);

  const navigate = (campus, nextSlug = "") => {
    try {
      window.localStorage.setItem(CAMPUS_PREFERENCE_KEY, campus);
    } catch {
      // Explicit URL navigation remains authoritative when storage is unavailable.
    }
    window.location.assign(campusUrl(campus, nextSlug));
  };

  useEffect(() => {
    if (!["campus", "article", "not-found"].includes(route.kind)) return;
    try {
      window.localStorage.setItem(CAMPUS_PREFERENCE_KEY, activeCampus);
    } catch {
      // Preference storage is optional and never changes the explicit route.
    }
  }, [activeCampus, route.kind]);

  const routeKey = `${route.kind}:${activeCampus}:${slug || ""}:${route.search?.q || ""}`;
  const announcement = selected
    ? `${titleWithoutPart(selected.title)} loaded for ${handbook.name}`
    : route.kind === "not-found"
      ? `${handbook.name} article not found`
      : route.kind === "search"
        ? "Faculty wiki search loaded"
        : `${handbook.name} faculty wiki loaded`;

  return (
    <div className="wiki-shell">
      {route.kind === "search" && <SearchPreferenceSync search={route.search} scopeExplicit={route.scopeExplicit} />}
      <RouteAnnouncer message={announcement} routeKey={routeKey} />
      <a className="skip-link wiki-skip" href="#wiki-content">Skip to article</a>
      <WikiHeader
        handbooks={handbooks}
        activeCampus={activeCampus}
        onCampusChange={navigate}
        searchState={route.search}
      />
      <div className="wiki-body">
        <WikiContents
          handbook={handbook}
          navigation={navigation}
          selectedSlug={selected?.slug}
          utilityPage={["figures", "sources", "search"].includes(route.kind) ? route.kind : undefined}
        />
        {route.kind === "sources" ? <SourcesPage handbooks={handbooks} />
          : route.kind === "figures" ? (
            <Suspense fallback={<WikiSkeleton label="Loading source figures…" />}>
              <FiguresPage handbooks={handbooks} figureIndexes={figureIndexes} />
            </Suspense>
          )
              : route.kind === "search" ? (
                <Suspense fallback={<WikiSkeleton label="Loading search results…" />}>
                  <SearchResults activeCampus={activeCampus} search={route.search} />
                </Suspense>
              )
              : route.kind === "not-found" ? <HospitalNotFound handbook={handbook} navigation={navigation} />
                : selected ? (
                  <Suspense fallback={<WikiSkeleton label="Loading source article…" />}>
                    <ArticlePage handbook={handbook} navigation={navigation} section={selected} />
                  </Suspense>
                )
                  : (
                    <HospitalWikiHome handbook={handbook} handbooks={handbooks} navigation={navigation}>
                      <DeferredFigurePreview handbook={handbook} />
                    </HospitalWikiHome>
                  )}
      </div>
      <footer className="wiki-footer"><span>Neurocritical Care Faculty Wiki</span><span>Built from supplied 2026 orientation sources</span><a href="/">Return to landing page</a></footer>
    </div>
  );
}

export default function App({ route, handbook, navigation, figureIndexes = [] }) {
  const routeKey = `${route.kind}:${route.campus || ""}:${route.slug || ""}:${route.search?.q || ""}`;
  useEffect(() => {
    const socialImage = document.querySelector('meta[property="og:image"]');
    if (socialImage) socialImage.setAttribute("content", new URL("/og.png", window.location.origin).href);
    const socialUrl = document.querySelector('meta[property="og:url"]');
    if (socialUrl) socialUrl.setAttribute("content", window.location.href);
  }, [routeKey]);
  if (!handbook || !navigation) return <GlobalNotFoundPage />;
  return <WikiApp route={route} handbook={handbook} navigation={navigation} figureIndexes={figureIndexes} />;
}
