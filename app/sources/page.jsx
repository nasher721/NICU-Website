import { UtilityRoute } from "../../src/routing/RoutePages";

export const metadata = {
  title: "Sources | Neurocritical Care Faculty Wiki",
  description: "Source handbooks and provenance for the faculty wiki.",
};

export default function Sources() {
  return <UtilityRoute kind="sources" />;
}
