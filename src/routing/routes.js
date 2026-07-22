import routeManifest from "../data/generated/route-manifest.json" with { type: "json" };

export const CAMPUS_IDS = Object.freeze(Object.keys(routeManifest.campuses));
export const DEFAULT_CAMPUS = "main-campus";
export const CAMPUS_PREFERENCE_KEY = "faculty-wiki-campus";

export const CAMPUS_SUMMARIES = Object.freeze(CAMPUS_IDS.map((campus) => Object.freeze({
  id: campus,
  name: routeManifest.campuses[campus].name,
  shortName: routeManifest.campuses[campus].shortName,
  sourceLabel: routeManifest.campuses[campus].sourceLabel,
  sourceFile: routeManifest.campuses[campus].sourceFile,
  stats: Object.freeze({ ...routeManifest.campuses[campus].stats }),
  sourceStatus: Object.freeze({ ...routeManifest.campuses[campus].sourceStatus }),
})));
const handbooksByCampus = new Map(CAMPUS_SUMMARIES.map((handbook) => [handbook.id, handbook]));
const redirectsByPath = new Map(
  routeManifest.redirects.map((redirect) => [redirect.from, redirect]),
);

export function isCampusId(value) {
  return CAMPUS_IDS.includes(value);
}

export function getHandbook(campus) {
  return handbooksByCampus.get(campus) ?? null;
}

export function getSection(campus, slug) {
  return routeManifest.campuses[campus]?.routes.find((section) => section.slug === slug) ?? null;
}

export function campusHomePath(campus) {
  return isCampusId(campus) ? `/${campus}` : `/${DEFAULT_CAMPUS}`;
}

export function articlePath(campus, slug = "") {
  return slug ? `${campusHomePath(campus)}/${slug}` : campusHomePath(campus);
}

export function resolveHospitalPath(pathname) {
  const normalized = pathname === "/" ? "/" : pathname.replace(/\/+$/, "");
  if (normalized === "/") return { kind: "landing", pathname: "/" };
  if (normalized === "/search") return { kind: "search", pathname: normalized };
  if (normalized === "/sources") return { kind: "sources", pathname: normalized };
  if (normalized === "/figures") return { kind: "figures", pathname: normalized };

  const parts = normalized.split("/").filter(Boolean);
  const [campus, slug, ...rest] = parts;
  if (!isCampusId(campus)) {
    return { kind: "not-found", pathname: normalized, campus: null, slug: null };
  }
  if (rest.length > 0) {
    return {
      kind: "not-found",
      pathname: normalized,
      campus,
      slug: [slug, ...rest].join("/"),
    };
  }
  if (!slug) return { kind: "campus", pathname: normalized, campus };

  const redirect = redirectsByPath.get(normalized);
  if (redirect) {
    return {
      kind: "redirect",
      pathname: normalized,
      campus,
      slug,
      destination: redirect.to,
      redirectKind: redirect.kind,
      stableId: redirect.stableId,
    };
  }

  const section = getSection(campus, slug);
  if (!section) return { kind: "not-found", pathname: normalized, campus, slug };
  return { kind: "article", pathname: normalized, campus, slug, section };
}

function firstValue(value) {
  return Array.isArray(value) ? value[0] : value;
}

export function normalizeSearchState(searchParams = {}) {
  const scopeValue = String(firstValue(searchParams.scope) ?? "");
  return {
    q: String(firstValue(searchParams.q) ?? "").trim(),
    scope: isCampusId(scopeValue) || scopeValue === "both" ? scopeValue : DEFAULT_CAMPUS,
    chapter: String(firstValue(searchParams.chapter) ?? "").trim(),
    type: String(firstValue(searchParams.type) ?? "").trim(),
  };
}

export function buildSearchPath(state = {}) {
  const normalized = normalizeSearchState(state);
  const params = new URLSearchParams();
  if (normalized.q) params.set("q", normalized.q);
  params.set("scope", normalized.scope);
  if (normalized.chapter) params.set("chapter", normalized.chapter);
  if (normalized.type) params.set("type", normalized.type);
  return `/search?${params.toString()}`;
}

export function appendSearchParams(pathname, searchParams = {}) {
  const destination = new URL(pathname, "https://faculty-wiki.invalid");
  const entries = searchParams instanceof URLSearchParams
    ? searchParams.entries()
    : Object.entries(searchParams).flatMap(([key, value]) => {
      if (Array.isArray(value)) return value.map((item) => [key, item]);
      return value == null ? [] : [[key, value]];
    });

  for (const [key, value] of entries) {
    destination.searchParams.append(String(key), String(value));
  }

  return `${destination.pathname}${destination.search}${destination.hash}`;
}

export function metadataForNotFound(campus) {
  const handbook = getHandbook(campus) ?? getHandbook(DEFAULT_CAMPUS);
  const title = `Page not found | ${handbook.name} Faculty Wiki`;
  const description = `Search the ${handbook.name} handbook or use its current contents to recover from this link.`;
  return {
    title,
    description,
    robots: { index: false, follow: true },
    alternates: {},
    openGraph: { title, description },
    twitter: { title, description },
  };
}

export function metadataForRoute(route) {
  const handbook = route.campus ? getHandbook(route.campus) : null;
  if (route.kind === "article" && handbook && route.section) {
    const title = `${route.section.title} | ${handbook.name} Faculty Wiki`;
    const description = `${route.section.title}, preserved from the ${handbook.sourceLabel}.`;
    return {
      title,
      description,
      alternates: { canonical: route.pathname },
      openGraph: { title, description, url: route.pathname },
      twitter: { title, description },
    };
  }
  if (route.kind === "campus" && handbook) {
    const title = `${handbook.name} Faculty Wiki | Neurocritical Care`;
    const description = `Search and browse the ${handbook.name} 2026 neurocritical care faculty orientation source.`;
    return {
      title,
      description,
      alternates: { canonical: route.pathname },
      openGraph: { title, description, url: route.pathname },
      twitter: { title, description },
    };
  }
  if (route.kind === "search") {
    const title = "Search | Neurocritical Care Faculty Wiki";
    const description = "Search source passages across the Main Campus and Akron General faculty handbooks.";
    return {
      title,
      description,
      alternates: { canonical: "/search" },
      openGraph: { title, description, url: "/search" },
      twitter: { title, description },
    };
  }
  return {
    title: "Neurocritical Care Faculty Wiki | Cleveland Clinic",
    description: "A searchable, shift-ready faculty orientation resource for Main Campus and Akron General.",
  };
}

export { routeManifest };
