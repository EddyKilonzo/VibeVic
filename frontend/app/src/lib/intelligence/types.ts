/**
 * Editorial checks.
 *
 * Everything in this folder is **deterministic**: the same draft always gives
 * the same findings, and every finding can point at the exact text that caused
 * it. That is the whole design constraint, and it comes straight from the
 * brief — no invented scores, no fabricated facts, nothing the journalist
 * cannot verify by looking at the paragraph named.
 *
 * These are observations, never edits. Nothing here rewrites the draft.
 */

export type FindingKind =
  | "repetition"
  | "terminology"
  | "house-style"
  | "statistic"
  | "contradiction"
  | "structure"
  | "attribution"
  | "sensitivity";

export type Severity = "note" | "attention";

export interface Finding {
  id: string;
  kind: FindingKind;
  severity: Severity;
  /** One line, stating what was observed. */
  title: string;
  /** Why it is worth a look. Always a reason, never a verdict. */
  detail: string;
  /** Blocks this finding points at, so the UI can jump to them. */
  blockIds: string[];
  /** The exact text that triggered it, for the journalist to check. */
  evidence?: string;
}

/**
 * A checklist item answered from the draft itself.
 *
 * `state` is derived, never guessed: "unknown" is a real and common answer,
 * and is reported as such rather than being rounded to pass or fail.
 */
export interface ChecklistItem {
  id: string;
  label: string;
  state: "met" | "unmet" | "unknown";
  /** What was actually checked, in one sentence. */
  because: string;
}
