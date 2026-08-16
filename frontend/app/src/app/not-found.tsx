import NotFound from "@/views/NotFound";
import { PublicHeader } from "@/components/PublicHeader";
import { PublicFooter } from "@/components/PublicFooter";

/**
 * The root 404 sits outside the `(site)` group, so it has to bring its own
 * chrome. A reader who mistypes a URL should still land somewhere they can
 * navigate out of.
 */
export default function NotFoundRoute() {
  return (
    <div className="flex min-h-screen flex-col">
      <PublicHeader />
      <main id="main" className="flex-1">
        <NotFound />
      </main>
      <PublicFooter />
    </div>
  );
}
