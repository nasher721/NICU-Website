"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import wikiMetadata from "../../data/wiki-metadata.json" with { type: "json" };
import { buildSearchPath, campusHomePath } from "../../routing/routes.js";
import { getNoResultsRecovery, rankSearchResults } from "../../search/rank-results.js";
import { BOTH_CAMPUSES, loadSearchScope } from "../../search/search-index.js";
import { HighlightedText } from "./SearchSuggestions.jsx";

function label(value) {
  return String(value || "article").replaceAll("-", " ");
}

function uniqueOptions(records, key, labelKey) {
  const values = new Map();
  records.forEach((record) => {
    if (record[key] && !values.has(record[key])) values.set(record[key], record[labelKey] || record[key]);
  });
  return [...values].map(([value, optionLabel]) => ({ value, label: optionLabel }))
    .sort((left, right) => left.label.localeCompare(right.label, "en-US", { sensitivity: "base" }));
}

function RecoveryLinks({ records, search }) {
  const recovery = getNoResultsRecovery(records, search.q, {
    reviewedAliases: wikiMetadata.aliases,
    campus: search.scope === BOTH_CAMPUSES ? undefined : search.scope,
    chapter: search.chapter,
    contentType: search.type,
  });
  const hasRecovery = recovery.aliasAlternatives.length
    || recovery.spellingAlternatives.length
    || recovery.nearbyTopics.length;
  if (!hasRecovery) return null;
  return (
    <section className="search-recovery" aria-labelledby="search-recovery-heading">
      <p className="eyebrow">Reviewed recovery</p>
      <h2 id="search-recovery-heading">Try a source term or nearby topic</h2>
      {recovery.aliasAlternatives.length > 0 && (
        <div>
          <h3>Reviewed aliases</h3>
          <ul>{recovery.aliasAlternatives.map((item) => (
            <li key={`${item.term}-${item.expansion}`}>
              <a href={buildSearchPath({ ...search, q: item.expansion })}>{item.term}: {item.expansion}</a>
            </li>
          ))}</ul>
        </div>
      )}
      {recovery.spellingAlternatives.length > 0 && (
        <div>
          <h3>Possible source spellings</h3>
          <ul>{recovery.spellingAlternatives.map((item) => (
            <li key={item}><a href={buildSearchPath({ ...search, q: item })}>{item}</a></li>
          ))}</ul>
        </div>
      )}
      {recovery.nearbyTopics.length > 0 && (
        <div>
          <h3>Nearby indexed topics</h3>
          <ul>{recovery.nearbyTopics.map((item) => (
            <li key={item.id}>
              <a href={item.path}>{item.title} <span>{item.campusLabel}</span></a>
            </li>
          ))}</ul>
        </div>
      )}
    </section>
  );
}

export default function SearchResults({ activeCampus, search }) {
  const [requestVersion, setRequestVersion] = useState(0);
  const retryNextRequest = useRef(false);
  const [loadState, setLoadState] = useState({ status: "loading", records: [], errors: [] });

  useEffect(() => {
    let cancelled = false;
    const retry = retryNextRequest.current;
    retryNextRequest.current = false;
    setLoadState((current) => ({ ...current, status: "loading" }));
    loadSearchScope({
      scope: search.scope,
      activeCampus,
      preferredCampus: activeCampus,
      retry,
    }).then((loaded) => {
      if (!cancelled) setLoadState({ status: loaded.status, records: loaded.records, errors: loaded.errors });
    }).catch((error) => {
      if (!cancelled) setLoadState({ status: "error", records: [], errors: [{ message: error.message }] });
    });
    return () => {
      cancelled = true;
    };
  }, [activeCampus, requestVersion, search.scope]);

  const results = useMemo(() => rankSearchResults(loadState.records, search.q, {
    preferredCampus: activeCampus,
    chapter: search.chapter,
    contentType: search.type,
  }), [activeCampus, loadState.records, search.chapter, search.q, search.type]);
  const chapterOptions = useMemo(
    () => uniqueOptions(loadState.records, "chapterSlug", "chapterTitle"),
    [loadState.records],
  );
  const typeOptions = useMemo(
    () => uniqueOptions(loadState.records, "contentType", "contentType"),
    [loadState.records],
  );
  const selectedChapterLabel = chapterOptions.find((option) => option.value === search.chapter)?.label
    ?? search.chapter;
  const queryReady = search.q.trim().length >= 2;

  return (
    <main className="wiki-main search-page" id="wiki-content">
      <div className="wiki-breadcrumbs">
        <a href={campusHomePath(activeCampus)}>Faculty Wiki</a><span>/</span><span>Search</span>
      </div>
      <p className="eyebrow">Source search</p>
      <h1>Search the faculty handbooks</h1>
      <p className="wiki-lede">Every result links to a source section. Query and filter state stays in this URL for reload, sharing, Back, and Forward.</p>

      <form className="search-filter-form" action="/search" method="get" aria-label="Filter search results">
        <label>
          <span>Query</span>
          <input name="q" type="search" defaultValue={search.q} placeholder="Search source passages…" />
        </label>
        <label>
          <span>Campus scope</span>
          <select name="scope" defaultValue={search.scope}>
            <option value="main-campus">Main Campus</option>
            <option value="akron">Akron General</option>
            <option value="both">Both campuses</option>
          </select>
        </label>
        <label>
          <span>Chapter</span>
          <select name="chapter" defaultValue={search.chapter}>
            <option value="">All chapters</option>
            {search.chapter && (
              <option value={search.chapter}>{selectedChapterLabel}</option>
            )}
            {chapterOptions
              .filter((option) => option.value !== search.chapter)
              .map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </label>
        <label>
          <span>Content type</span>
          <select name="type" defaultValue={search.type}>
            <option value="">All content types</option>
            {search.type && (
              <option value={search.type}>{label(search.type)}</option>
            )}
            {typeOptions
              .filter((option) => option.value !== search.type)
              .map((option) => <option key={option.value} value={option.value}>{label(option.label)}</option>)}
          </select>
        </label>
        <button type="submit">Apply filters</button>
      </form>

      <div className="search-results-heading">
        <div>
          <p className="eyebrow">Source matches</p>
          <h2>{queryReady ? `Results for “${search.q}”` : "Enter at least two characters"}</h2>
        </div>
        {queryReady && loadState.status !== "loading" && (
          <strong>{results.length} result{results.length === 1 ? "" : "s"}</strong>
        )}
      </div>
      <p className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {loadState.status === "loading" ? "Loading search results" : `${results.length} search result${results.length === 1 ? "" : "s"}`}
      </p>

      {search.scope !== BOTH_CAMPUSES && (
        <a className="search-both-action" href={buildSearchPath({ ...search, scope: BOTH_CAMPUSES })}>
          Search both campuses without changing your saved campus
        </a>
      )}
      {loadState.status === "loading" && <p className="search-loading" role="status">Loading the selected source index…</p>}
      {(loadState.status === "partial" || loadState.status === "error") && (
        <div className={`search-load-state ${loadState.status}`} role="alert">
          <div>
            <strong>{loadState.status === "partial" ? "Some source results are unavailable." : "Search index unavailable."}</strong>
            <p>{loadState.status === "partial" ? "Results from the available campus remain below." : "Use the campus contents or direct article links while search reloads."}</p>
          </div>
          <button
            type="button"
            onClick={() => {
              retryNextRequest.current = loadState.errors
                .map((error) => error.campus)
                .filter(Boolean);
              if (!retryNextRequest.current.length) retryNextRequest.current = true;
              setRequestVersion((current) => current + 1);
            }}
          >
            Retry search index
          </button>
        </div>
      )}

      {queryReady && results.length > 0 && (
        <ol className="full-search-results">
          {results.map((result) => (
            <li key={result.id}>
              <a href={result.path}>
                <span className="result-title-row">
                  <strong>{result.title}</strong>
                  <span className={`campus-badge campus-${result.campus}`}>{result.campusLabel}</span>
                </span>
                <span className="result-context">
                  <HighlightedText text={result.context.text} ranges={result.context.ranges} />
                </span>
                <span className="result-meta">
                  <span>{label(result.contentType)}</span>
                  <span>{result.chapterTitle || result.parentHeading || "Campus overview"}</span>
                  <span>{label(result.match.kind)}</span>
                </span>
              </a>
            </li>
          ))}
        </ol>
      )}
      {queryReady && loadState.status !== "loading" && results.length === 0 && loadState.status !== "error" && (
        <>
          <div className="search-empty-state">
            <h2>No source passages matched these filters.</h2>
            <p>Try a reviewed term below, clear a filter, or widen the campus scope. Search does not generate clinical answers.</p>
          </div>
          <RecoveryLinks records={loadState.records} search={search} />
        </>
      )}
      <p className="source-caution">Search returns source passages and links, not generated clinical answers. Confirm time-sensitive operations in current Cleveland Clinic systems.</p>
    </main>
  );
}
