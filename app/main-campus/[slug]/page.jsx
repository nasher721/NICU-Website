import { CampusArticleRoute, articleMetadata } from "../../../src/routing/RoutePages";

export function generateMetadata({ params }) {
  return articleMetadata("main-campus", params);
}

export default function MainCampusArticle({ params, searchParams }) {
  return <CampusArticleRoute campus="main-campus" params={params} searchParams={searchParams} />;
}
