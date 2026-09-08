import { EditorialLoader } from "@/components/loading/EditorialLoader";

/**
 * The branded bar, for a page whose shape we cannot predict well enough to
 * draw a skeleton of.
 *
 * ── Why this sits in a route group rather than at `(site)` ───────────────
 * It used to be `(site)/loading.tsx`, where it was the default for every
 * public route that had no skeleton of its own. That is a nicer arrangement
 * to read, and it silently broke the status code on the two routes that ask
 * "does this exist?" at request time.
 *
 * A `loading.tsx` is a Suspense boundary, so Next answers with the shell
 * immediately — 200, headers sent — and streams the page into it. By the time
 * `/stories/[slug]` or `/beats/[slug]` had looked the slug up and called
 * `notFound()`, the status line was already gone: a mistyped URL rendered the
 * 404 page inside a 200 response. That is a soft 404, and it is what forced
 * `dynamicParams = false` on both routes, which in turn is what made every
 * piece published since the last deploy unreachable.
 *
 * So the loader is scoped to the pages that want it instead of inherited by
 * everything below. `(home)` is a path-less group: this file covers the home
 * page and nothing else, and the other routes that had been relying on the
 * inherited default now carry their own copy. The two lookup routes have no
 * boundary above them and answer with a real 404 again.
 */
export default function SiteLoading() {
  return <EditorialLoader variant="inset" label="Loading…" />;
}
