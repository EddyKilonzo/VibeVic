/**
 * Audio analytics.
 *
 * Records what actually happened during playback, locally, so the journalist
 * can eventually answer one question: do readers prefer listening?
 *
 * Deliberately real and deliberately small. Nothing here invents a number —
 * an article that has never been played reports no plays, and the dashboard
 * renders that as "no data yet" rather than as a zero-shaped chart. Swapping
 * `sink` for a POST to a real endpoint is the only change needed to make this
 * a product metric.
 */

export type AudioEventType = "play" | "pause" | "complete" | "seek" | "rate" | "voice";

export interface AudioEvent {
  type: AudioEventType;
  slug: string;
  at: number;
  /** Seconds listened since the previous event, for "play"/"pause"/"complete". */
  seconds?: number;
  /** Playback rate in effect. */
  rate?: number;
}

export interface AudioSummary {
  slug: string;
  plays: number;
  completions: number;
  totalSeconds: number;
  /** Mean listening seconds per play. */
  avgSeconds: number;
  /** Fraction of plays that reached the end. */
  completionRate: number;
  /** Most-used playback rate. */
  commonRate: number | null;
}

const KEY = "vv:audio-events";
const MAX_EVENTS = 2000;

function read(): AudioEvent[] {
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as AudioEvent[]) : [];
  } catch {
    return [];
  }
}

function write(events: AudioEvent[]): void {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(events.slice(-MAX_EVENTS)));
  } catch {
    // Analytics must never break playback.
  }
}

export function recordAudioEvent(event: Omit<AudioEvent, "at">): void {
  const events = read();
  events.push({ ...event, at: Date.now() });
  write(events);
}

export function audioEvents(slug?: string): AudioEvent[] {
  const all = read();
  return slug ? all.filter((e) => e.slug === slug) : all;
}

export function summarise(slug: string): AudioSummary | null {
  const events = audioEvents(slug);
  if (!events.length) return null;

  const plays = events.filter((e) => e.type === "play").length;
  const completions = events.filter((e) => e.type === "complete").length;
  const totalSeconds = events.reduce((total, e) => total + (e.seconds ?? 0), 0);

  const rates = events.filter((e) => e.rate).map((e) => e.rate as number);
  const tally = new Map<number, number>();
  rates.forEach((r) => tally.set(r, (tally.get(r) ?? 0) + 1));
  const commonRate =
    [...tally.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

  return {
    slug,
    plays,
    completions,
    totalSeconds: Math.round(totalSeconds),
    avgSeconds: plays ? Math.round(totalSeconds / plays) : 0,
    completionRate: plays ? completions / plays : 0,
    commonRate,
  };
}

/** Every article with at least one recorded play. */
export function summariseAll(): AudioSummary[] {
  const slugs = [...new Set(read().map((e) => e.slug))];
  return slugs
    .map(summarise)
    .filter((s): s is AudioSummary => s !== null)
    .sort((a, b) => b.plays - a.plays);
}

export function clearAudioAnalytics(): void {
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    /* nothing to clear */
  }
}
