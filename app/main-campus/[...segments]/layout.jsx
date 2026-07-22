import { metadataForNotFound } from "../../../src/routing/routes";

export const metadata = metadataForNotFound("main-campus");

export default function MainCampusInvalidPathLayout({ children }) {
  return children;
}
