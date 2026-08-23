/** Formatting helpers shared by the public site and the admin. */

/**
 * One locale, named.
 *
 * Every formatter here used to pass `undefined`, which means "whatever the
 * runtime's default is" — and the runtime is two different machines. Node
 * resolved to en-GB and rendered "27 February 2026" into the HTML; a browser
 * set to en-US rendered "February 27, 2026" over the top of it, and React
 * threw a hydration error on every story page and re-rendered the tree. A
 * date is content, and content cannot depend on the reader's system settings
 * without being wrong for half of them at build time.
 *
 * en-GB because it is the convention the site is written in and the one the
 * published pages already carry: day before month, no comma.
 */
export const LOCALE = "en-GB";

const DATE_FORMAT: Intl.DateTimeFormatOptions = {
  day: "numeric",
  month: "long",
  year: "numeric",
};

export function formatDate(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(+date) ? iso : date.toLocaleDateString(LOCALE, DATE_FORMAT);
}

export function formatShortDate(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(+date)
    ? iso
    : date.toLocaleDateString(LOCALE, { day: "numeric", month: "short", year: "numeric" });
}

/** "3 days ago", "last month" — for admin lists where recency is the point. */
export function formatRelative(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return iso;

  const diff = Date.now() - then;
  const rtf = new Intl.RelativeTimeFormat(LOCALE, { numeric: "auto" });
  const units: Array<[Intl.RelativeTimeFormatUnit, number]> = [
    ["year", 31536000000],
    ["month", 2592000000],
    ["week", 604800000],
    ["day", 86400000],
    ["hour", 3600000],
    ["minute", 60000],
  ];

  for (const [unit, ms] of units) {
    if (Math.abs(diff) >= ms) return rtf.format(-Math.round(diff / ms), unit);
  }
  return "just now";
}

/** mm:ss, or h:mm:ss past an hour. Used by the voice player. */
export function formatTime(totalSeconds: number): string {
  if (!Number.isFinite(totalSeconds) || totalSeconds < 0) totalSeconds = 0;
  const seconds = Math.floor(totalSeconds % 60);
  const minutes = Math.floor((totalSeconds / 60) % 60);
  const hours = Math.floor(totalSeconds / 3600);
  const mm = hours ? String(minutes).padStart(2, "0") : String(minutes);
  return `${hours ? `${hours}:` : ""}${mm}:${String(seconds).padStart(2, "0")}`;
}

/** "8 min listen" — spoken length, which differs from reading length. */
export function formatDuration(totalSeconds: number): string {
  const minutes = Math.max(1, Math.round(totalSeconds / 60));
  return `${minutes} min`;
}

export function formatCompact(value: number): string {
  return new Intl.NumberFormat(LOCALE, { notation: "compact", maximumFractionDigits: 1 }).format(
    value,
  );
}

export function formatPercent(fraction: number, decimals = 0): string {
  return `${(fraction * 100).toFixed(decimals)}%`;
}
