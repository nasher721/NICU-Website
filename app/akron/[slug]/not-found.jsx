import { HospitalNotFoundRoute } from "../../../src/routing/RoutePages";
import { metadataForNotFound } from "../../../src/routing/routes";

export const metadata = metadataForNotFound("akron");

export default function AkronNotFound() {
  return <HospitalNotFoundRoute campus="akron" />;
}
