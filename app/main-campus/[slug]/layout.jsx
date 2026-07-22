import { articleMetadata } from "../../../src/routing/RoutePages";

export function generateMetadata({ params }) {
  return articleMetadata("main-campus", params);
}

export default function MainCampusArticleLayout({ children }) {
  return children;
}
