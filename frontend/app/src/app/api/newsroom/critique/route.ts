import { generateText, Output } from "ai";
import { z } from "zod";
import { sessionWithScope } from "@/lib/newsroom-auth";
import { assistModel, budgetMs, missingKey, modelFailure, type Purpose } from "@/lib/assist/model";

/**
 * An editor's read.
 *
 * Takes a draft and gives back what a good desk editor would say after one
 * pass: where the piece loses its thread, what a reader will ask that it does
 * not answer, and which paragraph is doing the least work. It does not
 * rewrite a sentence, score the piece, or add a fact.
 *
 * ── Why this exists next to the deterministic checks, not instead of ─────
 * `lib/intelligence` measures what is countable — sentence length, repeated
 * phrases, figures with nobody attached, terms the house avoids — and it is
 * right about all of it, instantly, every time, for free. What it cannot do
 * is read. It has no opinion on whether the third paragraph should be the
 * first, because that is not a measurement.
 *
 * So the two sit side by side and are labelled differently on the screen. The
 * checks are observations; this is a suggestion from a machine, and the panel
 * says so. On a site whose premise is that nothing published is invented,
 * that distinction is not decoration.
 *
 * ── What the model is forbidden to do ────────────────────────────────────
 * Three things, in the system prompt and in the schema:
 *
 *   * Assert any fact about the subject. It has the draft and nothing else;
 *     anything it "knows" about Turkana or a ministry is training data, and
 *     training data reaching a published piece is the exact failure this
 *     newsroom is built to prevent.
 *   * Rewrite the copy. Every note names a paragraph and says what is weak
 *     about it. It never supplies replacement prose, because replacement
 *     prose gets pasted in, and then a model has written part of the article.
 *   * Score it. No mark out of ten, no grade, no "strong/weak" verdict on the
 *     whole. `AdminIdeas` makes the same refusal about ranking ideas and the
 *     reasoning carries: a number would compress incomparable things into one
 *     figure that looks authoritative and means nothing.
 *
 * ── What it is sent ──────────────────────────────────────────────────────
 * The headline, the standfirst and the body text. Not the sources, not the
 * interview notes, not the protected identity of anybody — the same rule the
 * pitch desk works under, and for the same reason: this is a free tier whose
 * prompts may be used to improve someone else's product.
 */

export const dynamic = "force-dynamic";

/** Hobby plan's ceiling. Raising it past 60 fails the deploy, not the request. */
export const maxDuration = 60;

/*
 * Model, budget and failure taxonomy now come from `lib/assist/model`.
 *
 * This file used to carry its own copies and said why: a shared version would
 * have needed a configuration object to produce two strings, which was more
 * machinery than the duplication cost — "if a third model route appears, that
 * is the point to extract it". Four appeared at once (filing, timeline,
 * figures, transcription), so it was extracted, and the configuration object
 * turned out to be one string: the env prefix below.
 *
 * The migration is not only tidiness. The shared version unwraps
 * `AI_RetryError` before classifying, which the copy here did not — so a
 * free-tier demand spike, which is what the provider actually returns most
 * often, was falling through every branch and coming back as "the model could
 * not be reached". That sent the reader to check their network for a queue
 * that clears on its own in a minute.
 */
const PURPOSE: Purpose = { env: "CRITIQUE", budgetMs: 55_000 };

/**
 * The shape of a read.
 *
 * Every field is a note *about* the draft. There is deliberately no `rewrite`,
 * no `score`, and no `summary` — a summary is the model telling the writer
 * what their own piece says, which is either right and useless or wrong and
 * worse.
 */
const Critique = z.object({
  notes: z
    .array(
      z.object({
        about: z
          .string()
          .describe(
            "Which part of the piece: 'the opening', 'the fourth paragraph', 'the ending'.",
          ),
        observation: z.string().describe("What a reader would notice. One or two sentences."),
        consider: z
          .string()
          .describe("What the writer might do about it. A direction, never replacement prose."),
      }),
    )
    .min(2)
    .max(5),
  unanswered: z
    .array(z.string().describe("A question this piece raises and does not answer."))
    .min(1)
    .max(5),
  strongest: z
    .string()
    .describe("The part that is working, named specifically and briefly. Not flattery."),
});

const SYSTEM = `You are a desk editor reading one draft by a working journalist in Kenya, once, and giving notes.

Rules you follow exactly:

- You have only the draft. You know nothing else about the subject. Never assert a fact about it, never supply a date, figure, name or event that is not already in the text, and never say whether something in it is true.
- Never write replacement prose. Do not supply a rewritten sentence, headline, or paragraph. Name what is weak and say what direction would fix it; the writer writes the words.
- Never score the piece, grade it, or give a verdict on it as a whole.
- "Unanswered" means questions a reader would be left with — not questions for the writer's editor, and not things you would like to know for your own interest.
- "Strongest" names a specific passage or move that is working, and says why in one clause. It is not praise and not encouragement.
- Plain British English. No hype, no writing-coach language, no exclamation marks.`;

export async function POST(request: Request) {
  /*
   * `stories:write` — the editor's scope, not the notebook's.
   *
   * A DEV holds it, and that is right: this reads a draft, and a dev already
   * has the whole draft open in the editor when reproducing a bug in it.
   * There is nothing here they could not read by scrolling.
   *
   * Checked here rather than left to an API call, for the reason the pitch
   * route gives: there is no API call in this handler to be refused, so an
   * unscoped request would spend the model call before anybody said no.
   */
  const gate = await sessionWithScope("stories:write");
  if (!gate.ok) {
    return Response.json(
      {
        error:
          gate.status === 401
            ? "Not signed in to the newsroom."
            : "Reading a draft needs the editor's scope.",
      },
      { status: gate.status },
    );
  }

  const noKey = missingKey();
  if (noKey) return noKey;

  let title = "";
  let dek = "";
  let body = "";
  try {
    const payload = (await request.json()) as {
      title?: unknown;
      dek?: unknown;
      body?: unknown;
    };
    title = typeof payload.title === "string" ? payload.title.trim().slice(0, 300) : "";
    dek = typeof payload.dek === "string" ? payload.dek.trim().slice(0, 600) : "";
    /*
     * The body is capped, and the cap is a real limit rather than a formality.
     * A long feature past this point is read in part — which the panel says
     * out loud, because notes on the first two thirds of a piece presented as
     * notes on the piece would be quietly wrong about the ending.
     */
    body = typeof payload.body === "string" ? payload.body.trim().slice(0, 24_000) : "";
  } catch {
    return Response.json({ error: "That request could not be read." }, { status: 400 });
  }

  // Below this there is nothing to read, and notes on two paragraphs would be
  // a machine's opinion about an outline.
  if (body.split(/\s+/).filter(Boolean).length < 120) {
    return Response.json(
      { error: "There is not enough written yet for a read. Come back with a few paragraphs." },
      { status: 400 },
    );
  }

  try {
    const { output } = await generateText({
      model: assistModel(PURPOSE),
      system: SYSTEM,
      abortSignal: AbortSignal.timeout(budgetMs(PURPOSE)),
      output: Output.object({ schema: Critique }),
      prompt: [
        title ? `Headline: ${title}` : null,
        dek ? `Standfirst: ${dek}` : null,
        "",
        "The draft:",
        body,
      ]
        .filter(Boolean)
        .join("\n"),
    });

    return Response.json(output);
  } catch (cause) {
    return modelFailure("critique", cause, PURPOSE);
  }
}
