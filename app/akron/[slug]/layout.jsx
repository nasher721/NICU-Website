import { articleMetadata } from "../../../src/routing/RoutePages";

export function generateMetadata({ params }) {
  return articleMetadata("akron", params);
}

export default function AkronArticleLayout({ children }) {
  return children;
}
