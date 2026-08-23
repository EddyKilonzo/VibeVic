/**
 * The shape of a worked-up idea.
 *
 * Shared because the request and the panel that renders it now live in two
 * different columns of the Ideas screen — the trigger sits in the form, where
 * the idea is typed, and the result renders in the main column, where there
 * is width to read it.
 *
 * There is no `priority` field, and that is a decision rather than an
 * omission: `AdminIdeas` holds that ranking a journalist's ideas is a claim
 * software has no business making, and a model emitting `priority: "high"`
 * would be that claim wearing a schema. `difficulty` is about how much work
 * an angle would take to stand up, which is a property of the reporting.
 */
export interface PitchAngle {
  angle: string;
  why: string;
  difficulty: "quick" | "moderate" | "hard";
}

export interface Pitch {
  angles: PitchAngle[];
  sources: string[];
  questions: string[];
  beat: string;
  caution: string;
}

/** A result, with the line it was worked up from. */
export interface PitchResult {
  pitch: Pitch;
  /**
   * Held alongside rather than read from the form.
   *
   * The field goes on being edited after the request returns, and a panel
   * headed with a line the writer has since rewritten is a panel about
   * nothing.
   */
  subject: string;
}
