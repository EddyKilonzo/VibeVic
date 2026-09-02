import { google } from "@ai-sdk/google";
import { APICallError, generateText, Output, type LanguageModel } from "ai";
import { z } from "zod";
import { getGenres } from "@/data/server";
import { sessionWithScope } from "@/lib/newsroom-auth";

/**
 * The pitch desk.
 *
 * Takes a line a journalist has written down and gives back the shape of the
 * reporting: angles worth taking, who would have to be called, and the
 * questions the piece would have to answer. It does not write the piece, and
 * it does not decide what matters.
 *
 * ── What it deliberately does not return ─────────────────────────────────
 * A priority. `AdminIdeas` says it plainly — "software that ranked a
 * journalist's ideas would be claiming to know which story matters, and it
 * does not" — and a model returning `priority: "high"` is exactly that claim
 * wearing a schema. The field stays typed by hand.
 *
 * Nor any fact. Every angle is a line of inquiry, phrased as something to
 * find out; the prompt is explicit that it must not assert what happened, and
 * the UI labels the whole panel as suggestion. On a site whose premise is
 * that nothing published is invented, a model's guess must never be able to
 * reach a page by being mistaken for reporting.
 *
 * ── Runtime ──────────────────────────────────────────────────────────────
 * Node, which is the default and what this needs. There is no reason to reach
 * for the edge here: the work is one model call, the payload is small, and
 * `node:crypto` is what the newsroom check runs on.
 */
/*
 * ── The two clocks, and why there have to be two ─────────────────────────
 * `maxDuration` is what the platform allows before it kills the function.
 * `budgetMs` below is what this route allows before it gives up on its own.
 * They are not the same number and the second must be smaller, because what
 * happens when each expires is completely different.
 *
 * When the platform's clock wins, the function is destroyed mid-call. There
 * is no handler, no JSON, and no message — the browser receives a gateway
 * error page, `response.json()` throws on the HTML, and the catch in
 * `PitchDesk` reports "the request never left the browser", which is the one
 * explanation that is definitely false.
 *
 * That is the failure this route was actually producing. The free tier stalls
 * — during one such stall the same trivial call was measured at 216 seconds,
 * and at 3.6 seconds an hour later — so the model is not slow, it is
 * occasionally queued for minutes. A route with no clock of its own turns
 * that occasional stall into an error message that sends the writer to check
 * their wifi, and the stall is invisible in the logs because the handler
 * never got to write one.
 *
 * When this route's own clock wins, an `AbortError` lands in the catch below
 * and comes back as a sentence naming what to change.
 *
 * ── Why this is 60 and not 300 ───────────────────────────────────────────
 * Because this project deploys on Vercel's Hobby plan, where 60 seconds is
 * the ceiling and asking for more is not clamped — it fails the deployment.
 * A number that reads better in a diff is not worth a build that does not
 * ship, so the ceiling is written as what it actually is, with the way to
 * raise it named rather than assumed: on a plan that allows longer functions
 * this becomes 300, and `PITCH_TIMEOUT_MS` becomes the number that matters.
 *
 * The consequence is worth stating plainly rather than hiding behind the
 * constant. A stalled free-tier queue can outlast sixty seconds by minutes,
 * so on this plan the honest outcome of one is a clear refusal at 55 seconds
 * rather than an answer. That is a real limit and not a bug to be fixed here:
 * the pitch arrives in a few seconds when the queue is clear, which is most
 * of the time, and the error text says what to do when it is not.
 */
export const maxDuration = 60;

/**
 * The model, named in exactly one place.
 *
 * ── Why this is a function and not an inline argument ────────────────────
 * The provider has now changed twice — the Vercel AI Gateway, then Anthropic
 * directly, now Google — and each time the edit reached into the middle of the
 * `generateText` call and its surrounding comment. That is the wrong shape for
 * something that is a deployment decision rather than a design one: which model
 * answers has never changed what this route *means*. Putting the choice behind
 * one function means the next swap is this block and nothing else.
 *
 * ── Why Google, and what it costs ────────────────────────────────────────
 * Gemini's free tier has no card behind it, which is the whole reason: the
 * Anthropic account this route used to spend against ran out of credit, and a
 * feature that stops working when a balance hits zero is a feature a one-person
 * newsroom cannot rely on. The tier is rate-limited rather than capped in
 * money, so the failure mode is "wait" rather than "top up".
 *
 * ── What that trade actually is, said plainly ────────────────────────────
 * Free-tier prompts may be used to improve Google's products. What this route
 * sends is an unpublished story idea and the journalist's own note about it,
 * and that note can describe a source. That is a real editorial cost and it was
 * weighed rather than missed. Two things follow, and neither is optional:
 * nothing here should ever be sent a source's identity, and moving to a paid
 * tier or a local model is a one-line change in this function by design.
 */
const DEFAULT_MODEL = "gemini-3.7-flash";

/**
 * How long this route waits before giving up and saying so.
 *
 * ── Why the default is 55 seconds and not 290 ────────────────────────────
 * Because it has to be under the *platform's* ceiling, and this code does not
 * know what that ceiling is. `maxDuration = 300` is a request; a plan that
 * caps functions at sixty seconds silently clamps it, and a budget of 290 on
 * such a plan would never be reached — the function would be killed first and
 * the whole point of having a budget would be lost. 55 is under the smallest
 * cap this app can be deployed onto, so the route answers for itself
 * everywhere.
 *
 * ── And why it is an environment variable ────────────────────────────────
 * Because 55 seconds is the right answer to this plan and not to every plan.
 * On one that allows five minutes it would refuse work that was about to
 * succeed — the stalls are long but they do end — and raising it there should
 * not require a code change. Lowering it is the right move if a minute of
 * waiting is worse than no pitch at all, which on a phone it usually is.
 */
function budgetMs(): number {
  const configured = Number(process.env.PITCH_TIMEOUT_MS);
  return Number.isFinite(configured) && configured > 0 ? configured : 55_000;
}

function pitchModel(): { model: LanguageModel; keyName: string } {
  return {
    // Overridable because free-tier model availability moves, and the fix for
    // "this model is not on your tier" should be an env var rather than a
    // deploy.
    //
    // The fallback named here used to be `gemini-2.5-flash`, and it had
    // already stopped being one: that model answers 404 for keys created
    // after it was retired — "no longer available to new users. Please
    // update your code to use models/gemini-3.6-flash" — so the documented
    // escape hatch was itself broken, which is the worst state for an escape
    // hatch to be in. `gemini-3.6-flash` is the current conservative choice.
    model: google(process.env.PITCH_MODEL ?? DEFAULT_MODEL),
    keyName: "GOOGLE_GENERATIVE_AI_API_KEY",
  };
}

/**
 * The pitch schema, built per request around the beats that actually exist.
 *
 * It used to be a module-level constant over the compiled `GENRES`. The
 * taxonomy is a database read now, so the enum has to be built once the beats
 * are known — which is the right shape anyway: the model is constrained to
 * beats the archive really has, so a suggestion can never file a story under a
 * subject nobody created.
 */
function buildPitchSchema(slugs: [string, ...string[]]) {
  return z.object({
  angles: z
    .array(
      z.object({
        angle: z.string().describe("One line: the story this would be, as a line of inquiry."),
        why: z.string().describe("One sentence on what makes it worth the reporting time."),
        difficulty: z.enum(["quick", "moderate", "hard"]).describe("How much work to stand it up."),
      }),
    )
    .min(2)
    .max(4),
  sources: z
    .array(z.string().describe("A kind of person or record to go to, not a named individual."))
    .min(3)
    .max(6),
  questions: z
    .array(z.string().describe("A question the finished piece must be able to answer."))
    .min(3)
    .max(6),
  beat: z.enum(slugs).describe("The slug of the beat this would file under."),
  caution: z
    .string()
    .describe("One sentence on what would make this story wrong, unfair, or not a story."),
  });
}

const SYSTEM = `You are helping a working journalist in Kenya think through an idea they have just written down.

Return angles, sources and questions — the shape of the reporting. Follow these rules exactly:

- Never assert a fact about the subject. You do not know what happened. Every angle is phrased as something to find out, not something that is true.
- Never name a real individual as a source. Name the role, office, register or record to approach.
- Never invent statistics, dates, quotes, or the existence of documents.
- Questions are the ones the finished piece must answer, not questions for the reporter's editor.
- The caution names what would make this unfair, thin, or not a story at all — the reason to drop it.
- Plain British English. No hype, no headline language, no "explosive" or "shocking".`;

export async function POST(request: Request) {
  /*
   * The notebook's scope, not merely a session.
   *
   * This desk works up an unpublished story idea, which is the writer's own
   * thinking rather than material for a piece that has been decided on — the
   * same argument `newsroom:ideas` exists to make on the API. Checking it
   * here rather than leaving it to the API matters more than usual: there is
   * no API call in this handler to be refused. The model call happens
   * locally, and an unscoped request would spend it before anybody said no.
   */
  const gate = await sessionWithScope("newsroom:ideas");
  if (!gate.ok) {
    return Response.json(
      {
        error:
          gate.status === 401
            ? "Not signed in to the newsroom."
            : "The pitch desk is the writer's. Working up an idea is reporting, not maintenance.",
      },
      { status: gate.status },
    );
  }

  // Checked here rather than left to the SDK, which fails at call time with a
  // provider error a journalist cannot act on. This says which name to set,
  // and asks the model function rather than hardcoding the variable — so a
  // provider swap cannot leave this branch naming the wrong key.
  const { model, keyName } = pitchModel();
  if (!process.env[keyName]) {
    return Response.json(
      { error: `No model key is configured. Set ${keyName} and restart, and this comes alive.` },
      { status: 503 },
    );
  }

  let idea = "";
  let note = "";
  try {
    const body = (await request.json()) as { idea?: unknown; note?: unknown };
    idea = typeof body.idea === "string" ? body.idea.trim().slice(0, 400) : "";
    note = typeof body.note === "string" ? body.note.trim().slice(0, 2000) : "";
  } catch {
    return Response.json({ error: "That request could not be read." }, { status: 400 });
  }

  if (!idea) {
    return Response.json({ error: "Write the idea down first." }, { status: 400 });
  }

  const genres = await getGenres();
  if (genres.length === 0) {
    // Without the taxonomy there is nothing to constrain the model to, and an
    // unconstrained beat is a filing suggestion for a subject that may not
    // exist. Refusing beats guessing.
    return Response.json(
      { error: "The beat list could not be read, so a pitch cannot be filed. Try again." },
      { status: 503 },
    );
  }

  const slugs = genres.map((g) => g.slug) as [string, ...string[]];
  const Pitch = buildPitchSchema(slugs);
  const beatList = genres.map((g) => `${g.slug} — ${g.name}`).join("\n");

  try {
    const { output } = await generateText({
      model,
      system: SYSTEM,
      // The route's own clock. Without it the only limit is the platform's,
      // and the platform's limit is not a failure this handler can describe —
      // see the note on `maxDuration`.
      abortSignal: AbortSignal.timeout(budgetMs()),
      output: Output.object({ schema: Pitch }),
      prompt: [
        `The idea: ${idea}`,
        note ? `What the journalist already knows: ${note}` : null,
        "",
        "File it under exactly one of these beat slugs:",
        beatList,
      ]
        .filter(Boolean)
        .join("\n"),
    });

    return Response.json(output);
  } catch (cause) {
    // The real error goes to the server log, where it belongs. What comes back
    // is a sentence for a journalist — but which sentence depends on the
    // failure, and that is the whole point of what follows.
    console.error("[pitch]", cause);
    return Response.json({ error: explain(cause) }, { status: statusFor(cause) });
  }
}

/**
 * Telling a permanent failure from a temporary one.
 *
 * ── Why this is not one message ──────────────────────────────────────────
 * Every failure here used to come back as "The model could not be reached.
 * Nothing was saved; try again." — which is true of a dropped connection and
 * false of nearly everything else. A key that was never valid will not become
 * valid on the second press, and a journalist told to try again would press it
 * until they gave up. So the cases that actually happen are separated, on the
 * same reasoning `newsroom-api.ts` uses for 501 against 502: one is a settings
 * problem, one is an outage, and they send whoever reads them to different
 * places.
 *
 * ── Written for two providers, deliberately ──────────────────────────────
 * The checks below match on both status and message because the two providers
 * this route has run on report the same conditions differently — Anthropic
 * answers 400 for an exhausted balance, Gemini answers 429 for an exhausted
 * quota. Matching only what the current provider does would mean this file
 * silently degrades to a generic 502 the next time `pitchModel` changes, which
 * is precisely when a clear error matters most.
 */
function looksLike(error: APICallError, pattern: RegExp): boolean {
  return pattern.test(error.responseBody ?? error.message);
}

/** Out of money (a paid tier) or out of allowance (a free one). */
function exhausted(error: APICallError): boolean {
  return (
    looksLike(error, /credit balance|billing|quota|insufficient|RESOURCE_EXHAUSTED/i) ||
    error.statusCode === 402
  );
}

/** The key is missing, malformed, revoked, or not entitled to this model. */
function badKey(error: APICallError): boolean {
  return (
    error.statusCode === 401 ||
    error.statusCode === 403 ||
    looksLike(error, /API_KEY_INVALID|api key not valid|PERMISSION_DENIED|unauthenticated/i)
  );
}

/**
 * The route's own clock ran out.
 *
 * `AbortSignal.timeout` rejects with a `TimeoutError`; an abort from
 * somewhere else — the client hanging up — arrives as `AbortError`. Both mean
 * the same thing to this handler, and the SDK may hand either one back
 * wrapped, so the check reads the name off the cause chain rather than
 * matching on one class.
 */
function timedOut(cause: unknown): boolean {
  for (let error: unknown = cause, depth = 0; error && depth < 4; depth += 1) {
    const name = (error as { name?: unknown }).name;
    if (name === "TimeoutError" || name === "AbortError") return true;
    error = (error as { cause?: unknown }).cause;
  }
  return false;
}

function explain(cause: unknown): string {
  if (timedOut(cause)) {
    /*
     * "Try again" is honest here, and it is put first, because it is usually
     * right: these stalls are the free tier queueing rather than anything
     * being broken, and they clear. The two settings that change the outcome
     * for a stall that does not clear are named after it, in the order
     * somebody would reach for them.
     */
    return `The model did not answer within ${Math.round(budgetMs() / 1000)} seconds, so the request was dropped. Nothing was saved. The free tier queues in bursts and usually clears — try again in a few minutes. If it keeps happening, set PITCH_MODEL to a lighter model such as gemini-3.1-flash-lite.`;
  }

  if (APICallError.isInstance(cause)) {
    if (badKey(cause)) {
      return `The model provider refused the API key. Check ${pitchModel().keyName} — retrying with the same key will not work.`;
    }
    if (exhausted(cause)) {
      // Phrased for the free tier, which is what this runs on: the daily cap
      // resets, so "come back later" is true here in a way it was not when the
      // route was spending a balance that only a payment would refill.
      return "The free model allowance is used up for now. It resets — try again later, or set PITCH_MODEL to a lighter model.";
    }
    if (cause.statusCode === 429) {
      return "The model is rate-limited right now. Give it a minute and try again.";
    }
  }
  return "The model could not be reached. Nothing was saved; try again.";
}

/**
 * 503 for "this desk is not usable until someone changes a setting", 429 for
 * "not right now, but soon", 502 for a genuine outage. The route already
 * answers 503 for a missing key and a missing beat list, so an unusable desk
 * answering 503 is the shape the caller has been handling all along.
 */
function statusFor(cause: unknown): number {
  // 504, and it is the accurate one: an upstream that did not answer in time.
  // Not 502 — nothing refused us and nothing was unreachable — and not 429,
  // which would say the allowance is spent when it is not.
  if (timedOut(cause)) return 504;
  if (APICallError.isInstance(cause)) {
    if (badKey(cause)) return 503;
    if (exhausted(cause) || cause.statusCode === 429) return 429;
  }
  return 502;
}
