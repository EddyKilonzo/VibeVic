import { google } from "@ai-sdk/google";
import { APICallError, generateText, Output, type LanguageModel } from "ai";
import { z } from "zod";
import { getGenres } from "@/data/server";
import { isUnlocked } from "@/lib/newsroom-auth";

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

function pitchModel(): { model: LanguageModel; keyName: string } {
  return {
    // Overridable because free-tier model availability moves, and the fix for
    // "this model is not on your tier" should be an env var rather than a
    // deploy. `gemini-2.5-flash` is the conservative fallback.
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
  if (!(await isUnlocked())) {
    return Response.json({ error: "Not signed in to the newsroom." }, { status: 401 });
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

function explain(cause: unknown): string {
  if (APICallError.isInstance(cause)) {
    if (badKey(cause)) {
      return "The model provider refused the API key. Check GOOGLE_GENERATIVE_AI_API_KEY — retrying with the same key will not work.";
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
  if (APICallError.isInstance(cause)) {
    if (badKey(cause)) return 503;
    if (exhausted(cause) || cause.statusCode === 429) return 429;
  }
  return 502;
}
