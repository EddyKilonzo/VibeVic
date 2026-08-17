import { Instagram, Youtube } from "lucide-react";
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
export function SocialIcon({
  id,
  className,
}: {
  id: SocialAccount["id"];
  className?: string;
}) {
  if (id === "instagram") return <Instagram className={className} aria-hidden />;
  if (id === "substack") return <SubstackMark className={className} />;
  return <Youtube className={className} aria-hidden />;
}
