import { CampusHomeRoute, campusMetadata } from "../../src/routing/RoutePages";

export const metadata = campusMetadata("main-campus");

export default function MainCampusHome() {
  return <CampusHomeRoute campus="main-campus" />;
}
