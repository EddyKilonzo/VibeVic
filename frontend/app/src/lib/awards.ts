"use client";

import type { Award } from "@/data/types";
import { AWARDS } from "@/data/content";

/**
 * Awards recorded in the workspace.
 *
 * ── Why this store exists at all ─────────────────────────────────────────
 * `data/content` ships `AWARDS` as an empty array, and the comment above it
 * is explicit about why: inventing a prize for a real journalist would be a
 * fabricated credential. The public page therefore renders an honest empty
 * state "until real entries are added in the admin" — and until now there was
 * no admin to add them in. This is that admin, and it is the only writer of
 * award records anywhere in the product.
 *
 * ── The rule the store enforces ──────────────────────────────────────────
 * Nothing here is generated, suggested or autocompleted. There is no list of
 * plausible bodies to pick from and no default result, because a form that
 * offers "Winner" as the pre-selected answer is a form that will eventually
 * record one that was never won. Every field is typed by the person who knows
 * the answer, and the screen says in as many words that this is a credential.
 *
 * ── Where the records live ───────────────────────────────────────────────
 * This browser, like every other workspace store, and the screen says so.
 * They reach the public page when the API lands and a build follows — a
 * record here is a note the journalist made, not a claim the site is making.
 */

const KEY = "vv:awards";

export interface RecordedAward extends Award {
  id: string;
  /** ISO, so the list can be ordered by when the entry was made. */
  createdAt: string;
}

export const RESULTS: Award["result"][] = [
  "Winner",
  "Finalist",
  "Shortlisted",
  "Honourable mention",
];

export function listAwards(): RecordedAward[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as RecordedAward[];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((a) => a?.id && a?.title && a?.year)
      // Newest year first: an awards list is read as a career in reverse,
      // which is how the public timeline renders it too.
      .sort((a, b) => b.year.localeCompare(a.year));
  } catch {
    return [];
  }
}

export type AddAwardResult =
  | { ok: true; award: RecordedAward }
  | { ok: false; reason: string };

/**
 * Records an award.
 *
 * The validation is deliberately about *completeness*, not plausibility. A
 * missing awarding body is refused because "Winner, 2025" with no one to have
 * awarded it is not a credential anybody can check — and an unverifiable
 * credential on a journalist's page is worse than none. The year is bounded
 * at both ends for the same reason: a typo that files a prize in 2205 makes
 * the whole list look invented.
 */
export function addAward(input: {
  year: string;
  title: string;
  body: string;
  description: string;
  result: Award["result"];
}): AddAwardResult {
  const year = input.year.trim();
  const title = input.title.trim();
  const body = input.body.trim();

  if (!title) return { ok: false, reason: "Name the award." };
  if (!body) {
    return {
      ok: false,
      reason: "Name the body that gave it — an award with no awarding body cannot be checked.",
    };
  }
  if (!/^\d{4}$/.test(year)) return { ok: false, reason: "The year should be four digits." };

  const numeric = Number(year);
  const thisYear = new Date().getFullYear();
  if (numeric < 1900 || numeric > thisYear + 1) {
    return { ok: false, reason: `That year is outside 1900–${thisYear + 1}.` };
  }

  const existing = listAwards();
  if (
    existing.some(
      (a) => a.year === year && a.title.toLowerCase() === title.toLowerCase(),
    )
  ) {
    return { ok: false, reason: `“${title}” is already recorded for ${year}.` };
  }

  const award: RecordedAward = {
    id: `award_${Date.now().toString(36)}`,
    year,
    title,
    body,
    description: input.description.trim(),
    result: input.result,
    createdAt: new Date().toISOString(),
  };

  try {
    window.localStorage.setItem(KEY, JSON.stringify([award, ...existing]));
  } catch {
    return { ok: false, reason: "This browser refused to save it — storage is full or blocked." };
  }
  return { ok: true, award };
}

export function removeAward(id: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      KEY,
      JSON.stringify(listAwards().filter((a) => a.id !== id)),
    );
  } catch {
    /* The entry stays. Nothing here is worth an error boundary. */
  }
}

/** Puts a removed entry back verbatim — id, timestamp and all. Used by undo. */
export function restoreAward(award: RecordedAward): void {
  if (typeof window === "undefined") return;
  try {
    const next = [award, ...listAwards().filter((a) => a.id !== award.id)];
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* nothing to restore into */
  }
}

/** Everything the site would list: the compiled entries plus the recorded ones. */
export function allAwards(): Award[] {
  return [...AWARDS, ...listAwards()].sort((a, b) => b.year.localeCompare(a.year));
}
