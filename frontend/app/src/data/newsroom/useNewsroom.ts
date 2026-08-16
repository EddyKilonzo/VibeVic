"use client";

import { useSyncExternalStore } from "react";
import { getServerSnapshot, getSnapshot, subscribe } from "./store";
import type { Newsroom } from "./types";

/**
 * Read the newsroom.
 *
 * `useSyncExternalStore` rather than context, because the store is a genuine
 * external system: it is written from event handlers, from other tabs, and
 * eventually from a server. Every consumer re-renders from the same snapshot,
 * so two screens can never disagree about what is saved.
 */
export function useNewsroom(): Newsroom {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

export * from "./store";
export * from "./types";
