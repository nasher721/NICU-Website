import { metadataForRoute, resolveHospitalPath } from "../../src/routing/routes.js";

export const metadata = metadataForRoute(resolveHospitalPath("/main-campus"));

export default function MainCampusLayout({ children }) {
  return children;
}
