import type { Metadata, Viewport } from "next";
import { Fraunces, Inter } from "next/font/google";
import { PROFILE } from "@/data/content";
import { CHANNEL } from "@/data/videos";
import { AppProviders } from "@/components/AppProviders";
import { getGenres } from "@/data/server";
import "@/index.css";
import { SITE_URL } from "@/lib/site";

/**
 * Fonts are self-hosted by `next/font` rather than linked from Google.
 *
 * That removes a render-blocking third-party request, eliminates the flash of
 * fallback text, and means the display face is available for the hero's
 * line-by-line reveal on the first frame rather than after a network round
 * trip — which is exactly when a mis-timed webfont swap is most visible.
 */
const display = Fraunces({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
  // Variable axes, so no weight list: the optical-size axis is what lets one
  // file serve both the 64px hero and 20px pull quotes without a second
  // download, and naming explicit weights would opt out of that.
  axes: ["opsz"],
  style: ["normal", "italic"],
});

const sans = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const description = `${PROFILE.name} — journalist reporting from ${PROFILE.base}. Campus systems, Kenyan culture and student life, published as video on ${CHANNEL.handle}.`;

export const metadata: Metadata = {
  /**
   * The origin every relative URL in the metadata resolves against.
   *
   * It was the literal placeholder, which meant the deployed site emitted
   * canonicals, Open Graph URLs and sitemap entries pointing at a reserved
   * domain that can never resolve — telling Google that the real address of
   * every page is somewhere else. `SITE_URL` reads `NEXT_PUBLIC_SITE_URL`,
   * which is the one place the origin is decided; when it is unset the
   * fallback is still the placeholder, deliberately, because a URL that
   * obviously cannot work is a bug you notice.
   */
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${PROFILE.name} — ${PROFILE.role}`,
    template: `%s — ${PROFILE.name}`,
  },
  description,
  authors: [{ name: PROFILE.name }],
  openGraph: {
    type: "website",
    title: `${PROFILE.name} — ${PROFILE.role}`,
    description,
    siteName: PROFILE.name,
  },
  twitter: { card: "summary_large_image", title: PROFILE.name, description },
  robots: { index: true, follow: true },
  // Declared so a reader's browser and any feed reader can find it without
  // being told the address. A feed nobody can discover is a file, not a feed.
  alternates: {
    types: { "application/rss+xml": "/rss.xml" },
  },
};

export const viewport: Viewport = {
  themeColor: "#0E47A1",
  width: "device-width",
  initialScale: 1,
  // Never block a reader from zooming an article.
  maximumScale: 5,
};

/**
 * Async, because the beat tree is now read from the API rather than compiled
 * in. One fetch at the root serves every component below that has to name a
 * beat, and it is cached and revalidated by `data/server` — so this is a
 * cache read on all but one render a minute, not a round trip per page.
 */
export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const genres = await getGenres();

  return (
    <html lang="en" className={`${display.variable} ${sans.variable}`}>
      <body>
        <a
          href="#main"
          className="focus-ring sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[200] focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground"
        >
          Skip to content
        </a>
        <AppProviders genres={genres}>{children}</AppProviders>
      </body>
    </html>
  );
}
