import type { NewsroomRole } from "./newsroom-session";
import { can, type Scope } from "./newsroom-scopes";

/**
 * What each role may actually do, in the words of the work rather than of the
 * permission system.
 *
 * ── Why this exists as a list and not a paragraph ────────────────────────
 * The split used to be explained in prose, on the sign-in page, to whoever
 * happened to be looking at it. Two things were wrong with that. It told
 * strangers which role is worth attacking and what it is worth, and it told
 * the person who actually holds an account nothing they could act on — a
 * paragraph about roles in general is not an answer to "can I open this
 * record". This is per capability, per role, shown to the signed-in account
 * about itself.
 *
 * ── Why the wording avoids scope names ───────────────────────────────────
 * `newsroom:confidential` is what the API checks; "see the name behind a
 * pseudonym" is what it means. The person reading this is a journalist
 * deciding whether they can do something, not an engineer debugging a token,
 * and a screen that answers in scope names makes them translate. The scope is
 * carried on each row anyway, because it is what keeps this list honest — a
 * capability whose scope nobody holds cannot silently linger here.
 *
 * ── What changed when the split stopped being a ladder ───────────────────
 * This list used to have one withheld row in it, and only for DEV, because
 * DEV was WRITER minus a scope. It reads differently now: each role has
 * things of its own, so each sees three or four allowed rows and two or three
 * withheld ones, and the withheld ones are not a demotion — a writer is told
 * they cannot read diagnostics in the same tone a dev is told they cannot
 * publish. Neither is being trusted less. They are doing different jobs.
 *
 * ── This is a description, not the control ───────────────────────────────
 * Nothing here gates anything. The API derives scopes from the role on every
 * request and re-checks them against the database — see `roles.ts` in the
 * API, which is the one place that decides. If this list and that table ever
 * disagree, this list is the one that is wrong, and the screen it feeds is
 * misinformation rather than a security hole.
 */
export interface Capability {
  /** What the person can do, said as the thing they would try to do. */
  label: string;
  /** Why it is or is not theirs. Shown under the label, quietly. */
  detail: string;
  /** The scope the API checks. Membership is derived from it, never typed. */
  scope: Scope;
}

export const CAPABILITIES: readonly Capability[] = [
  {
    label: "Read the newsroom",
    detail: "Drafts, records, the media library and the reading figures.",
    scope: "newsroom:read",
  },
  {
    label: "Write and edit records",
    detail: "Interviews, sources, evidence and timelines — create them and change them.",
    scope: "newsroom:write",
  },
  {
    label: "Write and edit stories",
    detail: "Draft a piece and reshape it. Separate from putting it on the site.",
    scope: "stories:write",
  },
  {
    label: "Open the ideas notebook",
    detail:
      "Ideas and pitches, and the desk that works an idea up. An idea is the decision to write something, still being made — it is the writer's until it is a draft.",
    scope: "newsroom:ideas",
  },
  {
    label: "Publish to the public site",
    detail:
      "Take a draft live, and take it back down. Editing a piece is craft and the dev account needs it to fix an editor bug; deciding it is ready for readers is editorial judgement.",
    scope: "stories:publish",
  },
  {
    label: "See the name behind a pseudonym",
    detail:
      "A protected identity is only ever shown to a writer. Protecting a source and knowing who they are cannot be separated — and the account that gets pasted into a terminal is the one that should not be able to expose anyone.",
    scope: "newsroom:confidential",
  },
  {
    label: "Read the deployment's diagnostics",
    detail:
      "Database reachability, which migrations ran, what is configured. The dev account's work, and useless to a writer — the answer to “is the API up” you need is the badge in the header.",
    scope: "system:diagnostics",
  },
  {
    label: "Administer accounts",
    detail:
      "See who can sign in and send somebody the link that sets their first password. Held by the account that already holds the deployment's keys, so it grants nothing a database prompt would not.",
    scope: "system:accounts",
  },
];

/** Split for display: what this role has, and what it does not. */
export function capabilitiesFor(role: NewsroomRole): {
  allowed: Capability[];
  withheld: Capability[];
} {
  return {
    allowed: CAPABILITIES.filter((capability) => can(role, capability.scope)),
    withheld: CAPABILITIES.filter((capability) => !can(role, capability.scope)),
  };
}
