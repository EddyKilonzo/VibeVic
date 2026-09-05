import { generateText, Output } from "ai";
import { z } from "zod";
import { newsroomFetch } from "@/lib/newsroom-api";
import { sessionWithScope } from "@/lib/newsroom-auth";
import { assistModel, budgetMs, missingKey, modelFailure, type Purpose } from "@/lib/assist/model";

/**
 * Every figure in the draft, against the records actually filed for it.
 *
 * ── Why this is the one worth having ─────────────────────────────────────
 * `findStatistics` in `lib/intelligence/checks.ts` already flags a number
 * with no attribution *near it in the text*, and it is right, instantly, for
 * free. What it cannot do is know whether the attribution is true. "According
 * to the county water company" satisfies a regex looking for the word
 * "according"; it says nothing about whether anybody ever filed a record of
 * the county water company saying it.
 *
 * That is the check this route makes, and it is the rare thing a model is
 * both good at and safe doing here: matching numbers in prose against
 * evidence, quotes and sources the journalist filed themselves. It never
 * consults the world. A figure it cannot find is reported as *not in your
 * records*, which is a fact about the filing cabinet — never as wrong, which
 * would be a claim about reality that this route has no standing to make.
 *
 * ── What it is given ─────────────────────────────────────────────────────
 * Evidence, quotes and sources for this story only, and only the fields that
 * carry a figure or its provenance. Not the confidential body of anything:
 * the fetches run on the caller's own token, so a writer without
 * `newsroom:confidential` gets a briefing with those rows already absent —
 * filtered by the API in its `where` clause rather than by this file, which
 * is the difference between a record being hidden and it never being read.
 *
 * ── Why a story id is required ───────────────────────────────────────────
 * Checking a draft's figures against the whole newsroom's records would find
 * a number somewhere and report a match that means nothing. The question is
 * whether *this piece* is sourced, so the records are the ones linked to this
 * piece, and an unsaved draft is refused rather than answered loosely.
 */

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const PURPOSE: Purpose = { env: "FIGURES", budgetMs: 45_000 };

interface EvidenceRow {
  id: string;
  title?: string;
  summary?: string;
  url?: string;
  storyIds?: string[];
}
interface QuoteRow {
  id: string;
  text?: string;
  speaker?: string;
  storyIds?: string[];
}
interface SourceRow {
  id: string;
  name?: string;
  role?: string;
  notes?: string;
  storyIds?: string[];
}

const SYSTEM = `You check the figures in a draft against the records a journalist has filed for that piece.

You are given the draft, and a list of records: evidence, quotes and sources. Those records are the only thing you may check against.

Rules you follow exactly:

- Find every figure in the draft: numbers, percentages, quantities, money, counts, dates used as data.
- For each one, say whether it appears in the records you were given, and name the record if it does.
- You are checking the filing cabinet, not the world. If a figure is not in the records, that means it is not recorded here — never that it is wrong, doubtful or false. Never say a figure is incorrect.
- Never supply a figure, a correction or a source of your own. You know nothing beyond the draft and the records.
- Ignore figures that are part of a name or an address rather than a claim.
- Plain British English, no hedging language, no advice about journalism in general.`;

export async function POST(request: Request) {
  const gate = await sessionWithScope("newsroom:read");
  if (!gate.ok) {
    return Response.json(
      {
        error:
          gate.status === 401
            ? "Not signed in to the newsroom."
            : "Checking figures reads the newsroom's records, so it needs newsroom access.",
      },
      { status: gate.status },
    );
  }

  const noKey = missingKey();
  if (noKey) return noKey;

  let storyId = "";
  let body = "";
  try {
    const payload = (await request.json()) as Record<string, unknown>;
    storyId = typeof payload.storyId === "string" ? payload.storyId : "";
    body = typeof payload.body === "string" ? payload.body.trim().slice(0, 24_000) : "";
  } catch {
    return Response.json({ error: "That request could not be read." }, { status: 400 });
  }

  if (!storyId) {
    return Response.json(
      {
        error:
          "Let the piece save once first — figures are checked against the records filed for it.",
      },
      { status: 400 },
    );
  }
  if (body.split(/\s+/).filter(Boolean).length < 40) {
    return Response.json(
      { error: "There is not enough written yet to have figures in it." },
      { status: 400 },
    );
  }

  /*
   * Each collection on its own, and a failure recorded rather than thrown —
   * the argument `lib/mia/briefing.ts` makes, and it holds here too. A check
   * that ran against evidence and quotes while the sources endpoint was slow
   * is still worth having, provided it says which cabinet it could not open.
   */
  const missing: string[] = [];
  const pull = async <T,>(label: string, path: string): Promise<T[]> => {
    try {
      return await newsroomFetch<T[]>(path);
    } catch {
      missing.push(label);
      return [];
    }
  };

  const mine = <T extends { storyIds?: string[] }>(rows: T[]) =>
    rows.filter((row) => row.storyIds?.includes(storyId));

  const [evidence, quotes, sources] = await Promise.all([
    pull<EvidenceRow>("evidence", "/newsroom/evidence").then(mine),
    pull<QuoteRow>("quotes", "/newsroom/quotes").then(mine),
    pull<SourceRow>("sources", "/newsroom/sources").then(mine),
  ]);

  const records = [
    ...evidence.map(
      (row) => `EVIDENCE ${row.id}: ${row.title ?? ""}. ${row.summary ?? ""} ${row.url ?? ""}`,
    ),
    ...quotes.map((row) => `QUOTE ${row.id}: ${row.speaker ?? "unknown"} said: ${row.text ?? ""}`),
    ...sources.map((row) => `SOURCE ${row.id}: ${row.name ?? ""}, ${row.role ?? ""}. ${row.notes ?? ""}`),
  ];

  /*
   * No records is answered here rather than by the model. Asking it to match
   * figures against an empty list spends a call to be told every figure is
   * unmatched, which is a sentence this route can write for free — and a
   * screen full of unmatched findings would read as an indictment of the
   * draft when the true state is simply that nothing has been filed yet.
   */
  if (records.length === 0) {
    return Response.json({
      figures: [],
      recordsChecked: 0,
      unreadable: missing,
      note: "Nothing is filed against this piece yet, so there is nothing to check its figures against. File the evidence, quotes or sources behind them in Records first.",
    });
  }

  const Figures = z.object({
    figures: z
      .array(
        z.object({
          figure: z.string().describe("The figure exactly as it appears in the draft."),
          sentence: z.string().describe("The sentence it appears in, copied from the draft."),
          found: z.boolean().describe("Whether it appears in the records provided."),
          record: z
            .string()
            .optional()
            .describe("The id of the record it was found in, when found is true."),
          note: z
            .string()
            .describe("One clause. Where it was found, or that it is not in the records."),
        }),
      )
      .max(25),
  });

  try {
    const { output } = await generateText({
      model: assistModel(PURPOSE),
      system: SYSTEM,
      abortSignal: AbortSignal.timeout(budgetMs(PURPOSE)),
      output: Output.object({ schema: Figures }),
      prompt: ["Records filed for this piece:", ...records, "", "The draft:", body].join("\n"),
    });

    return Response.json({
      ...output,
      recordsChecked: records.length,
      unreadable: missing,
    });
  } catch (cause) {
    return modelFailure("assist/figures", cause, PURPOSE);
  }
}
