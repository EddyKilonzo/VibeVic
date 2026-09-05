import { generateText, Output } from "ai";
import { z } from "zod";
import { getGenres } from "@/data/server";
import { sessionWithScope } from "@/lib/newsroom-auth";
import { assistModel, budgetMs, missingKey, modelFailure, type Purpose } from "@/lib/assist/model";

/**
 * Where this piece is filed: a beat, and some tags.
 *
 * ── Why this is the safest thing on the assist surface ───────────────────
 * Filing is not reporting. A beat is one of a closed list the newsroom
 * already defined, and a tag is a retrieval aid — neither is a claim about
 * the world, so a wrong answer costs a dropdown correction rather than a
 * false sentence in front of a reader. That is why this is the one route here
 * that proposes a value for a field the writer would otherwise type, and why
 * it is still a proposal rather than an assignment.
 *
 * ── The beat is chosen from the list, not invented ───────────────────────
 * The genres are read from the database and passed in the prompt, and the
 * schema constrains the answer to those slugs with `z.enum`. A model that
 * returns a beat that does not exist would produce a story row pointing at no
 * genre, which the API's foreign key would refuse — so the failure would be a
 * confusing 400 at save time rather than here. Constraining the output is
 * what turns that into an impossibility instead of an error message.
 *
 * Tags are free text and deliberately are not constrained, because the tag
 * vocabulary is not closed and pretending it is would mean the useful new tag
 * can never be proposed. They are capped in number and length instead.
 */

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const PURPOSE: Purpose = { env: "FILING", budgetMs: 25_000 };

const SYSTEM = `You file drafts in a one-person newsroom in Kenya. You are given a draft and the list of beats that exist.

Rules you follow exactly:

- Choose the beat from the list you are given, by its slug. Never invent one.
- Tags are for finding this piece again later: the people, places, institutions and recurring subjects it is actually about. Lower case, two or three words at most each.
- Never propose a tag for something the draft does not mention. A tag is a claim that the piece covers something.
- Do not tag the beat itself; that is already recorded separately.
- Say why the beat was chosen in one short clause, naming what in the draft decided it.`;

export async function POST(request: Request) {
  const gate = await sessionWithScope("stories:write");
  if (!gate.ok) {
    return Response.json(
      {
        error:
          gate.status === 401
            ? "Not signed in to the newsroom."
            : "Filing a draft needs the editor's scope.",
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
    const payload = (await request.json()) as Record<string, unknown>;
    title = typeof payload.title === "string" ? payload.title.trim().slice(0, 300) : "";
    dek = typeof payload.dek === "string" ? payload.dek.trim().slice(0, 600) : "";
    body = typeof payload.body === "string" ? payload.body.trim().slice(0, 12_000) : "";
  } catch {
    return Response.json({ error: "That request could not be read." }, { status: 400 });
  }

  // Lower than the critique's floor. Filing is decided by what a piece is
  // about, which a headline and two paragraphs already say; a full read is
  // not needed to know this is an agriculture story.
  if (`${title} ${dek} ${body}`.split(/\s+/).filter(Boolean).length < 25) {
    return Response.json(
      { error: "Write a headline and an opening first — there is nothing here to file yet." },
      { status: 400 },
    );
  }

  const genres = await getGenres().catch(() => []);
  const slugs = genres.map((genre) => genre.slug);
  if (slugs.length === 0) {
    return Response.json(
      { error: "The beat list could not be read, so there is nothing to choose from." },
      { status: 502 },
    );
  }

  const Filing = z.object({
    // `[string, ...string[]]` because z.enum needs a non-empty tuple, and the
    // guard above has already established that this one is.
    beat: z.enum(slugs as [string, ...string[]]).describe("The slug of the beat this belongs to."),
    why: z.string().describe("One short clause naming what in the draft decided the beat."),
    tags: z.array(z.string().max(40)).min(2).max(8).describe("Lower-case retrieval tags."),
  });

  try {
    const { output } = await generateText({
      model: assistModel(PURPOSE),
      system: SYSTEM,
      abortSignal: AbortSignal.timeout(budgetMs(PURPOSE)),
      output: Output.object({ schema: Filing }),
      prompt: [
        "Beats available (slug — name):",
        ...genres.map((genre) => `${genre.slug} — ${genre.name}`),
        "",
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
    return modelFailure("assist/filing", cause, PURPOSE);
  }
}
