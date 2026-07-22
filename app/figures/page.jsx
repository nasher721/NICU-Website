import { UtilityRoute } from "../../src/routing/RoutePages";

export const metadata = {
  title: "Source Figures | Neurocritical Care Faculty Wiki",
  description: "Figures preserved from the supplied faculty orientation handbooks.",
};

export default function Figures() {
  return <UtilityRoute kind="figures" />;
}
