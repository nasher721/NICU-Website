"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { CAMPUS_PREFERENCE_KEY, buildSearchPath } from "../../routing/routes.js";
import { rankSearchSuggestions } from "../../search/rank-results.js";
import { BOTH_CAMPUSES, CAMPUS_IDS, loadSearchScope } from "../../search/search-index.js";
import SearchSuggestions from "./SearchSuggestions.jsx";

function validScope(value, fallback) {
  return value === BOTH_CAMPUSES || CAMPUS_IDS.includes(value) ? value : fallback;
}

function safeId(value) {
  return String(value).replace(/[^a-zA-Z0-9_-]/g, "-");
}

export default function SearchBox({
  activeCampus,
  initialQuery = "",
  initialScope,
  inputId = "global-search",
}) {
  const reactId = safeId(useId());
  const rootRef = useRef(null);
  const inputRef = useRef(null);
  const [query, setQuery] = useState(initialQuery);
  const [scope, setScope] = useState(() => validScope(initialScope, activeCampus));
  const [isOpen, setIsOpen] = useState(false);
  const [activeResultId, setActiveResultId] = useState(null);
  const [requestVersion, setRequestVersion] = useState(0);
  const retryNextRequest = useRef(false);
  const [loadState, setLoadState] = useState({ status: "idle", records: [], errors: [] });
  const normalizedQuery = query.trim();
  const listboxId = `${inputId}-${reactId}-suggestions`;

  useEffect(() => {
    const hydratedValue = inputRef.current?.value ?? "";
    const nextQuery = initialQuery || hydratedValue;
    setQuery(nextQuery);
    if (!initialQuery && hydratedValue.trim().length >= 2) setIsOpen(true);
  }, [initialQuery]);
  useEffect(() => {
    rootRef.current?.setAttribute("data-search-hydrated", "true");
  }, []);
  useEffect(() => setScope(validScope(initialScope, activeCampus)), [activeCampus, initialScope]);

  useEffect(() => {
    const onGlobalKeyDown = (event) => {
      if (event.key === "/" && !["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement?.tagName)) {
        event.preventDefault();
        inputRef.current?.focus();
      }
    };
    const onOutsidePointer = (event) => {
      if (!rootRef.current?.contains(event.target)) {
        setIsOpen(false);
        setActiveResultId(null);
      }
    };
    window.addEventListener("keydown", onGlobalKeyDown);
    document.addEventListener("pointerdown", onOutsidePointer);
    return () => {
      window.removeEventListener("keydown", onGlobalKeyDown);
      document.removeEventListener("pointerdown", onOutsidePointer);
    };
  }, []);

  useEffect(() => {
    if (normalizedQuery.length < 2) {
      setLoadState({ status: "idle", records: [], errors: [] });
      setActiveResultId(null);
      return undefined;
    }
    let cancelled = false;
    const retry = retryNextRequest.current;
    retryNextRequest.current = false;
    setLoadState((current) => ({ ...current, status: "loading" }));
    loadSearchScope({
      scope,
      activeCampus,
      preferredCampus: activeCampus,
      retry,
    }).then((loaded) => {
      if (cancelled) return;
      setLoadState({ status: loaded.status, records: loaded.records, errors: loaded.errors });
    }).catch((error) => {
      if (cancelled) return;
      setLoadState({ status: "error", records: [], errors: [{ message: error.message }] });
    });
    return () => {
      cancelled = true;
    };
  }, [activeCampus, normalizedQuery, requestVersion, scope]);

  const results = useMemo(() => rankSearchSuggestions(loadState.records, normalizedQuery, {
    preferredCampus: activeCampus,
  }), [activeCampus, loadState.records, normalizedQuery]);

  useEffect(() => {
    if (activeResultId && !results.some((result) => result.id === activeResultId)) {
      setActiveResultId(null);
    }
  }, [activeResultId, results]);

  const activeIndex = results.findIndex((result) => result.id === activeResultId);
  const activeResult = activeIndex === -1 ? null : results[activeIndex];
  const getOptionId = (result) => `${listboxId}-${safeId(result.id)}`;
  const showPanel = isOpen && normalizedQuery.length >= 2;
  const announcement = normalizedQuery.length < 2
    ? ""
    : loadState.status === "loading"
      ? "Loading search suggestions"
      : loadState.status === "error"
        ? "Search suggestions unavailable. Retry is available."
        : `${results.length} search suggestion${results.length === 1 ? "" : "s"} available${loadState.status === "partial" ? "; one campus index is unavailable" : ""}`;

  const selectResult = (result) => {
    setIsOpen(false);
    setActiveResultId(null);
    window.location.assign(result.path);
  };

  const onInputKeyDown = (event) => {
    if (event.key === "Escape" && showPanel) {
      event.preventDefault();
      event.stopPropagation();
      setIsOpen(false);
      setActiveResultId(null);
      return;
    }
    if ((event.key === "ArrowDown" || event.key === "ArrowUp") && results.length) {
      event.preventDefault();
      setIsOpen(true);
      const direction = event.key === "ArrowDown" ? 1 : -1;
      const nextIndex = activeIndex === -1
        ? direction === 1 ? 0 : results.length - 1
        : (activeIndex + direction + results.length) % results.length;
      setActiveResultId(results[nextIndex].id);
      return;
    }
    if (event.key === "Enter" && showPanel && activeResult) {
      event.preventDefault();
      selectResult(activeResult);
    }
  };

  const updateScope = (nextScope) => {
    setScope(nextScope);
    setActiveResultId(null);
    setIsOpen(normalizedQuery.length >= 2);
    if (nextScope !== BOTH_CAMPUSES) {
      try {
        window.localStorage.setItem(CAMPUS_PREFERENCE_KEY, nextScope);
      } catch {
        // URL state remains authoritative when preference storage is unavailable.
      }
    }
  };

  return (
    <form
      ref={rootRef}
      className="wiki-search search-combobox"
      action="/search"
      method="get"
      role="search"
      onSubmit={() => {
        if (scope !== BOTH_CAMPUSES) {
          try {
            window.localStorage.setItem(CAMPUS_PREFERENCE_KEY, scope);
          } catch {
            // The submitted URL still carries the selected scope.
          }
        }
      }}
    >
      <div className="search-input-row">
        <span className="search-mark" aria-hidden="true">⌕</span>
        <label className="sr-only" htmlFor={inputId}>Search faculty handbook source passages</label>
        <input
          ref={inputRef}
          id={inputId}
          name="q"
          type="search"
          role="combobox"
          aria-autocomplete="list"
          aria-controls={showPanel ? listboxId : undefined}
          aria-expanded={showPanel}
          aria-activedescendant={activeResult ? getOptionId(activeResult) : undefined}
          aria-describedby={`${inputId}-${reactId}-status`}
          placeholder="Search pathways, contacts, SmartPhrases…"
          value={query}
          autoComplete="off"
          onFocus={() => setIsOpen(normalizedQuery.length >= 2)}
          onKeyDown={onInputKeyDown}
          onChange={(event) => {
            setQuery(event.target.value);
            setActiveResultId(null);
            setIsOpen(event.target.value.trim().length >= 2);
          }}
        />
        <kbd aria-hidden="true">/</kbd>
      </div>
      <label className="search-scope-control">
        <span className="sr-only">Search scope</span>
        <select name="scope" value={scope} aria-label="Search scope" onChange={(event) => updateScope(event.target.value)}>
          <option value="main-campus">Main Campus</option>
          <option value="akron">Akron General</option>
          <option value="both">Both campuses</option>
        </select>
      </label>
      <p id={`${inputId}-${reactId}-status`} className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {announcement}
      </p>
      {showPanel && (
        <div className="search-popover">
          <SearchSuggestions
            activeResultId={activeResultId}
            getOptionId={getOptionId}
            listboxId={listboxId}
            loadState={loadState}
            onActiveResult={setActiveResultId}
            onRetry={() => {
              retryNextRequest.current = loadState.errors
                .map((error) => error.campus)
                .filter(Boolean);
              if (!retryNextRequest.current.length) retryNextRequest.current = true;
              setRequestVersion((current) => current + 1);
            }}
            onSelect={selectResult}
            results={results}
          />
          <a className="search-all-link" href={buildSearchPath({ q: query, scope })}>
            View all results for “{query.trim()}” <span aria-hidden="true">→</span>
          </a>
        </div>
      )}
    </form>
  );
}
