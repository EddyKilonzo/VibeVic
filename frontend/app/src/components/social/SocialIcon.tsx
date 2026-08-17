import { Facebook, Instagram, Youtube } from "lucide-react";
import type { SocialAccount } from "@/data/content";

/**
 * Substack's mark.
 *
 * Lucide has no Substack glyph, and the alternatives — a generic newspaper or
 * an RSS symbol — would read as "some feed" rather than as the platform his
 * writing is actually on. This is Substack's own mark, drawn at Lucide's 24
 * viewBox so it lines up with the rest at the same `h-4 w-4`. It is filled
 * rather than stroked because that is what the mark is; the surrounding icons
 * are stroked, but a wrong-looking logo is worse than a mixed icon set.
 */
function SubstackMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden
      focusable="false"
    >
      <path d="M22.539 8.242H1.46V5.406h21.08v2.836zM1.46 10.812V24L12 18.11 22.54 24V10.812H1.46zM22.54 0H1.46v2.836h21.08V0z" />
    </svg>
  );
}

/**
 * The right mark for an account.
 *
 * Keyed on the account's `id` rather than its display label, so renaming
 * "YouTube" to "The channel" somewhere cannot silently swap the icon.
 */
/**
 * TikTok and X, for the same reason as Substack above: Lucide has neither, and
 * a generic music note or a bird would be worse than wrong. Both drawn at the
 * same 24 viewBox so they line up with the stroked icons at one size.
 */
function TikTokMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden focusable="false">
      <path d="M16.6 5.82A4.28 4.28 0 0 1 15.54 3h-3.09v12.4a2.59 2.59 0 1 1-1.85-2.48V9.77a5.68 5.68 0 1 0 4.94 5.63V8.87a7.35 7.35 0 0 0 4.3 1.38V7.16a4.29 4.29 0 0 1-3.24-1.34Z" />
    </svg>
  );
}

function XMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden focusable="false">
      <path d="M18.9 2H22l-6.77 7.73L23 22h-6.9l-4.6-6.1L6.2 22H3l7.06-8.06L2 2h6.9l4.3 5.7L18.9 2Zm-1.2 18h1.7L7.4 3.8H5.6L17.7 20Z" />
    </svg>
  );
}

export function SocialIcon({
  id,
  className,
}: {
  id: SocialAccount["id"];
  className?: string;
}) {
  if (id === "instagram") return <Instagram className={className} aria-hidden />;
  if (id === "facebook") return <Facebook className={className} aria-hidden />;
  if (id === "substack") return <SubstackMark className={className} />;
  if (id === "tiktok") return <TikTokMark className={className} />;
  if (id === "x") return <XMark className={className} />;
  return <Youtube className={className} aria-hidden />;
}
