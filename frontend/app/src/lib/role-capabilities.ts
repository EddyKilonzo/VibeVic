import type { NewsroomRole } from "./newsroom-session";

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
 * and a screen that answers in scope names makes them translate.
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
  roles: readonly NewsroomRole[];
}

export const CAPABILITIES: readonly Capability[] = [
  {
    label: "Read the newsroom",
    detail: "Drafts, ideas, records, the media library and the reading figures.",
    roles: ["WRITER", "DEV"],
  },
  {
    label: "Write and edit records",
    detail: "Interviews, sources, evidence and timelines — create them and change them.",
    roles: ["WRITER", "DEV"],
  },
  {
    label: "Write and publish stories",
    detail: "Take a draft to the public site, and take it back down again.",
    roles: ["WRITER", "DEV"],
  },
  {
    label: "See the name behind a pseudonym",
    detail:
      "A protected identity is only ever shown to a writer. Protecting a source and knowing who they are cannot be separated — and the account that gets pasted into a terminal is the one that should not be able to expose anyone.",
    roles: ["WRITER"],
  },
];

/** Split for display: what this role has, and what it does not. */
export function capabilitiesFor(role: NewsroomRole): {
  allowed: Capability[];
  withheld: Capability[];
} {
  return {
    allowed: CAPABILITIES.filter((capability) => capability.roles.includes(role)),
    withheld: CAPABILITIES.filter((capability) => !capability.roles.includes(role)),
  };
}
