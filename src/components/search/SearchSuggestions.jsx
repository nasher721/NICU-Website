"use client";

function normalizedRanges(text, ranges) {
  return (Array.isArray(ranges) ? ranges : [])
    .filter(({ start, end }) => Number.isInteger(start) && Number.isInteger(end)
      && start >= 0 && end > start && end <= text.length)
    .sort((left, right) => left.start - right.start)
    .filter((range, index, values) => index === 0 || range.start >= values[index - 1].end);
}

export function HighlightedText({ text = "", ranges = [] }) {
  const safeRanges = normalizedRanges(text, ranges);
  if (!safeRanges.length) return text;
  const parts = [];
  let cursor = 0;
  safeRanges.forEach((range, index) => {
    if (range.start > cursor) parts.push(text.slice(cursor, range.start));
    parts.push(<mark key={`${range.start}-${range.end}-${index}`}>{text.slice(range.start, range.end)}</mark>);
    cursor = range.end;
  });
  if (cursor < text.length) parts.push(text.slice(cursor));
  return parts;
}

function contentTypeLabel(value) {
  return String(value || "article").replaceAll("-", " ");
}

export default function SearchSuggestions({
  activeResultId,
  getOptionId,
  listboxId,
  loadState,
  onActiveResult,
  onRetry,
  onSelect,
  results,
}) {
  const hasResults = results.length > 0;
  return (
    <div className="search-suggestions" data-state={loadState.status}>
      {loadState.status === "loading" && (
        <p className="search-panel-message">Loading source index…</p>
      )}
      {loadState.status === "error" && (
        <div className="search-panel-message search-panel-error" role="alert">
          <strong>Search index unavailable.</strong>
          <span>Campus contents and direct article links remain available.</span>
          <button type="button" onClick={onRetry}>Retry search</button>
        </div>
      )}
      {loadState.status === "partial" && (
        <div className="search-panel-message search-panel-warning" role="status">
          <span>Showing the campus index that loaded. One source is temporarily unavailable.</span>
          <button type="button" onClick={onRetry}>Retry missing source</button>
        </div>
      )}
      {loadState.status !== "loading" && loadState.status !== "error" && !hasResults && (
        <p className="search-panel-message">No matching source topics. Open full results for recovery options.</p>
      )}
      <ul
        id={listboxId}
        className="search-suggestion-list"
        role="listbox"
        aria-label="Source search suggestions"
        aria-busy={loadState.status === "loading"}
      >
        {hasResults && results.map((result) => {
          const optionId = getOptionId(result);
          const selected = activeResultId === result.id;
          return (
            <li key={result.id} role="presentation">
              <a
                id={optionId}
                href={result.path}
                role="option"
                aria-selected={selected}
                className={selected ? "active" : undefined}
                onPointerDown={(event) => event.preventDefault()}
                onPointerMove={() => onActiveResult(result.id)}
                onClick={(event) => {
                  event.preventDefault();
                  onSelect(result);
                }}
              >
                <span className="search-option-heading">
                  <strong>{result.title}</strong>
                  <span className={`campus-badge campus-${result.campus}`}>{result.campusLabel}</span>
                </span>
                <span className="search-option-context">
                  <HighlightedText text={result.context.text} ranges={result.context.ranges} />
                </span>
                <span className="search-option-meta">
                  <span>{contentTypeLabel(result.contentType)}</span>
                  <span>{result.chapterTitle || result.parentHeading || "Campus overview"}</span>
                </span>
              </a>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
