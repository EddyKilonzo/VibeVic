import { google } from "@ai-sdk/google";
import { APICallError, type LanguageModel } from "ai";

/**
 * The model call, and what to say when it fails.
 *
 * ── Why this exists now and not before ───────────────────────────────────
 * `pitch/route.ts` and `critique/route.ts` each carried their own copy of the
 * model lookup and the failure taxonomy, and the second one said so in a
 * comment: a shared version would have needed a configuration object to
 * produce two strings, which was more machinery than the duplication cost,
 * and "if a third model route appears, that is the point to extract it".
 *
 * Four appeared at once — filing, timeline, figures, transcription — so this
 * is that point. The configuration object it warned about turned out to be a
 * single string, because the only thing that actually varied between the two
 * copies was the name of the environment variable each one told you to check.
 *
 * ── What every caller gets by using this ─────────────────────────────────
 * The same three distinctions, which matter because they send whoever reads
 * them to three different places:
 *
 *   * a key that is wrong        → a setting to fix, and retrying will not help
 *   * an allowance that is spent → a wait, or a lighter model
 *   * a queue that stalled       → a wait, and the draft is untouched
 *
 * The free tier stalls in bursts rather than being slow — the pitch route
 * records one trivial call measured at 216 seconds and the same call at 3.6
 * seconds an hour later — so "the model is slow" is almost never the true
 * sentence, and every message here avoids implying it.
 */

/** Each purpose reads its own `<PURPOSE>_MODEL`, then `PITCH_MODEL`, then this. */
const DEFAULT_MODEL = "gemini-3.7-flash";

/** The one key every model route needs. Named in the failure sentences. */
export const KEY_NAME = "GOOGLE_GENERATIVE_AI_API_KEY";

export interface Purpose {
  /** Upper-snake prefix: "CRITIQUE" reads `CRITIQUE_MODEL`, `CRITIQUE_TIMEOUT_MS`. */
  env: string;
  /** Default ceiling in ms. Must stay under `maxDuration` — see the note there. */
  budgetMs: number;
}

export function assistModel(purpose: Purpose): LanguageModel {
  return google(
    process.env[`${purpose.env}_MODEL`] ?? process.env.PITCH_MODEL ?? DEFAULT_MODEL,
  );
}

export function budgetMs(purpose: Purpose): number {
  const configured = Number(process.env[`${purpose.env}_TIMEOUT_MS`]);
  return Number.isFinite(configured) && configured > 0 ? configured : purpose.budgetMs;
}

/**
 * The key check, as a response rather than a throw.
 *
 * 503 and not 500: nothing is broken, the deployment was never given a key.
 * Returned before any work happens, because a route that spends a model call
 * and *then* discovers it has no key has spent nothing and waited anyway.
 */
export function missingKey(): Response | null {
  if (process.env[KEY_NAME]) return null;
  return Response.json(
    { error: `No model key is configured. Set ${KEY_NAME} and restart, and this comes alive.` },
    { status: 503 },
  );
}

/**
 * The `APICallError` inside whatever the SDK actually threw.
 *
 * `generateText` retries, and on giving up it throws an `AI_RetryError` whose
 * `lastError` is the call that failed. `APICallError.isInstance(cause)` is
 * therefore false on the object that arrives in a catch block, and every
 * branch keyed off it silently falls through to the generic message — which
 * is how a free-tier demand spike came back as "the model could not be
 * reached", sending whoever read it to check the network.
 *
 * Both link names are walked because the SDK spells it `lastError` and plain
 * errors spell it `cause`, and this has to survive either.
 */
function apiError(cause: unknown): APICallError | null {
  for (let error: unknown = cause, depth = 0; error && depth < 5; depth += 1) {
    if (APICallError.isInstance(error)) return error;
    const next = error as { lastError?: unknown; cause?: unknown };
    error = next.lastError ?? next.cause;
  }
  return null;
}

function looksLike(error: APICallError, pattern: RegExp): boolean {
  return pattern.test(error.responseBody ?? error.message);
}

/**
 * The provider is up and refusing because it is busy. Distinct from a quota,
 * which is about this account and does not clear by waiting a minute, and
 * from a bad key, which does not clear at all.
 */
function overloaded(error: APICallError): boolean {
  return (
    error.statusCode === 503 ||
    looksLike(error, /high demand|overloaded|UNAVAILABLE|try again later|temporarily/i)
  );
}

function exhausted(error: APICallError): boolean {
  return (
    looksLike(error, /credit balance|billing|quota|insufficient|RESOURCE_EXHAUSTED/i) ||
    error.statusCode === 402
  );
}

function badKey(error: APICallError): boolean {
  return (
    error.statusCode === 401 ||
    error.statusCode === 403 ||
    looksLike(error, /API_KEY_INVALID|api key not valid|PERMISSION_DENIED|unauthenticated/i)
  );
}

/**
 * Unwrapped rather than checked at the top level: the SDK nests the abort
 * inside its own error, so `cause.name === "AbortError"` is false on the
 * object that actually arrives here.
 */
function timedOut(cause: unknown): boolean {
  for (let error: unknown = cause, depth = 0; error && depth < 4; depth += 1) {
    const name = (error as { name?: unknown }).name;
    if (name === "TimeoutError" || name === "AbortError") return true;
    error = (error as { cause?: unknown }).cause;
  }
  return false;
}

export function explain(cause: unknown, purpose: Purpose): string {
  if (timedOut(cause)) {
    return `The model did not answer within ${Math.round(
      budgetMs(purpose) / 1000,
    )} seconds, so the request was dropped. Nothing was changed. The free tier queues in bursts and usually clears — try again in a few minutes.`;
  }

  const error = apiError(cause);
  if (error) {
    if (badKey(error)) {
      return `The model provider refused the API key. Check ${KEY_NAME} — retrying with the same key will not work.`;
    }
    if (exhausted(error)) {
      return `The free model allowance is used up for now. It resets — try again later, or set ${purpose.env}_MODEL to a lighter model.`;
    }
    if (overloaded(error)) {
      return "The model is busy — the free tier spikes and it usually clears within a minute or two. Nothing was changed; try again shortly.";
    }
    if (error.statusCode === 429) {
      return "The model is rate-limited right now. Give it a minute and try again.";
    }
  }
  return "The model could not be reached. Nothing was changed; try again.";
}

export function statusFor(cause: unknown): number {
  if (timedOut(cause)) return 504;
  const error = apiError(cause);
  if (error) {
    if (badKey(error)) return 503;
    // 429 for all three of exhausted, overloaded and rate-limited: they are
    // the same instruction to a caller — wait, then retry — and differ only
    // in the sentence, which `explain` already tells apart.
    if (exhausted(error) || overloaded(error) || error.statusCode === 429) return 429;
  }
  return 502;
}

/** One catch block, written once. Logs with the route's own tag. */
export function modelFailure(tag: string, cause: unknown, purpose: Purpose): Response {
  console.error(`[${tag}]`, cause);
  return Response.json({ error: explain(cause, purpose) }, { status: statusFor(cause) });
}
