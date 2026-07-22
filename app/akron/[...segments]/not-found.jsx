import { HospitalNotFoundRoute } from "../../../src/routing/RoutePages";
import { metadataForNotFound } from "../../../src/routing/routes";

export const metadata = metadataForNotFound("akron");

export default function AkronNestedNotFound() {
  return <HospitalNotFoundRoute campus="akron" />;
}
