"use client";

import type { Genre } from "@/data/types";
import { GENRES } from "@/data/content";

/**
 * Beats added from the workspace.
 *
 * The seven in `data/content` are compiled into the site: the public routes
 * call `generateStaticParams` over them, so a beat that exists only in this
 * browser cannot have a public page and the admin says so rather than
 * implying otherwise. What it *can* do is give a draft somewhere to be filed
 * — which is the thing a journalist needs the moment a story arrives that
 * belongs to none of the existing seven.
 *
 * When the API lands, `listCustom` becomes a fetch and the merge below stops
 * being local. Nothing else in the admin needs to know the difference.
 */

const KEY = "vv:beats";

export interface CustomBeat extends Genre {
  /** ISO, so the list can be ordered by when the beat was opened. */
  createdAt: string;
}

export function listCustomBeats(): CustomBeat[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as CustomBeat[];
    return Array.isArray(parsed) ? parsed.filter((b) => b?.slug && b?.name) : [];
  } catch {
    return [];
  }
}

/**
 * URL-safe slug from a beat name.
 *
 * Not decorative: the slug is the value stored on every story's `genre`
 * field, so it has to be stable and it has to be a legal path segment. The
 * normalise strips accents rather than percent-encoding them, which keeps
 * "Sécurité" a readable `securite` instead of a wall of escapes.
 */
export function slugify(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

export type AddBeatResult =
  | { ok: true; beat: CustomBeat }
  | { ok: false; reason: string };

/**
 * Adds a beat, refusing the two collisions that matter.
 *
 * A duplicate slug is not a cosmetic problem: `genre` is a foreign key, and
 * two beats sharing one would make every story filed under it ambiguous —
 * including the ones already published against the built-in beat.
 */
export function addBeat(name: string, description: string): AddBeatResult {
  const trimmed = name.trim();
  if (!trimmed) return { ok: false, reason: "Give the beat a name." };

  const slug = slugify(trimmed);
  if (!slug) return { ok: false, reason: "That name has no letters or numbers in it." };

  if (GENRES.some((g) => g.slug === slug)) {
    return { ok: false, reason: `“${trimmed}” is already one of the published beats.` };
  }

  const custom = listCustomBeats();
  if (custom.some((b) => b.slug === slug)) {
    return { ok: false, reason: `You already have a beat called “${trimmed}”.` };
  }

  const beat: CustomBeat = {
    slug,
    name: trimmed,
    description: description.trim(),
    createdAt: new Date().toISOString(),
  };

  window.localStorage.setItem(KEY, JSON.stringify([...custom, beat]));
  return { ok: true, beat };
}

export function removeBeat(slug: string): void {
  if (typeof window === "undefined") return;
  try {
    const next = listCustomBeats().filter((b) => b.slug !== slug);
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* The beat stays. Nothing here is worth an error boundary. */
  }
}

/** The built-in beats plus anything added here — what a story can be filed under. */
export function allBeats(): Genre[] {
  return [...GENRES, ...listCustomBeats()];
}
