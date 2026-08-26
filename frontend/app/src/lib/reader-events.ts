"use client";

/**
 * Telling the API that somebody read something.
 *
 * ── What this sends, and what it refuses to ──────────────────────────────
 * Three fields: which story, what happened, and a random per-tab string. No
 * address, no user agent, no referrer, no screen size, no timestamp — the
 * server stamps the time itself, because a client that could backdate its own
 * traffic is a client that can shape the numbers.
 *
 * The per-tab string is not an identity and cannot become one. It is minted
 * fresh in `sessionStorage`, so it dies with the tab, it is not a cookie and is
 * never sent to anything but this endpoint, and the server writes it into a
 * column it never reads back out. It exists to answer "is this the same visit"
 * — which is what stops one reader pressing reload twenty times from reading as
 * twenty people — and it cannot answer "who is this".
 *
 * That distinction is the whole reason a journalism site can carry this at all,
 * and it is why there is no third-party script here and never should be.
 *
 * ── Failure is silence ───────────────────────────────────────────────────
 * Every function returns void and nothing throws. A reader's article page must
 * not report a problem about a number they will never see, and a blocked
 * request — an extension, an offline train, a strict privacy setting — is a
 * perfectly ordinary thing for this to hit. The count is simply not made.
 */

const BASE = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api").replace(/\/+$/, "");

const SESSION_KEY = "vv:session";

/**
 * The per-tab id.
 *
 * `sessionStorage`, deliberately, not `localStorage`: the second would persist
 * across visits and turn this into a returning-reader identifier, which is
 * exactly the thing this must not become. A new tab is a new visit and counts
 * once more, which is the honest reading of "a visit".
 *
 * Returns null when storage is unavailable — a private window with storage
 * blocked, or an embedded context. Nothing is sent in that case, because a
 * request without a session id would be an uncountable row.
 */
function sessionId(): string | null {
  if (typeof window === "undefined") return null;

  try {
    const existing = window.sessionStorage.getItem(SESSION_KEY);
    if (existing) return existing;

    // 16 hex characters. Enough that two visits in the same second do not
    // collide, short enough to be obviously not a fingerprint.
    const minted =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID().replace(/-/g, "").slice(0, 16)
        : Math.random().toString(36).slice(2).padEnd(16, "0").slice(0, 16);

    window.sessionStorage.setItem(SESSION_KEY, minted);
    return minted;
  } catch {
    return null;
  }
}

type Kind = "VIEW" | "READ" | "LISTEN";

/**
 * Sent once per kind per story per tab, on this side too.
 *
 * The server deduplicates properly — a unique index per story, kind, session
 * and day — so this is not what makes the number right. It is here to avoid
 * making a request whose answer is already known, which on a phone on mobile
 * data is a courtesy worth extending.
 *
 * LISTEN is exempt: seconds accumulate across a session, so each report adds to
 * the total rather than repeating a fact already stated.
 */
const sent = new Set<string>();

function send(slug: string, kind: Kind, seconds?: number): void {
  const session = sessionId();
  if (!session || !slug) return;

  const once = `${kind}:${slug}`;
  if (kind !== "LISTEN") {
    if (sent.has(once)) return;
    sent.add(once);
  }

  const url = `${BASE}/stories/${encodeURIComponent(slug)}/events`;
  const body = JSON.stringify({ kind, session, ...(seconds ? { seconds } : {}) });

  try {
    /**
     * `sendBeacon` first, and it matters more than it looks.
     *
     * A READ fires as the reader reaches the end of a piece, which is very
     * often the moment they close the tab or hit back. A `fetch` started then is
     * cancelled by the navigation and the count is lost — precisely for the
     * readers who finished, which would bias the one metric that says whether
     * anybody is finishing. `sendBeacon` is queued by the browser and survives
     * the page going away.
     */
    if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
      // Sent as a plain text blob. An `application/json` beacon is a preflighted
      // cross-origin request, and a preflight cannot be sent during unload — so
      // the beacon would be dropped exactly when it is most needed. The API
      // reads the body, not the header.
      const blob = new Blob([body], { type: "text/plain;charset=UTF-8" });
      if (navigator.sendBeacon(url, blob)) return;
    }

    // Falls through when sendBeacon is missing or refuses (it returns false if
    // the queue is full). `keepalive` gives fetch the same survive-unload
    // property, within a smaller size budget that this payload is well inside.
    void fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true,
    }).catch(() => {
      // Silence, by design. See the note at the top of this file.
    });
  } catch {
    // Silence, by design.
  }
}

/** The article was opened. */
export function recordView(slug: string): void {
  send(slug, "VIEW");
}

/** The reader reached the end of it. */
export function recordRead(slug: string): void {
  send(slug, "READ");
}

/**
 * The piece was played aloud, for this many seconds.
 *
 * Reported rather than counted per press: `VoiceProvider` already tracks
 * seconds between play and pause, and sending that is both more useful and
 * harder to inflate than counting how many times somebody hit play.
 */
export function recordListen(slug: string, seconds: number): void {
  if (seconds <= 0) return;
  send(slug, "LISTEN", Math.round(seconds));
}
