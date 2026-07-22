import { CampusArticleRoute, articleMetadata } from "../../../src/routing/RoutePages";

export function generateMetadata({ params }) {
  return articleMetadata("akron", params);
}

export default function AkronArticle({ params, searchParams }) {
  return <CampusArticleRoute campus="akron" params={params} searchParams={searchParams} />;
}
