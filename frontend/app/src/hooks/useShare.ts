"use client";

import { useCallback, useState } from "react";

/**
 * Share this, by whatever route the device actually has.
 *
 * ── Why this is a hook and not three copies ──────────────────────────────
 * It was two, and they had already drifted. `ArticleActionBar` tried
 * `navigator.share` first and fell back to our own sheet; the video page
 * opened the sheet directly and never asked the platform at all — so on a
 * phone, sharing a report gave you four networks in a web panel while
 * sharing an article gave you the list of apps you actually use. Adding a
 * third caller on the cards is what made keeping them in step stop being
 * optional.
 *
 * ── Platform first, ours second ──────────────────────────────────────────
 * On a phone `navigator.share` opens the apps the reader has, including every
 * one this product has never heard of, and it is the only route to AirDrop or
 * "Save to Files". Our sheet is the fallback for desktop browsers, which
 * mostly do not implement it — and for the odd case where the platform sheet
 * refuses a payload.
 *
 * A dismissed native sheet rejects with `AbortError`. That is the reader
 * saying no, so nothing opens in its place; anything else is a real failure
 * and falls through to the sheet we control.
 *
 * ── Why the URL is built at call time ────────────────────────────────────
 * `window.location.origin` rather than a configured base, read inside the
 * handler rather than during render. The link a reader shares should point at
 * the host they are actually on — a preview deployment shared as production
 * is a link to a different version of the piece — and reading `window` during
 * render is both impure and wrong on the server.
 */
export interface ShareTarget {
  title: string;
  /** One line of context. Optional: the platform sheet renders it, ours does not. */
  text?: string;
  /** A path on this site, e.g. "/stories/the-quiet-ledger". */
  path: string;
}

export interface Share {
  /** Try the platform, then ours. Safe to pass straight to `onClick`. */
  share: () => void;
  /** True while our own sheet should be mounted. */
  sheetOpen: boolean;
  closeSheet: () => void;
}

export function useShare({ title, text, path }: ShareTarget): Share {
  const [sheetOpen, setSheetOpen] = useState(false);

  const share = useCallback(() => {
    const url = `${window.location.origin}${path}`;

    if (typeof navigator.share !== "function") {
      setSheetOpen(true);
      return;
    }

    /*
     * Not awaited by the caller. `onClick` handlers that return a promise
     * swallow rejections silently in some browsers, and the interesting
     * outcome — the reader dismissed it — is not an error worth surfacing
     * anywhere.
     */
    void navigator
      .share({ title, ...(text ? { text } : {}), url })
      .catch((error: unknown) => {
        if ((error as DOMException | undefined)?.name === "AbortError") return;
        // A permissions-policy block, an unsupported payload, a platform that
        // advertises the API and then refuses. Ours works in all of them.
        setSheetOpen(true);
      });
  }, [title, text, path]);

  const closeSheet = useCallback(() => setSheetOpen(false), []);

  return { share, sheetOpen, closeSheet };
}
