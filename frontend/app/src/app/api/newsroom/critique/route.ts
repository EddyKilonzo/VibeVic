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
  /**
   * Phrasing, named as a habit rather than fixed as a sentence.
   *
   * This is the field that comes closest to the line the whole route is drawn
   * around, so the shape enforces the line rather than trusting the prompt.
   * `habit` names what the writing is doing — a buried subject, stacked
   * hedges, a nominalisation carrying a verb's work — `where` points at the
   * passage, and `direction` says what would fix it. There is no `instead`
   * field, and its absence is the mechanism: a schema with nowhere to put a
   * rewritten sentence cannot return one, whatever a prompt says. Replacement
   * prose gets pasted in, and then a machine has written part of the article.
   */
  phrasing: z
    .array(
      z.object({
        where: z.string().describe("The passage: 'the second paragraph', 'the final sentence'."),
        habit: z.string().describe("What the writing is doing, named as a habit."),
        direction: z.string().describe("What would fix it. Never a replacement sentence."),
      }),
    )
    .max(4),
  /**
   * Where a reader is likely to stop, and what in the text loses them.
   *
   * Not "how to make this more engaging", which is the advice that produces
   * hype. Attention is a concrete, locatable thing: a reader leaves at a
   * particular sentence, usually because the piece has stopped telling them
   * something or has made them work for the next fact. So each note points at
   * a passage and names the cause. `hold` is its opposite — the moment that
   * earns the next paragraph — because a writer who knows what is working can
   * do more of it, and a list of only weaknesses is a list nobody acts on.
   */
  attention: z
    .array(
      z.object({
        where: z.string().describe("The passage a reader is most likely to leave at."),
        why: z.string().describe("What in the text loses them there. One or two sentences."),
      }),
    )
    .max(3),
  hold: z
    .string()
    .describe("The moment that most earns the next paragraph, named specifically."),
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
- "Phrasing" names habits in the prose — a buried subject, stacked hedges, a noun doing a verb's work, a sentence whose real point arrives last. Name the habit and the passage, and say what direction would fix it. Never write the fixed sentence.
- "Attention" is where a reader is most likely to stop reading, and what in the text loses them there. Point at a passage. Never give general advice about engagement, and never suggest adding drama, urgency or a hook.
- "Hold" names the single moment that most earns the next paragraph.
- Where a house style guide is given, treat it as binding and prefer its terms over your own instincts.
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

  const BODY_LIMIT = 24_000;

  let title = "";
  let dek = "";
  let body = "";
  let beat = "";
  let styleGuide: string[] = [];
  let truncated = false;
  try {
    const payload = (await request.json()) as {
      title?: unknown;
      dek?: unknown;
      body?: unknown;
      beat?: unknown;
      styleGuide?: unknown;
    };
    title = typeof payload.title === "string" ? payload.title.trim().slice(0, 300) : "";
    dek = typeof payload.dek === "string" ? payload.dek.trim().slice(0, 600) : "";
    beat = typeof payload.beat === "string" ? payload.beat.trim().slice(0, 80) : "";

    /*
     * The house style guide, which the counted half of the coach has always
     * had and this half never did.
     *
     * `findHouseStyle` in `lib/intelligence/checks.ts` reads the newsroom's
     * own style guide and flags a term it lists as one to avoid. The read did
     * not see it at all, so half the coach was house-specific and half was
     * generic — and the generic half was the one giving advice about wording.
     * Passing it makes the read this newsroom's, rather than a desk editor's
     * in the abstract.
     */
    styleGuide = Array.isArray(payload.styleGuide)
      ? payload.styleGuide.filter((line): line is string => typeof line === "string").slice(0, 60)
      : [];
    /*
     * The body is capped, and the cap is a real limit rather than a formality.
     * A long feature past this point is read in part — and the panel now
     * genuinely says so, which is what this comment claimed before there was
     * anything in the response for it to say it with. Notes on the first two
     * thirds of a piece, presented as notes on the piece, are quietly wrong
     * about the ending, and the writer had no way to tell which they had.
     */
    const whole = typeof payload.body === "string" ? payload.body.trim() : "";
    truncated = whole.length > BODY_LIMIT;
    body = whole.slice(0, BODY_LIMIT);
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
        beat ? `Beat: ${beat}` : null,
        styleGuide.length > 0
          ? `House style for this newsroom, which is binding:\n${styleGuide
              .map((line) => `- ${line}`)
              .join("\n")}`
          : null,
        title ? `Headline: ${title}` : null,
        dek ? `Standfirst: ${dek}` : null,
        // Said to the model as well as to the writer. Without it the read
        // comments confidently on "the ending" of a piece whose ending it was
        // never shown, which is the most misleading thing it could do.
        truncated
          ? "This draft has been cut short at the point where it ends below. Do not comment on the ending, and do not treat the last line you see as the ending."
          : null,
        "",
        "The draft:",
        body,
      ]
        .filter((line) => line !== null)
        .join("\n"),
    });

    /*
     * `truncated` travels with the notes so the panel can say the read covers
     * only part of the piece. Without it, the writer of a long feature gets an
     * editor's read that is silently about two thirds of their work.
     */
    return Response.json({ ...output, truncated });
  } catch (cause) {
    return modelFailure("critique", cause, PURPOSE);
  }
}
