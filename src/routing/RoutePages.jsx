import { notFound, permanentRedirect } from "next/navigation";
import FacultyWiki, { GlobalNotFoundPage } from "../App.jsx";
import mainCampusContent from "../data/generated/main-campus.content.json" with { type: "json" };
import mainCampusFigures from "../data/generated/main-campus.figures.json" with { type: "json" };
import mainCampusNavigation from "../data/generated/main-campus.navigation.json" with { type: "json" };
import akronContent from "../data/generated/akron.content.json" with { type: "json" };
import akronFigures from "../data/generated/akron.figures.json" with { type: "json" };
import akronNavigation from "../data/generated/akron.navigation.json" with { type: "json" };
import {
  appendSearchParams,
  DEFAULT_CAMPUS,
  getHandbook,
  isCampusId,
  metadataForRoute,
  metadataForNotFound,
  normalizeSearchState,
  resolveHospitalPath,
} from "./routes.js";

const generatedAssets = {
  "main-campus": {
    navigation: mainCampusNavigation,
    content: mainCampusContent,
    figures: mainCampusFigures,
  },
  akron: {
    navigation: akronNavigation,
    content: akronContent,
    figures: akronFigures,
  },
};

function readGeneratedAsset(campus, kind) {
  const asset = generatedAssets[campus]?.[kind];
  if (!asset) throw new Error(`Missing generated ${kind} asset for ${campus}`);
  return asset;
}

async function loadCampusNavigation(campus) {
  return readGeneratedAsset(campus, "navigation");
}

async function loadCampusHandbook(campus) {
  const content = await readGeneratedAsset(campus, "content");
  return {
    ...getHandbook(campus),
    sections: content.sections,
  };
}

async function loadCampusFigures(campus) {
  return readGeneratedAsset(campus, "figures");
}

export async function CampusHomeRoute({ campus }) {
  const navigation = await loadCampusNavigation(campus);
  return (
    <FacultyWiki
      route={{ kind: "campus", campus }}
      handbook={getHandbook(campus)}
      navigation={navigation}
    />
  );
}

export async function CampusArticleRoute({ campus, params, searchParams }) {
  const { slug } = await params;
  const route = resolveHospitalPath(`/${campus}/${slug}`);
  if (route.kind === "redirect") {
    permanentRedirect(appendSearchParams(route.destination, await searchParams));
  }
  if (route.kind !== "article") notFound();
  const [handbook, navigation] = await Promise.all([
    loadCampusHandbook(campus),
    loadCampusNavigation(campus),
  ]);
  return (
    <FacultyWiki
      route={{ kind: "article", campus, slug: route.slug }}
      handbook={handbook}
      navigation={navigation}
    />
  );
}

export async function SearchRoute({ searchParams }) {
  const rawSearchParams = await searchParams;
  const state = normalizeSearchState(rawSearchParams);
  const campus = isCampusId(state.scope) ? state.scope : DEFAULT_CAMPUS;
  const navigation = await loadCampusNavigation(campus);
  return (
    <FacultyWiki
      route={{
        kind: "search",
        search: state,
        campus,
        scopeExplicit: Boolean(rawSearchParams?.scope),
      }}
      handbook={getHandbook(campus)}
      navigation={navigation}
    />
  );
}

export async function UtilityRoute({ kind }) {
  const navigation = await loadCampusNavigation(DEFAULT_CAMPUS);
  const figureIndexes = kind === "figures"
    ? await Promise.all([loadCampusFigures("main-campus"), loadCampusFigures("akron")])
    : [];
  return (
    <FacultyWiki
      route={{ kind }}
      handbook={getHandbook(DEFAULT_CAMPUS)}
      navigation={navigation}
      figureIndexes={figureIndexes}
    />
  );
}

export async function HospitalNotFoundRoute({ campus }) {
  const navigation = await loadCampusNavigation(campus);
  return <FacultyWiki route={{ kind: "not-found", campus }} handbook={getHandbook(campus)} navigation={navigation} />;
}

export async function GlobalNotFoundRoute() {
  return <GlobalNotFoundPage />;
}

export function campusMetadata(campus) {
  return metadataForRoute(resolveHospitalPath(`/${campus}`));
}

export async function articleMetadata(campus, params) {
  const { slug } = await params;
  const route = resolveHospitalPath(`/${campus}/${slug}`);
  if (route.kind === "redirect") {
    return metadataForRoute(resolveHospitalPath(route.destination));
  }
  if (route.kind === "article") return metadataForRoute(route);
  return metadataForNotFound(campus);
}

export function nestedNotFoundMetadata(campus) {
  return metadataForNotFound(campus);
}

export const searchMetadata = metadataForRoute({ kind: "search" });
