import { EditorialLoader } from "@/components/loading/EditorialLoader";

/**
 * Its own copy of what used to be inherited from `(site)/loading.tsx`. That
 * default had to stop covering every route — a Suspense boundary above a page
 * that calls `notFound()` costs it its 404 status. See `(site)/(home)/loading.tsx`.
 */
export default function Loading() {
  return <EditorialLoader variant="inset" label="Loading…" />;
}
