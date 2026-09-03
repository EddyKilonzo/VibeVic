import { google } from "@ai-sdk/google";
import { APICallError, generateText, type LanguageModel } from "ai";
import { buildBriefing } from "@/lib/mia/briefing";
import { sessionWithScope } from "@/lib/newsroom-auth";

/**
 * Mia.
 *
 * ── What she is, precisely ───────────────────────────────────────────────
 * An assistant that answers questions about *this* newsroom, from what it
 * actually contains, on the asker's own token. Not a chatbot with general
 * knowledge and a personality: a reader of the briefing in
 * `lib/mia/briefing.ts` and nothing else.
 *
 * That constraint is the whole design. A newsroom tool whose assistant might
 * confidently state a figure it invented is a tool that will eventually put an
 * invented figure in front of a journalist who is tired — and the premise of
 * this product is that nothing published is invented. So Mia is given the
 * facts, told those are all she has, and told to say so when the answer is not
 * among them.
 *
 * ── Why one assistant serves the writer and the dev ──────────────────────
 * The briefing differs; the assistant does not. A writer's has drafts,
 * deadlines and the notebook in it; a dev's has drafts, deadlines and the
 * deployment's diagnostics. Every fetch behind it is guarded by the scope its
 * own route requires, so the dev's Mia has never seen the notebook — not
 * filtered out of an answer, never in the prompt. One assistant, two honest
 * views, and no branch in this file that could be got wrong.
 *
 * ── What she cannot do ───────────────────────────────────────────────────
 * Anything. There are no tools, no writes, and no path from an answer to a
 * record: the worst outcome of a bad answer is a sentence the reader
 * disagrees with. Where something needs doing she names the screen that does
 * it — a suggestion a person then carries out, which is the point of
 * `stories:publish` belonging to a person at all.
 */

export const dynamic = "force-dynamic";

/** The Hobby ceiling, as everywhere else. Over 60 fails the deploy. */
export const maxDuration = 60;

const DEFAULT_MODEL = "gemini-3.7-flash";

function miaModel(): { model: LanguageModel; keyName: string } {
  return {
    model: google(process.env.MIA_MODEL ?? process.env.PITCH_MODEL ?? DEFAULT_MODEL),
    keyName: "GOOGLE_GENERATIVE_AI_API_KEY",
  };
}

/**
 * Shorter than the pitch desk's 55 seconds, deliberately.
 *
 * A pitch is a considered request somebody makes once and waits for. Mia is
 * asked in passing, from a side panel, usually about something the reader
 * could find in two clicks — and a side panel that spins for the best part of
 * a minute is one that gets closed. Failing earlier is the better answer here.
 */
function budgetMs(): number {
  const configured = Number(process.env.MIA_TIMEOUT_MS);
  return Number.isFinite(configured) && configured > 0 ? configured : 45_000;
}

const SYSTEM = `You are Mia, the assistant inside a one-person newsroom in Kenya. You are speaking to the person who runs it.

You are given a briefing: a list of facts read from the newsroom's own database moments ago. That briefing is the only thing you know.

Rules you follow exactly:

- Answer only from the briefing. If the answer is not in it, say plainly that you cannot see it from here, and name the screen that would show it. Never guess a number, a title, a date or a name.
- Never state anything about the world outside the briefing — no facts about people, places, organisations or events, however confident you feel.
- Do not offer to write, rewrite or draft any part of an article. That is the writer's work, and there is a separate tool for notes on a draft.
- Be brief. Two or three sentences unless a list is genuinely the answer. This is read in a side panel, not a document.
- Plain British English. No exclamation marks, no "great question", no encouragement, no emoji.
- You take no actions and can change nothing. Where something needs doing, name the screen: the dashboard, Stories, Drafts, Records, Curation, Ideas, Media, Analytics, Diagnostics or Accounts.`;

export async function POST(request: Request) {
  /*
   * `newsroom:read` — the floor both roles hold.
   *
   * Mia is for whoever is signed in, and what differs between them is the
   * briefing rather than permission to ask. The scopes that matter are checked
   * where each fact is fetched, which is the only place they can be checked
   * correctly.
   */
  const gate = await sessionWithScope("newsroom:read");
  if (!gate.ok) {
    return Response.json(
      {
        error:
          gate.status === 401
            ? "Not signed in to the newsroom."
            : "Mia reads the newsroom, so she needs newsroom access.",
      },
      { status: gate.status },
    );
  }

  let question = "";
  try {
    const body = (await request.json()) as { question?: unknown };
    question = typeof body.question === "string" ? body.question.trim().slice(0, 600) : "";
  } catch {
    return Response.json({ error: "That request could not be read." }, { status: 400 });
  }

  if (!question) {
    return Response.json({ error: "Ask her something." }, { status: 400 });
  }

  /*
   * The briefing is built whether or not a model can be reached.
   *
   * It is the honest half of this feature — real figures, read a moment ago —
   * and it is returned on every failure below, because most of what gets asked
   * here is answerable by reading it. An assistant that goes completely silent
   * when a third party is rate-limited is worse than one that hands over what
   * it was about to read.
   */
  const briefing = await buildBriefing(gate.session.role);

  const { model, keyName } = miaModel();
  if (!process.env[keyName]) {
    return Response.json(
      {
        error: `Mia needs a model key to answer in sentences. Set ${keyName} — the briefing is real either way.`,
        briefing: briefing.lines,
        used: briefing.used,
      },
      { status: 503 },
    );
  }

  try {
    const { text } = await generateText({
      model,
      system: SYSTEM,
      abortSignal: AbortSignal.timeout(budgetMs()),
      prompt: [
        "The briefing, read from the database just now:",
        ...briefing.lines.map((line) => `- ${line}`),
        briefing.failures.length > 0
          ? `\nCould not be read at all: ${briefing.failures.join(", ")}. Say so if the question depends on one of them.`
          : "",
        "",
        `The question: ${question}`,
      ]
        .filter(Boolean)
        .join("\n"),
    });

    return Response.json({
      answer: text.trim(),
      // What she was actually given, so the panel can show it. An assistant
      // that shows its sources is one a journalist can check, and checking is
      // the habit this whole product is built around.
      used: briefing.used,
      failures: briefing.failures,
    });
  } catch (cause) {
    console.error("[mia]", cause);
    return Response.json(
      { error: explain(cause), briefing: briefing.lines, used: briefing.used },
      { status: statusFor(cause) },
    );
  }
}

/* ── Failures, told apart — the shape the other model routes settled on ── */

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
    return `Mia did not answer within ${Math.round(
      budgetMs() / 1000,
    )} seconds. The free tier queues in bursts and usually clears — what she was reading is below.`;
  }
  if (APICallError.isInstance(cause)) {
    if (cause.statusCode === 401 || cause.statusCode === 403) {
      return `The model provider refused the API key. Check ${miaModel().keyName} — retrying will not help.`;
    }
    if (cause.statusCode === 429) {
      return "Mia is rate-limited right now. What she was reading is below, and it is current.";
    }
  }
  return "Mia could not be reached. What she was reading is below, and it is current.";
}

function statusFor(cause: unknown): number {
  if (timedOut(cause)) return 504;
  if (APICallError.isInstance(cause)) {
    if (cause.statusCode === 401 || cause.statusCode === 403) return 503;
    if (cause.statusCode === 429) return 429;
  }
  return 502;
}
