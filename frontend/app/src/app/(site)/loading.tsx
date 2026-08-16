import { EditorialLoader } from "@/components/loading/EditorialLoader";

/**
 * The default for any public route without a more specific skeleton. A page
 * whose shape we can predict gets its own `loading.tsx` with a real skeleton;
 * this branded bar is the honest fallback for the ones we cannot.
 */
export default function SiteLoading() {
  return <EditorialLoader variant="inset" label="Loading…" />;
}
