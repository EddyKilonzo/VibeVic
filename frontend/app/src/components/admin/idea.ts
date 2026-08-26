import type { Idea, IdeaStage } from "@/data/newsroom/types";

/**
 * The vocabulary the Ideas screen is built on.
 *
 * Split out for the same reason `pitch.ts` was: the screen and the row that
 * renders one idea now live in two files, and both need to agree on what the
 * five stages are called and how a priority looks. A second copy of either
 * would drift, and the way it would show is a filter tab labelled one thing
 * next to a row labelled another.
 */

export const STAGES: { id: IdeaStage; label: string; hint: string }[] = [
  { id: "spark", label: "Spark", hint: "Noted, nothing done yet" },
  { id: "researching", label: "Researching", hint: "Being looked into" },
  { id: "pitched", label: "Pitched", hint: "Sent to an editor" },
  { id: "commissioned", label: "Commissioned", hint: "Going ahead" },
  { id: "dropped", label: "Dropped", hint: "Kept, so it is not raised twice" },
];

export const PRIORITIES: Idea["priority"][] = ["high", "medium", "low"];

/**
 * Priority styling.
 *
 * Separated by fill weight rather than by hue alone, matching the status
 * pills on the story list: solid, tinted-and-outlined, flat grey. That
 * ordering survives greyscale and every colour-vision type, which three
 * coloured dots would not.
 */
export const PRIORITY_STYLE: Record<Idea["priority"], string> = {
  high: "bg-primary text-primary-foreground",
  medium: "bg-accent/12 text-primary ring-1 ring-inset ring-accent/35",
  low: "bg-muted text-muted-foreground ring-1 ring-inset ring-border",
};

export const PRIORITY_RANK: Record<Idea["priority"], number> = {
  high: 0,
  medium: 1,
  low: 2,
};

/** The API's ceiling on `tags`, honoured in the field rather than discovered as a 400. */
export const MAX_TAGS = 50;
