import { CampusHomeRoute, campusMetadata } from "../../src/routing/RoutePages";

export const metadata = campusMetadata("akron");

export default function AkronHome() {
  return <CampusHomeRoute campus="akron" />;
}
