import "server-only";

import { newsroomFetch } from "@/lib/newsroom-api";
import type { NewsroomRole } from "@/lib/newsroom-session";
import { can } from "@/lib/newsroom-scopes";

/**
 * What Mia knows, gathered before she is asked anything.
 *
 * ── Why the facts are fetched rather than recalled ───────────────────────
 * An assistant that answers from a model's own memory is answering about a
 * newsroom that does not exist. Every figure here comes from the same API the
 * screens read, on the caller's own token, at the moment of the question — so
 * "three things are overdue" is three things that are overdue, and if the API
 * is down she says she could not look rather than guessing.
 *
 * ── Why the briefing is scoped, not filtered afterwards ──────────────────
 * Each fetch is guarded by the scope its own route requires. A dev never has
 * the notebook in their briefing because the request is never made, not
 * because it was made and then stripped — which is the same argument
 * `AccessPolicyService.visibilityFilter` makes about `where` clauses rather
 * than post-filtering. A model cannot leak what was never put in front of it.
 *
 * ── What is never in here ────────────────────────────────────────────────
 * Sources, quotes, interviews, evidence — none of it, for anybody, including
 * the writer who is entitled to read all of it. The model call goes to a free
 * tier whose prompts may be used to improve someone else's product, which the
 * pitch route weighed out loud and reached the same conclusion about: nothing
 * that could identify a source may ever be sent. Titles, counts and dates are
 * what an assistant needs to be useful, and they are the whole of what leaves.
 */

export interface Briefing {
  role: NewsroomRole;
  /** Everything below, said in plain lines. This is what the model is given. */
  lines: string[];
  /** What was actually read, for the panel to show under the answer. */
  used: string[];
  /** Named so the panel can say "the API was unreachable" rather than "none". */
  failures: string[];
}

interface StoryRow {
  id: string;
  title: string;
  status: string;
  updatedAt: string;
}

interface DeadlineRow {
  id: string;
  label: string;
  dueAt: string;
  done: boolean;
  storyId?: string;
}

interface IdeaRow {
  id: string;
  title: string;
  stage: string;
  priority: string;
}

interface StreakRow {
  current: number;
  longest: number;
  activeToday: boolean;
}

interface DiagnosticsRow {
  [key: string]: unknown;
}

export async function buildBriefing(role: NewsroomRole): Promise<Briefing> {
  const lines: string[] = [];
  const used: string[] = [];
  const failures: string[] = [];

  /**
   * Each source is attempted on its own and a failure is recorded rather than
   * thrown.
   *
   * `Promise.all` would be tidier and wrong: one unreachable collection would
   * take the whole briefing down, and an assistant that says nothing because
   * the ideas endpoint is slow is worse than one that answers about deadlines
   * and says the notebook could not be read.
   */
  const gather = async <T>(label: string, path: string): Promise<T | null> => {
    try {
      const value = await newsroomFetch<T>(path);
      used.push(label);
      return value;
    } catch {
      failures.push(label);
      return null;
    }
  };

  /* ── Work in progress ─────────────────────────────────────────────── */

  const stories = await gather<StoryRow[]>("stories", "/admin/stories");
  if (stories) {
    const drafts = stories.filter((story) => story.status === "DRAFT");
    const scheduled = stories.filter((story) => story.status === "SCHEDULED");
    const published = stories.length - drafts.length - scheduled.length;

    lines.push(
      `Stories: ${published} published, ${drafts.length} in draft, ${scheduled.length} scheduled.`,
    );

    // Most recently touched first — "the one I was working on" in practice.
    const recent = [...drafts]
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .slice(0, 5);
    if (recent.length > 0) {
      lines.push(
        `Open drafts, most recently edited first: ${recent
          .map((story) => `"${story.title}"`)
          .join("; ")}.`,
      );
    }

    const upcoming = scheduled.slice(0, 3);
    if (upcoming.length > 0) {
      lines.push(`Scheduled to appear: ${upcoming.map((s) => `"${s.title}"`).join("; ")}.`);
    }
  }

  /* ── What is due ──────────────────────────────────────────────────── */

  const deadlines = await gather<DeadlineRow[]>("deadlines", "/newsroom/deadlines");
  if (deadlines) {
    const now = Date.now();
    const outstanding = deadlines
      .filter((deadline) => !deadline.done)
      .sort((a, b) => a.dueAt.localeCompare(b.dueAt));
    const overdue = outstanding.filter((deadline) => Date.parse(deadline.dueAt) < now);

    if (outstanding.length === 0) {
      lines.push("Deadlines: nothing outstanding.");
    } else {
      lines.push(
        `Deadlines: ${outstanding.length} outstanding, ${overdue.length} of them past their date.`,
      );
      lines.push(
        `The next few: ${outstanding
          .slice(0, 5)
          .map(
            (deadline) =>
              `"${deadline.label}" due ${deadline.dueAt.slice(0, 16).replace("T", " ")}${
                Date.parse(deadline.dueAt) < now ? " (overdue)" : ""
              }`,
          )
          .join("; ")}.`,
      );
    }
  }

  /* ── The notebook, for whoever it belongs to ──────────────────────── */

  if (can(role, "newsroom:ideas")) {
    const ideas = await gather<IdeaRow[]>("ideas", "/newsroom/ideas");
    if (ideas) {
      const live = ideas.filter((idea) => idea.stage !== "DROPPED");
      lines.push(`Ideas in the notebook: ${live.length}.`);
      const high = live.filter((idea) => idea.priority === "HIGH").slice(0, 5);
      if (high.length > 0) {
        lines.push(
          `Marked high priority: ${high.map((idea) => `"${idea.title}"`).join("; ")}.`,
        );
      }
    }
  }

  /* ── Showing up ───────────────────────────────────────────────────── */

  const streak = await gather<StreakRow>("streak", "/newsroom/activity");
  if (streak) {
    lines.push(
      `Streak: ${streak.current} day${streak.current === 1 ? "" : "s"} running, longest ever ${
        streak.longest
      }. Opened today: ${streak.activeToday ? "yes" : "not yet"}.`,
    );
  }

  /* ── The machine, for whoever maintains it ────────────────────────── */

  if (can(role, "system:diagnostics")) {
    const diagnostics = await gather<DiagnosticsRow>("diagnostics", "/newsroom/diagnostics");
    if (diagnostics) {
      /*
       * Serialised whole rather than picked apart field by field.
       *
       * The diagnostics payload is the one source here whose shape is expected
       * to change — it grows a check whenever the deployment grows a
       * dependency — and a hand-written summary would silently stop mentioning
       * the newest one. It is a description of the deployment, contains no
       * newsroom material and no personal data, so there is nothing in it that
       * needs holding back.
       */
      lines.push(`Deployment diagnostics: ${JSON.stringify(diagnostics)}`);
    }
  }

  return { role, lines, used, failures };
}
