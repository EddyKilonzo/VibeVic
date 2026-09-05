import { generateText, Output } from "ai";
import { z } from "zod";
import { sessionWithScope } from "@/lib/newsroom-auth";
import { assistModel, budgetMs, missingKey, modelFailure, type Purpose } from "@/lib/assist/model";

/**
 * The sequence a piece describes, pulled out of the piece.
 *
 * A journalist who has written "the notice went up on the twentieth of
 * January and nobody had visited by the end of February" has already built a
 * timeline; they simply built it in prose. This reads it back out as
 * candidate `TimelineEvent` rows so the reporting record can be captured as a
 * by-product of the writing rather than as a second job afterwards, which is
 * the job that does not get done.
 *
 * ── Nothing here is written ──────────────────────────────────────────────
 * This route has no write path at all — it cannot reach the records API, and
 * that is structural rather than a promise. Candidates come back, the writer
 * accepts the ones that are right, and the accept posts to
 * `/api/newsroom/records/timeline` from the browser under their own session.
 * A model that could file a timeline event directly would be a model writing
 * to the reporting record, which is the one place this product cannot allow
 * a guess to land unexamined.
 *
 * ── Dates are the whole difficulty ───────────────────────────────────────
 * `occurredAt` is required by the DTO and is the date of the event, never the
 * date of the note about it — the schema comment on the API side is explicit
 * that the two drift apart constantly. So the model is given today's date to
 * resolve "last Tuesday" against, is told to refuse rather than guess when a
 * date is genuinely absent, and every candidate carries the `quote` it was
 * drawn from. The writer checks the sentence, not the model's confidence.
 *
 * `precision` exists because a piece often fixes an event to a month or a
 * year and no closer. Forcing that into an ISO instant would invent a day.
 * The field records what was actually known so the UI can show "January 2026"
 * rather than a false 1 January.
 */

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const PURPOSE: Purpose = { env: "TIMELINE", budgetMs: 40_000 };

const SYSTEM = `You read one draft by a working journalist and extract the events it describes, in the order they happened.

Rules you follow exactly:

- Every event must be something the draft states happened. Never add an event from your own knowledge, and never infer one that the text does not describe.
- Every event must carry the sentence from the draft that it came from, copied exactly. If you cannot quote it, do not propose it.
- Dates: use only what the draft gives. Resolve relative dates ("last Tuesday", "six weeks ago") against the date you are given. If the draft fixes an event only to a month or a year, say so in "precision" and use the first instant of that month or year.
- If an event has no date in the draft at all, do not propose it. A timeline entry without a date is not a timeline entry.
- "what" is one plain sentence in the past tense, naming who did what. Not a headline, not a summary of the paragraph.
- Do not propose the publication of this article itself as an event.
- Plain British English.`;

export async function POST(request: Request) {
  const gate = await sessionWithScope("newsroom:write");
  if (!gate.ok) {
    return Response.json(
      {
        error:
          gate.status === 401
            ? "Not signed in to the newsroom."
            : "Proposing timeline events needs newsroom write access.",
      },
      { status: gate.status },
    );
  }

  const noKey = missingKey();
  if (noKey) return noKey;

  let title = "";
  let body = "";
  try {
    const payload = (await request.json()) as Record<string, unknown>;
    title = typeof payload.title === "string" ? payload.title.trim().slice(0, 300) : "";
    body = typeof payload.body === "string" ? payload.body.trim().slice(0, 24_000) : "";
  } catch {
    return Response.json({ error: "That request could not be read." }, { status: 400 });
  }

  if (body.split(/\s+/).filter(Boolean).length < 80) {
    return Response.json(
      { error: "There is not enough written yet to have a sequence in it." },
      { status: 400 },
    );
  }

  const Timeline = z.object({
    events: z
      .array(
        z.object({
          occurredAt: z
            .string()
            .describe("ISO 8601 instant. First instant of the month or year when only that is known."),
          precision: z
            .enum(["day", "month", "year"])
            .describe("How precisely the draft actually fixes this date."),
          what: z.string().max(1000).describe("One past-tense sentence naming who did what."),
          quote: z
            .string()
            .describe("The sentence from the draft this came from, copied exactly."),
        }),
      )
      .max(12),
  });

  try {
    const { output } = await generateText({
      model: assistModel(PURPOSE),
      system: SYSTEM,
      abortSignal: AbortSignal.timeout(budgetMs(PURPOSE)),
      output: Output.object({ schema: Timeline }),
      prompt: [
        `Today's date is ${new Date().toISOString().slice(0, 10)}.`,
        "",
        title ? `Headline: ${title}` : null,
        "",
        "The draft:",
        body,
      ]
        .filter(Boolean)
        .join("\n"),
    });

    /*
     * A date the model returned that does not parse is dropped here rather
     * than shown. The schema can require a string that says it is ISO 8601;
     * it cannot require that it is one, and a candidate whose accept button
     * would produce a 400 from the API is worse than one fewer candidate.
     */
    const events = output.events.filter((event) => !Number.isNaN(Date.parse(event.occurredAt)));

    return Response.json({ events, dropped: output.events.length - events.length });
  } catch (cause) {
    return modelFailure("assist/timeline", cause, PURPOSE);
  }
}
