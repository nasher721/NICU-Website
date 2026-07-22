export const DEFAULT_CAMPUS = "main-campus";
export const CAMPUS_PREFERENCE_KEY = "faculty-wiki-campus";

const CAMPUS_IDS = new Set(["main-campus", "akron"]);

function isCampusId(value) {
  return CAMPUS_IDS.has(value);
}

export function legacyHashToPath(hash, preferredCampus = DEFAULT_CAMPUS) {
  const source = String(hash ?? "");
  if (!source.startsWith("#")) return null;
  const payload = source.slice(1).replace(/^\//, "");
  const encodedParts = payload.split("/");
  if (encodedParts.some((part) => !part)) return null;

  let parts;
  try {
    parts = encodedParts.map((part) => decodeURIComponent(part));
  } catch {
    return null;
  }

  if (parts[0] !== "wiki") return null;
  if (parts.length === 1) return `/${isCampusId(preferredCampus) ? preferredCampus : DEFAULT_CAMPUS}`;
  if (parts.length === 2 && parts[1] === "figures") return "/figures";
  if (parts.length === 2 && parts[1] === "sources") return "/sources";
  if (!isCampusId(parts[1]) || parts.length > 3) return null;
  if (parts.length === 2) return `/${parts[1]}`;
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(parts[2])) return null;
  return `/${parts[1]}/${parts[2]}`;
}

export function legacyHashDestination(pathname, hash, preferredCampus = DEFAULT_CAMPUS) {
  if (pathname !== "/") return null;
  return legacyHashToPath(hash, preferredCampus);
}
