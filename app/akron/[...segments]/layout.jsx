import { metadataForNotFound } from "../../../src/routing/routes";

export const metadata = metadataForNotFound("akron");

export default function AkronInvalidPathLayout({ children }) {
  return children;
}
