import { generateText, Output } from "ai";
import { z } from "zod";
import { sessionWithScope } from "@/lib/newsroom-auth";
import { assistModel, budgetMs, missingKey, modelFailure, type Purpose } from "@/lib/assist/model";

/**
 * An interview recording, turned into a transcript and candidate quotes.
 *
 * ── Why this one is worth the most ───────────────────────────────────────
 * Transcription is the heaviest manual work in a one-person newsroom, and it
 * is the work that decides whether the reporting record gets kept at all. A
 * journalist who has to type out forty minutes of tape before a single quote
 * can be filed will file the quotes from memory, or not file them. The
 * `Interview` and `StoryQuote` tables have been waiting for this.
 *
 * ── The recording is never stored ────────────────────────────────────────
 * The audio arrives in the request, goes to the model, and is gone when the
 * function returns. It is not written to Cloudinary, not put in a
 * `MediaAsset`, and not kept on disk here.
 *
 * That is a deliberate position rather than an unfinished feature. A raw
 * interview recording is the most sensitive artefact a newsroom holds — it
 * carries a source's actual voice, everything said before and after the part
 * that mattered, and every aside the person assumed was off the record.
 * Storing it by default would mean this product had quietly become the place
 * that keeps them, with all the retention, access and subpoena questions that
 * follow, none of which a one-person newsroom is equipped to answer. The
 * transcript and the quotes are the reporting record; the tape is the
 * journalist's own, and it stays on their machine.
 *
 * The one consequence worth stating: there is no re-run without the file. A
 * transcript that came back wrong is fixed by transcribing the recording
 * again, not by asking this route to think harder about something it no
 * longer has.
 *
 * ── The model proposes; nothing here writes ──────────────────────────────
 * Same rule as the rest of the assist surface, and the same structure behind
 * it: this route cannot reach the records API. Quotes come back as candidates
 * with the transcript beside them, the journalist confirms the ones that are
 * accurate, and the confirmed ones are posted to `/records/quotes` from the
 * browser. A machine-transcribed quote filed without a person hearing the tape
 * is a quotation mark around words nobody verified, which is the failure this
 * whole product is arranged to prevent.
 */

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const PURPOSE: Purpose = { env: "TRANSCRIBE", budgetMs: 55_000 };

/**
 * The size ceiling, and why it is stated in minutes as well as bytes.
 *
 * Twenty megabytes is roughly twenty minutes of speech-grade mono audio. The
 * real constraint is not the byte count but `maxDuration`: on this plan the
 * function is destroyed at sixty seconds, and a recording long enough to take
 * longer than that to process comes back as a gateway error rather than as a
 * transcript. Refusing it up front with a sentence naming the limit is the
 * honest version of the same outcome.
 */
const MAX_BYTES = 20 * 1024 * 1024;

const ACCEPTED = /^audio\/(mpeg|mp3|mp4|m4a|x-m4a|aac|wav|x-wav|webm|ogg|flac)$|^video\/(mp4|webm)$/i;

const SYSTEM = `You transcribe one interview recording for a working journalist in Kenya, and pull out the passages worth quoting.

Rules you follow exactly:

- Transcribe what is said. Never add, tidy, complete or improve a sentence. If a passage is inaudible, write [inaudible] rather than guessing at it.
- Keep the speakers apart. Label them by name if a name is used in the recording, otherwise "Interviewer" and "Speaker". Never invent a name, a title or an affiliation.
- Quotes are passages a journalist would actually use: a claim, an account, a refusal, a number, something said with force. Not pleasantries, not the interviewer's own questions.
- Every quote must be verbatim from the transcript you produced. Never paraphrase into a quote.
- Give the approximate start time of each quote in seconds from the beginning of the recording.
- Where a passage is hard to hear or the wording is uncertain, say so in "uncertain" rather than presenting it as clean.
- Never state anything about the subject that was not said in the recording.
- Plain British English for your own notes; the speech itself is transcribed as spoken.`;

export async function POST(request: Request) {
  /*
   * `newsroom:write` — this produces material for the reporting record, and
   * the notebook is the writer's. A DEV holds `stories:write` and does not
   * hold this, which is right: reproducing an editor bug never requires
   * putting somebody's interview tape through a model.
   */
  const gate = await sessionWithScope("newsroom:write");
  if (!gate.ok) {
    return Response.json(
      {
        error:
          gate.status === 401
            ? "Not signed in to the newsroom."
            : "Transcribing an interview needs newsroom write access.",
      },
      { status: gate.status },
    );
  }

  const noKey = missingKey();
  if (noKey) return noKey;

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return Response.json(
      { error: "That upload could not be read. Send the recording as a file." },
      { status: 400 },
    );
  }

  const file = form.get("audio");
  if (!(file instanceof File)) {
    return Response.json({ error: "No recording was attached." }, { status: 400 });
  }
  if (file.size === 0) {
    return Response.json({ error: "That file is empty." }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return Response.json(
      {
        error: `That recording is ${Math.round(
          file.size / 1024 / 1024,
        )}MB. The limit is ${MAX_BYTES / 1024 / 1024}MB — about twenty minutes of speech. Split a long interview and transcribe it in parts.`,
      },
      { status: 413 },
    );
  }
  if (!ACCEPTED.test(file.type)) {
    return Response.json(
      {
        error: `${file.type || "That file type"} cannot be transcribed. Send mp3, m4a, wav, ogg, flac or webm.`,
      },
      { status: 415 },
    );
  }

  /*
   * Context the journalist already knows, passed through so the model does
   * not have to infer it and must not invent it. An interviewee's name spoken
   * nowhere in the recording is otherwise unknowable, and the prompt forbids
   * guessing one — so if it is not given here, speakers stay anonymous, which
   * is the correct outcome rather than a degraded one.
   */
  const interviewee = String(form.get("interviewee") ?? "").trim().slice(0, 200);
  const context = String(form.get("context") ?? "").trim().slice(0, 1000);

  const Transcript = z.object({
    transcript: z
      .string()
      .describe("The full transcript, speaker-labelled, one turn per line."),
    language: z.string().describe("The language spoken, named plainly."),
    quotes: z
      .array(
        z.object({
          text: z.string().describe("Verbatim from the transcript. Never paraphrased."),
          speaker: z.string().describe("Who said it, as labelled in the transcript."),
          atSeconds: z.number().describe("Approximate start, in seconds from the beginning."),
          uncertain: z
            .string()
            .optional()
            .describe("Named doubt about the wording or audibility, when there is any."),
        }),
      )
      .max(20),
  });

  try {
    const bytes = new Uint8Array(await file.arrayBuffer());

    const { output } = await generateText({
      model: assistModel(PURPOSE),
      system: SYSTEM,
      abortSignal: AbortSignal.timeout(budgetMs(PURPOSE)),
      output: Output.object({ schema: Transcript }),
      messages: [
        {
          role: "user",
          content: [
            { type: "file", data: bytes, mediaType: file.type },
            {
              type: "text",
              text: [
                interviewee ? `The person being interviewed is ${interviewee}.` : null,
                context ? `Context the journalist has given: ${context}` : null,
                "Transcribe this recording and pull out the passages worth quoting.",
              ]
                .filter(Boolean)
                .join("\n"),
            },
          ],
        },
      ],
    });

    return Response.json(output);
  } catch (cause) {
    return modelFailure("assist/transcribe", cause, PURPOSE);
  }
}
