import { generateText, Output } from "ai";
import { z } from "zod";
import { GENRES } from "@/data/content";
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

/** The beats a suggestion is allowed to name — the real taxonomy, nothing invented. */
const BEAT_SLUGS = GENRES.map((g) => g.slug) as [string, ...string[]];

const Pitch = z.object({
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
  beat: z.enum(BEAT_SLUGS).describe("The slug of the beat this would file under."),
  caution: z
    .string()
    .describe("One sentence on what would make this story wrong, unfair, or not a story."),
});

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

  if (!process.env.AI_GATEWAY_API_KEY) {
    return Response.json(
      {
        error:
          "No AI Gateway key is configured. Set AI_GATEWAY_API_KEY and restart, and this comes alive.",
      },
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

  const beatList = GENRES.map((g) => `${g.slug} — ${g.name}`).join("\n");

  try {
    const { output } = await generateText({
      // A plain provider string through the Gateway: the model is config, not
      // code, and swapping it is a one-word change with no new dependency.
      model: "anthropic/claude-sonnet-5",
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
    // The message is for a journalist, not a stack trace reader. The real one
    // goes to the server log, where it belongs.
    console.error("[pitch]", cause);
    return Response.json(
      { error: "The model could not be reached. Nothing was saved; try again." },
      { status: 502 },
    );
  }
}
