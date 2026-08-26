/**
 * Audio analytics.
 *
 * Records what actually happened during playback, locally, so the journalist
 * can eventually answer one question: do readers prefer listening?
 *
 * Deliberately real and deliberately small. Nothing here invents a number —
 * an article that has never been played reports no plays, and the dashboard
 * renders that as "no data yet" rather than as a zero-shaped chart.
 *
 * ── Two stores now, answering two questions ──────────────────────────────
 * This one is still local and still per-device, and that is right for what it
 * holds: playback rates, seeks, which voice, completion ratios — a detailed
 * record of one browser, useful for tuning the player and useless as an
 * audience figure.
 *
 * The listening *time* is also reported to the API, anonymously, because that
 * is the part a journalist can actually ask a question of. See
 * `recordAudioEvent` below and `lib/reader-events` for exactly what leaves.
 */

import { recordListen } from "@/lib/reader-events";

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

  /**
   * The sink this file always said it was waiting for.
   *
   * The note at the top of this module read: "Swapping `sink` for a POST to a
   * real endpoint is the only change needed to make this a product metric."
   * This is that change, and it is an addition rather than a swap — the local
   * store stays, because the two answer different questions.
   *
   * The device keeps the detail: playback rates, seek behaviour, which voice,
   * completion ratios. That is a debugging record of one browser and is no use
   * as an audience figure. What goes to the server is the part that is: how
   * long somebody listened, attributed to nobody. `reader-events` explains what
   * that request does and does not carry.
   *
   * Only the two events that measure time are forwarded. A "play" is a button
   * press and inflates with every pause and resume; "pause" and "complete"
   * carry the seconds actually listened since the last one.
   */
  if ((event.type === "pause" || event.type === "complete") && event.seconds) {
    recordListen(event.slug, event.seconds);
  }
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
