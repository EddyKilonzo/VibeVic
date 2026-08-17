import { PROFILE, SOCIAL_ACCOUNTS } from "@/data/content";
import { SITE_URL, absoluteUrl } from "@/lib/site";

/**
 * Site-level structured data: who this is, and what this site is.
 *
 * ── What is asserted, and what is deliberately not ───────────────────────
 * Only facts already stated on the About page and verifiable from his own
 * accounts. `sameAs` is the strongest signal here — it is the list of profiles
 * that are demonstrably the same person, which is how a search engine
 * connects a byline to an identity rather than guessing from a name.
 *
 * `affiliation` rather than `alumniOf`: he is a current student. `alumniOf`
 * would assert a completed qualification, which is exactly the kind of
 * credential that must never be invented on a journalist's page — and was in
 * fact wrong on this site once already.
 *
 * There is no `award`, no `worksFor` and no `knowsAbout`. He has told us of no
 * prizes, has no stated employer, and a self-declared list of expertise is a
 * claim rather than a fact. An empty array would be as dishonest as a full one.
 *
 * Rendered from the site layout, so it appears on public pages and never on
 * the newsroom.
 */
export function SiteStructuredData() {
  const person = {
    "@type": "Person",
    "@id": `${SITE_URL}/#person`,
    name: PROFILE.name,
    url: absoluteUrl("/about"),
    image: absoluteUrl("/images/victor-kiplimo-portrait.webp"),
    jobTitle: PROFILE.role,
    homeLocation: { "@type": "Place", name: PROFILE.base },
    affiliation: { "@type": "EducationalOrganization", name: PROFILE.education },
    email: `mailto:${PROFILE.email}`,
    sameAs: SOCIAL_ACCOUNTS.map((account) => account.url),
  };

  const website = {
    "@type": "WebSite",
    "@id": `${SITE_URL}/#website`,
    url: SITE_URL,
    name: PROFILE.name,
    inLanguage: "en",
    publisher: { "@id": `${SITE_URL}/#person` },
    // The search page exists and works, so declaring it is accurate. It is
    // `noindex` itself — that keeps the query permutations out of the index
    // without hiding the feature from a reader arriving through it.
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${SITE_URL}/search?q={search_term_string}`,
      },
      "query-input": "required name=search_term_string",
    },
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify({ "@context": "https://schema.org", "@graph": [person, website] }),
      }}
    />
  );
}
