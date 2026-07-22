export const RANK_TIERS = Object.freeze({
  EXACT_TITLE: 0,
  REVIEWED_ALIAS: 1,
  HEADING: 2,
  CURATED_PRIORITY: 3,
  BODY: 4,
});

const RANK_LABELS = Object.freeze([
  "exact-title",
  "reviewed-alias",
  "heading",
  "curated-priority",
  "body",
]);

const CAMPUS_LABELS = Object.freeze({
  "main-campus": "Main Campus",
  akron: "Akron General",
});

export function normalizeSearchQuery(value) {
  if (typeof value !== "string") return "";
  return value
    .normalize("NFKD")
    .replace(/\p{Mark}/gu, "")
    .toLocaleLowerCase("en-US")
    .replace(/[^\p{Letter}\p{Number}]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function normalizedField(value) {
  return normalizeSearchQuery(typeof value === "string" ? value : "");
}

function countPhrase(field, query) {
  if (!field || !query) return 0;
  let count = 0;
  let cursor = 0;
  while ((cursor = field.indexOf(query, cursor)) !== -1) {
    count += 1;
    cursor += Math.max(1, query.length);
  }
  return count;
}

function matchQuality(field, query, tokens) {
  const normalized = normalizedField(field);
  if (!normalized) return 0;
  const phraseCount = countPhrase(normalized, query);
  const tokenMatches = tokens.reduce(
    (total, token) => total + Math.min(3, countPhrase(normalized, token)),
    0,
  );
  const allTokens = tokens.length > 0 && tokens.every((token) => normalized.includes(token));
  if (phraseCount === 0 && !allTokens) return 0;
  return phraseCount * 100 + tokenMatches * 5 + (normalized.startsWith(query) ? 20 : 0);
}

function classifyRecord(record, query, tokens) {
  const title = normalizedField(record.title);
  const aliases = Array.isArray(record.aliases) ? record.aliases.map(normalizedField) : [];
  const headingMatches = [
    { sourceField: "heading", source: record.heading, score: matchQuality(record.heading, query, tokens) },
    { sourceField: "title", source: record.title, score: matchQuality(record.title, query, tokens) },
    { sourceField: "parent-heading", source: record.parentHeading, score: matchQuality(record.parentHeading, query, tokens) },
  ].sort((left, right) => right.score - left.score);
  const headingMatch = headingMatches[0];
  const bodyScore = matchQuality(record.body, query, tokens);

  if (title === query) {
    return { tier: RANK_TIERS.EXACT_TITLE, score: 1_000, sourceField: "title", term: query };
  }
  const aliasIndex = aliases.indexOf(query);
  if (aliasIndex !== -1) {
    return {
      tier: RANK_TIERS.REVIEWED_ALIAS,
      score: 900,
      sourceField: "reviewed-alias",
      term: record.aliases[aliasIndex],
    };
  }
  if (headingMatch.score > 0) {
    return {
      tier: RANK_TIERS.HEADING,
      score: headingMatch.score,
      sourceField: headingMatch.sourceField,
      term: query,
    };
  }
  if (bodyScore > 0 && Number(record.priority) > 0) {
    return {
      tier: RANK_TIERS.CURATED_PRIORITY,
      score: Number(record.priority) * 1_000 + bodyScore,
      sourceField: "body",
      term: query,
    };
  }
  if (bodyScore > 0) {
    return { tier: RANK_TIERS.BODY, score: bodyScore, sourceField: "body", term: query };
  }
  return null;
}

function asFilterSet(value) {
  if (value === undefined || value === null || value === "") return null;
  return new Set((Array.isArray(value) ? value : [value]).filter((item) => typeof item === "string"));
}

function matchesFilters(record, options) {
  const campus = asFilterSet(options.campus);
  const chapter = asFilterSet(options.chapter);
  const contentType = asFilterSet(options.contentType);
  if (campus && !campus.has(record.campus)) return false;
  if (chapter && !chapter.has(record.chapterId) && !chapter.has(record.chapterSlug)) return false;
  if (contentType && !contentType.has(record.contentType)) return false;
  return true;
}

function normalizeSourceWithOffsets(source) {
  let text = "";
  const starts = [];
  const ends = [];
  let offset = 0;
  let separator = null;

  for (const character of source) {
    const start = offset;
    const end = start + character.length;
    offset = end;
    const decomposed = character
      .normalize("NFKD")
      .replace(/\p{Mark}/gu, "")
      .toLocaleLowerCase("en-US");
    const normalizedCharacters = [...decomposed].filter((value) => /[\p{Letter}\p{Number}]/u.test(value));

    if (normalizedCharacters.length === 0) {
      if (/\p{Mark}/u.test(character) && ends.length > 0) {
        ends[ends.length - 1] = end;
      } else if (text && !text.endsWith(" ")) {
        separator = separator
          ? { start: separator.start, end }
          : { start, end };
      }
      continue;
    }

    if (separator && text && !text.endsWith(" ")) {
      text += " ";
      starts.push(separator.start);
      ends.push(separator.end);
    }
    separator = null;
    for (const normalizedCharacter of normalizedCharacters) {
      text += normalizedCharacter;
      starts.push(start);
      ends.push(end);
    }
  }

  return { text, starts, ends };
}

function findHighlight(source, terms) {
  const normalizedSource = normalizeSourceWithOffsets(source);
  for (const term of terms) {
    const normalized = normalizeSearchQuery(term);
    if (!normalized) continue;
    const direct = normalizedSource.text.indexOf(normalized);
    if (direct !== -1) {
      const endIndex = direct + normalized.length - 1;
      return {
        index: normalizedSource.starts[direct],
        length: normalizedSource.ends[endIndex] - normalizedSource.starts[direct],
      };
    }
    for (const token of normalized.split(" ").sort((a, b) => b.length - a.length)) {
      if (token.length < 2) continue;
      const tokenIndex = normalizedSource.text.indexOf(token);
      if (tokenIndex !== -1) {
        const endIndex = tokenIndex + token.length - 1;
        return {
          index: normalizedSource.starts[tokenIndex],
          length: normalizedSource.ends[endIndex] - normalizedSource.starts[tokenIndex],
        };
      }
    }
  }
  return null;
}

export function createMatchContext(record, query, { maxLength = 180, match } = {}) {
  const normalizedQuery = normalizeSearchQuery(query);
  const tokens = normalizedQuery.split(" ").filter(Boolean);
  const classification = match ?? classifyRecord(record, normalizedQuery, tokens);
  const resolvedSourceField = classification?.sourceField ?? "body";
  const term = classification?.term ?? query;
  const fieldValues = {
    body: typeof record.body === "string" ? record.body : "",
    heading: typeof record.heading === "string" ? record.heading : "",
    title: typeof record.title === "string" ? record.title : "",
    "parent-heading": typeof record.parentHeading === "string" ? record.parentHeading : "",
  };
  const selected = resolvedSourceField === "reviewed-alias"
    ? [resolvedSourceField, `${term} — reviewed alias for ${record.title ?? "this source topic"}`]
    : [resolvedSourceField, fieldValues[resolvedSourceField] || fieldValues.title || fieldValues.body];
  const [sourceField, source] = selected;
  const highlighted = findHighlight(source, [term]);
  const safeLength = Number.isFinite(maxLength) ? Math.max(40, Math.floor(maxLength)) : 180;
  if (source.length <= safeLength) {
    return Object.freeze({
      text: source,
      ranges: Object.freeze(highlighted ? [Object.freeze({ start: highlighted.index, end: highlighted.index + highlighted.length })] : []),
      sourceField,
    });
  }

  const center = highlighted ? highlighted.index + Math.floor(highlighted.length / 2) : 0;
  let start = Math.max(0, center - Math.floor(safeLength / 2));
  let end = Math.min(source.length, start + safeLength);
  start = Math.max(0, end - safeLength);
  if (start > 0) {
    const nextSpace = source.indexOf(" ", start);
    if (nextSpace !== -1 && nextSpace < center) start = nextSpace + 1;
  }
  if (end < source.length) {
    const previousSpace = source.lastIndexOf(" ", end);
    if (previousSpace > center) end = previousSpace;
  }
  const prefix = start > 0 ? "…" : "";
  const suffix = end < source.length ? "…" : "";
  const text = `${prefix}${source.slice(start, end)}${suffix}`;
  const ranges = highlighted && highlighted.index >= start && highlighted.index + highlighted.length <= end
    ? [Object.freeze({
        start: prefix.length + highlighted.index - start,
        end: prefix.length + highlighted.index - start + highlighted.length,
      })]
    : [];
  return Object.freeze({ text, ranges: Object.freeze(ranges), sourceField });
}

function compareResults(left, right, preferredCampus) {
  if (left.match.tier !== right.match.tier) return left.match.tier - right.match.tier;
  if (left.match.score !== right.match.score) return right.match.score - left.match.score;
  if (preferredCampus && left.campus !== right.campus) {
    if (left.campus === preferredCampus) return -1;
    if (right.campus === preferredCampus) return 1;
  }
  const titleOrder = left.title.localeCompare(right.title, "en-US", { sensitivity: "base" });
  if (titleOrder !== 0) return titleOrder;
  const campusOrder = left.campus.localeCompare(right.campus);
  return campusOrder || left.id.localeCompare(right.id);
}

export function rankSearchResults(records, queryValue, options = {}) {
  const query = normalizeSearchQuery(queryValue);
  const minimumLength = Number.isInteger(options.minimumLength) ? Math.max(0, options.minimumLength) : 2;
  if (query.length < minimumLength || !Array.isArray(records)) return [];
  const tokens = query.split(" ").filter(Boolean);
  const ranked = [];
  for (const record of records) {
    if (!record || typeof record !== "object" || !matchesFilters(record, options)) continue;
    const classification = classifyRecord(record, query, tokens);
    if (!classification) continue;
    ranked.push({
      ...record,
      campusLabel: record.campusLabel ?? CAMPUS_LABELS[record.campus] ?? record.campus,
      match: Object.freeze({
        tier: classification.tier,
        kind: RANK_LABELS[classification.tier],
        score: classification.score,
        sourceField: classification.sourceField,
        term: classification.term,
      }),
      context: createMatchContext(record, query, { ...options, match: classification }),
    });
  }
  ranked.sort((left, right) => compareResults(left, right, options.preferredCampus));
  const requestedLimit = options.limit === undefined ? Number.POSITIVE_INFINITY : Number(options.limit);
  const limit = Number.isFinite(requestedLimit) ? Math.max(0, Math.floor(requestedLimit)) : ranked.length;
  return ranked.slice(0, limit);
}

export function rankSearchSuggestions(records, query, options = {}) {
  return rankSearchResults(records, query, { ...options, minimumLength: 2, limit: 6 });
}

function levenshtein(left, right) {
  if (left === right) return 0;
  if (!left.length) return right.length;
  if (!right.length) return left.length;
  let previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    const current = [leftIndex];
    for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
      current[rightIndex] = Math.min(
        current[rightIndex - 1] + 1,
        previous[rightIndex] + 1,
        previous[rightIndex - 1] + (left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1),
      );
    }
    previous = current;
  }
  return previous[right.length];
}

function topicSimilarity(query, record) {
  const candidate = normalizeSearchQuery(`${record.title ?? ""} ${record.parentHeading ?? ""}`);
  const queryTokens = new Set(query.split(" "));
  const candidateTokens = new Set(candidate.split(" "));
  const overlap = [...queryTokens].filter((token) => candidateTokens.has(token)).length;
  const distance = levenshtein(query, normalizeSearchQuery(record.title ?? ""));
  return overlap * 10 + Math.max(0, 1 - distance / Math.max(1, query.length, candidate.length));
}

export function getNoResultsRecovery(records, queryValue, {
  reviewedAliases = [],
  campus,
  chapter,
  contentType,
  limit = 5,
} = {}) {
  const query = normalizeSearchQuery(queryValue);
  if (!query) {
    return Object.freeze({
      aliasAlternatives: Object.freeze([]),
      spellingAlternatives: Object.freeze([]),
      nearbyTopics: Object.freeze([]),
    });
  }
  const eligible = Array.isArray(records)
    ? records.filter((record) => matchesFilters(record, { campus, chapter, contentType }))
    : [];
  const aliases = reviewedAliases
    .filter((alias) => alias && typeof alias.term === "string" && typeof alias.expansion === "string")
    .filter((alias) => !campus || !Array.isArray(alias.campuses) || alias.campuses.includes(campus));
  const aliasAlternatives = aliases
    .map((alias) => ({
      term: alias.term,
      expansion: alias.expansion,
      distance: Math.min(
        levenshtein(query, normalizeSearchQuery(alias.term)),
        levenshtein(query, normalizeSearchQuery(alias.expansion)),
      ),
    }))
    .filter((alias) => alias.distance <= Math.max(2, Math.ceil(query.length * 0.35)))
    .sort((left, right) => left.distance - right.distance || left.term.localeCompare(right.term))
    .slice(0, limit)
    .map(({ term, expansion }) => Object.freeze({ term, expansion }));

  const vocabulary = new Set();
  for (const alias of aliases) {
    vocabulary.add(alias.term);
    vocabulary.add(alias.expansion);
  }
  for (const record of eligible) {
    vocabulary.add(record.title);
    for (const token of normalizeSearchQuery(record.title).split(" ")) {
      if (token.length >= 3) vocabulary.add(token);
    }
  }
  const spellingAlternatives = [...vocabulary]
    .map((value) => ({ value, distance: levenshtein(query, normalizeSearchQuery(value)) }))
    .filter(({ value, distance }) => normalizeSearchQuery(value) !== query
      && distance <= Math.max(2, Math.ceil(query.length * 0.35)))
    .sort((left, right) => left.distance - right.distance || left.value.localeCompare(right.value))
    .slice(0, limit)
    .map(({ value }) => value);

  const nearbyTopics = eligible
    .map((record) => ({ record, similarity: topicSimilarity(query, record) }))
    .filter(({ similarity }) => similarity > 0.35)
    .sort((left, right) => right.similarity - left.similarity
      || left.record.title.localeCompare(right.record.title)
      || left.record.id.localeCompare(right.record.id))
    .slice(0, limit)
    .map(({ record }) => Object.freeze({
      id: record.id,
      title: record.title,
      path: record.path,
      campus: record.campus,
      campusLabel: record.campusLabel ?? CAMPUS_LABELS[record.campus] ?? record.campus,
      contentType: record.contentType,
      chapterTitle: record.chapterTitle,
    }));

  return Object.freeze({
    aliasAlternatives: Object.freeze(aliasAlternatives),
    spellingAlternatives: Object.freeze(spellingAlternatives),
    nearbyTopics: Object.freeze(nearbyTopics),
  });
}
