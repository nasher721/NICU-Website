import { HospitalNotFoundRoute } from "../../../src/routing/RoutePages";
import { metadataForNotFound } from "../../../src/routing/routes";

export const metadata = metadataForNotFound("main-campus");

export default function MainCampusNestedNotFound() {
  return <HospitalNotFoundRoute campus="main-campus" />;
}
