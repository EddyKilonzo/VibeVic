import path from "node:path";
import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,

  // Pin the workspace root. Without it Turbopack walks up past the repo and
  // finds an unrelated lockfile in the home directory.
  turbopack: {
    root: path.dirname(fileURLToPath(import.meta.url)),
  },

  images: {
    // YouTube poster frames are the only remote images the site uses.
    remotePatterns: [
      { protocol: "https", hostname: "i.ytimg.com" },
      { protocol: "https", hostname: "yt3.googleusercontent.com" },
      // Stock photography, used only as atmosphere — never as reporting.
      // See src/data/imagery.ts for the rule and the full list.
      { protocol: "https", hostname: "images.unsplash.com" },
      // Covers and in-article pictures on his own WordPress site, which is
      // where the written archive was imported from. Listed so the optimiser
      // will resize them: without this Next refuses the host and the raw
      // originals — some of them well over a megabyte — ship to phones.
      { protocol: "https", hostname: "vicunfiltered.wordpress.com" },
      { protocol: "https", hostname: "*.files.wordpress.com" },
      // Anything uploaded through the newsroom media library. Cloudinary does
      // its own resizing and format negotiation in the delivery URL, so these
      // are passed through unoptimised rather than resized twice — see
      // lib/cloudinary.ts.
      { protocol: "https", hostname: "res.cloudinary.com" },
    ],
    // Sized for the breakpoints the mobile-first brief calls out.
    deviceSizes: [320, 375, 430, 640, 768, 1024, 1280, 1536],
    imageSizes: [96, 128, 180, 256, 384],
    formats: ["image/avif", "image/webp"],
  },

  experimental: {
    // Keeps the client bundle from pulling the whole icon set.
    optimizePackageImports: ["lucide-react", "recharts", "motion"],
  },

  async headers() {
    return [
      {
        // Every route. The gate in `middleware.ts` decides who may see the
        // workspace; these decide what a browser is willing to do with any
        // page of this site once it has it, which is a different question and
        // one that also applies to the public half.
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: contentSecurityPolicy() },

          // No framing, by anyone. The site has nothing that belongs in
          // somebody else's page, and the workspace has a publish button —
          // which is exactly the kind of control clickjacking is for. CSP's
          // `frame-ancestors` is the rule browsers actually enforce now;
          // X-Frame-Options is here for anything that predates it.
          { key: "X-Frame-Options", value: "DENY" },

          // Stops a browser second-guessing a Content-Type. Relevant because
          // the media library serves whatever a journalist uploaded.
          { key: "X-Content-Type-Options", value: "nosniff" },

          // Send the origin cross-site, never the path or the query. This is
          // the modern browser default and it is not worth leaving to chance:
          // one URL on this site carries a password-reset token in its query
          // string, and a referrer that included it would hand a working
          // credential to whatever host the page happened to link out to.
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },

          // Nothing here uses any of these, and a page that is compromised
          // should not be able to start.
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()",
          },

          // Cross-origin isolation of the document itself: a window this page
          // opened, or one that opened it, cannot reach into it.
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
        ],
      },
      {
        // The door, and the two rooms behind it. The reset link arrives as
        // `?token=...`, which means the token is in the address bar, in
        // history, and — without this — in the `Referer` of anything the page
        // fetches cross-origin. `no-referrer` is the only setting that is
        // true regardless of what the page later grows.
        source: "/newsroom-access/:path*",
        headers: [{ key: "Referrer-Policy", value: "no-referrer" }],
      },
      // HSTS, production only — the whole entry, not an entry with an empty
      // list, which Next rejects at boot. On a development machine this would
      // pin localhost to HTTPS in the browser's preload list for two years,
      // which is a memorable afternoon.
      ...(isProduction
        ? [
            {
              source: "/:path*",
              headers: [
                {
                  key: "Strict-Transport-Security",
                  value: "max-age=63072000; includeSubDomains; preload",
                },
              ],
            },
          ]
        : []),
    ];
  },
};

const isProduction = process.env.NODE_ENV === "production";

/**
 * The policy, and an honest account of what it does not do.
 *
 * ── `script-src` still allows inline ─────────────────────────────────────
 * Next inlines the flight payload and the bootstrap in `<script>` tags with
 * no nonce, so a policy without `'unsafe-inline'` is a white page. Doing it
 * properly means generating a nonce per request in the middleware and
 * threading it through, which is a real change to a file that currently
 * decides access and nothing else — worth doing, not worth doing halfway.
 *
 * So this is not an XSS-injection defence, and it should not be described as
 * one. What it is: a boundary on where a page may send data and what it may
 * load. `connect-src` names the only two hosts the browser ever calls, so an
 * injected script cannot post what it scraped to an address of its choosing.
 * `object-src 'none'`, `base-uri 'self'` and `form-action 'self'` close the
 * three classic pivots that survive most XSS filters — a plugin, a rewritten
 * relative-URL base, and a form that submits somewhere else.
 *
 * ── `style-src` allows inline for a reason that is not going away ────────
 * Motion animates by writing style attributes, which `style-src` governs.
 * There is no nonce for an attribute.
 */
function contentSecurityPolicy(): string {
  /*
   * The API the browser actually calls. Read here rather than hardcoded: it
   * differs per deployment, and a policy naming the wrong host fails as a
   * site whose data never loads.
   *
   * The warning matters more than it looks. This value is baked into the
   * policy at build time, so a production build that cannot see
   * NEXT_PUBLIC_API_URL ships a CSP whose `connect-src` names localhost — and
   * the failure is a deployed site where every fetch is blocked by the
   * browser, with nothing in the server logs because the request was never
   * made. Said out loud here, it appears in the build output next to the
   * commit that caused it.
   *
   * A warning and not a throw: `next build` is also run locally against a
   * local API, and a build step that refuses to run on a developer's machine
   * gets worked around rather than fixed.
   */
  const api = originOf(process.env.NEXT_PUBLIC_API_URL) ?? "http://localhost:4000";

  if (isProduction && api.includes("localhost")) {
    // Both are named, and both are printed as the build actually sees them.
    // The first version of this said "is not set" in every case, which was a
    // lie half the time — a variable pasted over from .env.local still holds
    // a localhost URL, and a log that misreports which of the two states it
    // is in sends you to the wrong settings page. Neither value is a secret:
    // one is public by construction and the other is an address.
    const publicUrl = process.env.NEXT_PUBLIC_API_URL;
    const serverUrl = process.env.API_URL;

    console.warn("");
    console.warn("  WARNING: this production build points at localhost.");
    console.warn("    NEXT_PUBLIC_API_URL = " + (publicUrl ?? "(not set)"));
    console.warn("    API_URL             = " + (serverUrl ?? "(not set)"));
    console.warn("  The Content-Security-Policy allows connections to " + api + " only,");
    console.warn("  so every API call from the deployed site will be blocked by the browser.");
    console.warn("  Set NEXT_PUBLIC_API_URL to the deployed API, including its /api path.");
    console.warn("");
  }

  const directives: Record<string, string[]> = {
    "default-src": ["'self'"],
    "script-src": [
      "'self'",
      "'unsafe-inline'",
      // Turbopack's dev runtime evaluates. Never in a build.
      ...(isProduction ? [] : ["'unsafe-eval'"]),
    ],
    "style-src": ["'self'", "'unsafe-inline'"],
    // `next/font` self-hosts, so there is no Google host to allow here.
    "font-src": ["'self'", "data:"],
    "img-src": [
      "'self'",
      "data:",
      "blob:",
      // The same hosts as `images.remotePatterns` above. Two lists that have
      // to agree is a real cost; the alternative is an optimiser that fetches
      // a host the browser then refuses to paint.
      "https://i.ytimg.com",
      "https://yt3.googleusercontent.com",
      "https://images.unsplash.com",
      "https://vicunfiltered.wordpress.com",
      "https://*.files.wordpress.com",
      "https://res.cloudinary.com",
    ],
    "media-src": ["'self'", "blob:", "https://res.cloudinary.com"],
    "connect-src": [
      "'self'",
      // `blob:` is not optional here. The press-pass on the About page is a
      // GLTF model, and three.js loads the textures packed inside it by
      // handing the decoder a blob URL — a fetch, so `connect-src` governs
      // it, not `img-src`. Without this the model loads and renders untextured
      // while the console fills with "couldn't load texture".
      "blob:",
      "data:",
      api,
      // The media library uploads straight from the browser against a
      // signature this app mints.
      "https://api.cloudinary.com",
      // Hot reload.
      ...(isProduction ? [] : ["ws:", "wss:"]),
    ],
    // Reports are embedded, and only from the no-cookie host.
    "frame-src": ["https://www.youtube-nocookie.com", "https://www.youtube.com"],
    // Decoders that three.js may run off the main thread. Same blob URL
    // mechanism, different directive.
    "worker-src": ["'self'", "blob:"],
    "object-src": ["'none'"],
    "base-uri": ["'self'"],
    "form-action": ["'self'"],
    "frame-ancestors": ["'none'"],
  };

  const policy = Object.entries(directives)
    .map(([directive, values]) => `${directive} ${values.join(" ")}`)
    .join("; ");

  return isProduction ? `${policy}; upgrade-insecure-requests` : policy;
}

/** `https://api.example.com/api` → `https://api.example.com`, or null. */
function originOf(url: string | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

export default nextConfig;
