import { notFound } from "next/navigation";
import { nestedNotFoundMetadata } from "../../../src/routing/RoutePages";

export const metadata = nestedNotFoundMetadata("main-campus");

export default function MainCampusNestedInvalidPath() {
  notFound();
}
