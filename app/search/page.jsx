import { SearchRoute, searchMetadata } from "../../src/routing/RoutePages";

export const metadata = searchMetadata;

export default function SearchPage({ searchParams }) {
  return <SearchRoute searchParams={searchParams} />;
}
