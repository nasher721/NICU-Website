import { GlobalNotFoundRoute } from "../src/routing/RoutePages";
import { metadataForNotFound } from "../src/routing/routes";

export const metadata = metadataForNotFound(null);

export default async function NotFound() {
  return <GlobalNotFoundRoute />;
}
