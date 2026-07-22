import { metadataForRoute, resolveHospitalPath } from "../../src/routing/routes.js";

export const metadata = metadataForRoute(resolveHospitalPath("/akron"));

export default function AkronLayout({ children }) {
  return children;
}
