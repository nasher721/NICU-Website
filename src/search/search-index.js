const CAMPUS_LABELS = Object.freeze({
  "main-campus": "Main Campus",
  akron: "Akron General",
});

export const CAMPUS_IDS = Object.freeze(Object.keys(CAMPUS_LABELS));
export const BOTH_CAMPUSES = "both";

export const SEARCH_INDEX_URLS = Object.freeze({
  "main-campus": "/search-index/main-campus.json",
  akron: "/search-index/akron.json",
});

async function fetchSearchIndex(campus) {
  const response = await fetch(SEARCH_INDEX_URLS[campus], {
    headers: { Accept: "application/json" },
  });
  if (!response.ok) {
    throw new Error(`Search index request failed for ${campus} (${response.status})`);
  }
  return response.json();
}

const DEFAULT_INDEX_READERS = Object.freeze({
  "main-campus": () => fetchSearchIndex("main-campus"),
  akron: () => fetchSearchIndex("akron"),
});

function isCampus(value) {
  return CAMPUS_IDS.includes(value);
}

function requireString(record, key, campus) {
  if (typeof record[key] !== "string" || !record[key].trim()) {
    throw new TypeError(`Search record in ${campus} has invalid ${key}`);
  }
  return record[key];
}

function nullableString(value, key, campus) {
  if (value === null || value === undefined) return null;
  if (typeof value !== "string") throw new TypeError(`Search record in ${campus} has invalid ${key}`);
  return value;
}

function normalizeRecord(record, campus) {
  if (!record || typeof record !== "object" || Array.isArray(record)) {
    throw new TypeError(`Search index for ${campus} contains a non-object record`);
  }
  if (record.campus !== campus) {
    throw new TypeError(`Search record ${record.id ?? "(unknown)"} has the wrong campus`);
  }
  const priority = Number(record.priority ?? 0);
  if (!Number.isFinite(priority) || priority < 0) {
    throw new TypeError(`Search record ${record.id ?? "(unknown)"} has invalid priority`);
  }
  if (!Array.isArray(record.aliases) || record.aliases.some((alias) => typeof alias !== "string")) {
    throw new TypeError(`Search record ${record.id ?? "(unknown)"} has invalid aliases`);
  }

  return {
    id: requireString(record, "id", campus),
    campus,
    campusLabel: CAMPUS_LABELS[campus],
    title: requireString(record, "title", campus),
    slug: requireString(record, "slug", campus),
    path: requireString(record, "path", campus),
    parentId: nullableString(record.parentId, "parentId", campus),
    parentSlug: nullableString(record.parentSlug, "parentSlug", campus),
    contentType: requireString(record, "contentType", campus),
    priority,
    heading: requireString(record, "heading", campus),
    parentHeading: typeof record.parentHeading === "string" ? record.parentHeading : "",
    body: typeof record.body === "string" ? record.body : "",
    aliases: [...record.aliases],
  };
}

function addChapter(record, byId) {
  let chapter = record;
  const visited = new Set([record.id]);
  while (chapter.parentId) {
    if (visited.has(chapter.parentId)) {
      throw new TypeError(`Search index contains a parent cycle at ${record.id}`);
    }
    const parent = byId.get(chapter.parentId);
    if (!parent) throw new TypeError(`Search record ${record.id} has a missing parent`);
    visited.add(parent.id);
    chapter = parent;
  }
  return Object.freeze({
    ...record,
    aliases: Object.freeze(record.aliases),
    chapterId: chapter.id,
    chapterSlug: chapter.slug,
    chapterTitle: chapter.title,
  });
}

export function normalizeCampusIndex(rawIndex, expectedCampus) {
  const raw = rawIndex?.default ?? rawIndex;
  if (!isCampus(expectedCampus)) throw new TypeError(`Unsupported campus: ${expectedCampus}`);
  if (!raw || raw.schemaVersion !== 1 || raw.campus !== expectedCampus || !Array.isArray(raw.records)) {
    throw new TypeError(`Invalid search index for ${expectedCampus}`);
  }

  const records = raw.records.map((record) => normalizeRecord(record, expectedCampus));
  const byId = new Map();
  for (const record of records) {
    if (byId.has(record.id)) throw new TypeError(`Duplicate search record ID: ${record.id}`);
    byId.set(record.id, record);
  }
  const normalized = records.map((record) => addChapter(record, byId));
  return Object.freeze({
    schemaVersion: raw.schemaVersion,
    campus: expectedCampus,
    campusLabel: CAMPUS_LABELS[expectedCampus],
    records: Object.freeze(normalized),
  });
}

function preferredFirst(activeCampus, preferredCampus) {
  const first = isCampus(preferredCampus)
    ? preferredCampus
    : isCampus(activeCampus)
      ? activeCampus
      : CAMPUS_IDS[0];
  return [first, ...CAMPUS_IDS.filter((campus) => campus !== first)];
}

export function createSearchIndexLoader({ readers = DEFAULT_INDEX_READERS } = {}) {
  const cache = new Map();

  async function loadCampus(campus, { retry = false } = {}) {
    if (!isCampus(campus) || typeof readers[campus] !== "function") {
      throw new TypeError(`Unsupported campus: ${campus}`);
    }
    if (retry) cache.delete(campus);
    if (!cache.has(campus)) {
      const pending = Promise.resolve()
        .then(() => readers[campus]())
        .then((raw) => normalizeCampusIndex(raw, campus));
      cache.set(campus, pending);
      pending.catch(() => {
        if (cache.get(campus) === pending) cache.delete(campus);
      });
    }
    return cache.get(campus);
  }

  async function loadScope({
    scope,
    activeCampus,
    preferredCampus,
    retry = false,
  } = {}) {
    const resolvedScope = scope === BOTH_CAMPUSES
      ? BOTH_CAMPUSES
      : isCampus(scope)
        ? scope
        : isCampus(activeCampus)
          ? activeCampus
          : isCampus(preferredCampus)
            ? preferredCampus
            : CAMPUS_IDS[0];
    const campuses = resolvedScope === BOTH_CAMPUSES
      ? preferredFirst(activeCampus, preferredCampus)
      : [resolvedScope];
    const retryCampuses = retry === true
      ? new Set(campuses)
      : new Set(Array.isArray(retry) ? retry : []);
    const settled = await Promise.allSettled(
      campuses.map((campus) => loadCampus(campus, { retry: retryCampuses.has(campus) })),
    );
    const indexes = [];
    const errors = [];
    settled.forEach((result, index) => {
      const campus = campuses[index];
      if (result.status === "fulfilled") indexes.push(result.value);
      else errors.push({ campus, message: result.reason instanceof Error ? result.reason.message : String(result.reason) });
    });
    const records = indexes.flatMap((index) => index.records);
    return Object.freeze({
      scope: resolvedScope,
      status: errors.length === 0 ? "ready" : records.length > 0 ? "partial" : "error",
      campuses: Object.freeze(indexes.map((index) => index.campus)),
      records: Object.freeze(records),
      errors: Object.freeze(errors.map(Object.freeze)),
      retryable: errors.length > 0,
    });
  }

  function clear(campus) {
    if (campus === undefined) cache.clear();
    else cache.delete(campus);
  }

  return Object.freeze({ loadCampus, loadScope, clear });
}

const defaultLoader = createSearchIndexLoader();

export const loadCampusSearchIndex = defaultLoader.loadCampus;
export const loadSearchScope = defaultLoader.loadScope;
export const clearSearchIndexCache = defaultLoader.clear;
