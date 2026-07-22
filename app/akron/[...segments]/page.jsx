import { notFound } from "next/navigation";
import { nestedNotFoundMetadata } from "../../../src/routing/RoutePages";

export const metadata = nestedNotFoundMetadata("akron");

export default function AkronNestedInvalidPath() {
  notFound();
}
