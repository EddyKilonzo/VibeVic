import type { Award, Block, Genre, Publication, Story } from "./types";
import { CHANNEL, TOPICS, VIDEOS } from "./videos";

/**
 * Site content.
 *
 * A hard line runs through this file, and it is worth stating plainly:
 *
 *   VERIFIED — the profile, the channel figures and the video list were read
 *   from the live YouTube channel and from what the site's owner supplied.
 *   These are facts about a real person and are safe to publish.
 *
 *   PLACEHOLDER — the written articles below are template text, marked with
 *   `placeholder: true` and labelled as such wherever they render. They exist
 *   so the editor and the listen-to-article feature have something real to
 *   operate on. No reporting, award, quotation or byline has been invented
 *   and attributed to Victor Kiplimo.
 *
 * Replacing a placeholder in the admin clears the flag and the label.
 */

/* ── VERIFIED ──────────────────────────────────────────────────── */

export const PROFILE = {
  name: "Victor Kiplimo",
  role: "Journalist",
  /** Supplied by the site's owner. */
  education: "Moi University",
  /** Every report on the channel to date has been filed from Eldoret. */
  base: "Eldoret, Kenya",
  channel: CHANNEL,
  email: "hello@victorkiplimo.example",
} as const;

/**
 * Where to follow the work.
 *
 * The Instagram URL is the plain profile address. The link as it was supplied
 * carried an `igsh=` parameter — that is Instagram's share-tracking token,
 * which identifies the account that shared the link and would follow every
 * visitor who clicked it from here. It is stripped deliberately; a link on
 * someone's own site should not be carrying a referral tag for them.
 */
export interface SocialAccount {
  label: string;
  handle: string;
  url: string;
}

export const SOCIAL = {
  youtube: {
    label: "YouTube",
    handle: CHANNEL.handle,
    url: CHANNEL.url,
  },
  instagram: {
    label: "Instagram",
    handle: "@its_vickiplimo",
    url: "https://www.instagram.com/its_vickiplimo/",
  },
} as const satisfies Record<string, SocialAccount>;

/** Iteration order for follow rails: video first, because the work is video. */
export const SOCIAL_ACCOUNTS: SocialAccount[] = [SOCIAL.youtube, SOCIAL.instagram];

/* ── Written articles: PLACEHOLDER ─────────────────────────────── */

let blockSeq = 0;
const p = (text: string): Block => ({ id: `b${++blockSeq}`, type: "paragraph", text });
const h = (text: string): Block => ({ id: `b${++blockSeq}`, type: "heading", text, level: 2 });
const q = (text: string, attribution?: string): Block => ({
  id: `b${++blockSeq}`,
  type: "quote",
  text,
  attribution,
});
const ul = (items: string[]): Block => ({ id: `b${++blockSeq}`, type: "list", items });

/**
 * Genres double as the written-work equivalent of video topics, so the two
 * halves of the archive filter the same way.
 */
export const GENRES: Genre[] = TOPICS.map((topic) => ({
  slug: topic.slug,
  name: topic.name,
  description: topic.description,
}));

export const STORIES: Story[] = [
  {
    id: "s1",
    slug: "how-to-publish-a-story",
    title: "How this newsroom works",
    dek: "A walkthrough of publishing, editing and narration — and a demonstration of the listen-to-article feature. Replace this text with your first written piece.",
    genre: "campus",
    tags: ["Guide", "Placeholder"],
    status: "published",
    placeholder: true,
    publishedAt: "2026-08-01",
    updatedAt: "2026-08-01",
    readingMinutes: 4,
    featured: true,
    body: [
      p(
        "This is placeholder copy. It exists so the editor, the reading progress bar and the voice player have real text to work with before the first article is written. Open it in the admin, replace these paragraphs, and everything on this page updates — including the audio.",
      ),
      h("Writing and structure"),
      p(
        "Articles are built from blocks rather than from a single field of markup. A block is a paragraph, a heading, a pull quote, an image, or a list. Blocks can be dragged into a new order, duplicated, or converted from one type into another, and the change is saved automatically a moment after you stop typing.",
      ),
      p(
        "Structure is not decoration here. Every heading you write becomes a chapter in the audio player, so a piece broken into clear sections is one a listener can navigate. Nothing extra has to be authored to make that happen.",
      ),
      q(
        "Write the piece well and the audio version organises itself.",
      ),
      h("How the narration works"),
      p(
        "Pressing Listen sends the article — and only the article — to the device's own speech engine. Navigation, buttons, metadata and the related-story rail are never read aloud, because the page is stored as structured blocks and only the editorial ones are passed to the reader.",
      ),
      ul([
        "Each sentence is spoken separately, which is what allows the current paragraph to be highlighted as it plays.",
        "Headings become chapters, so a listener can skip forward a section at a time.",
        "Playback speed, chosen voice and follow-along are remembered on the device.",
      ]),
      p(
        "The times shown in the player are estimates. The browser's speech engine reports no duration, so the length of each sentence is calculated from its word count and corrected at every sentence boundary. A future neural voice would report real timings, and the same player would use them without a change to this page.",
      ),
      h("Replacing this article"),
      p(
        "Open the admin, choose this story, and edit it. The placeholder label at the top of the page disappears as soon as the flag is cleared, and this piece behaves like any other published work.",
      ),
    ],
  },
  {
    id: "s2",
    slug: "sample-report-template",
    title: "Report template",
    dek: "A skeleton for a written report — headline, standfirst, sections and a pull quote. Duplicate it to start a new piece.",
    genre: "features",
    tags: ["Template", "Placeholder"],
    status: "draft",
    placeholder: true,
    publishedAt: "2026-08-10",
    updatedAt: "2026-08-12",
    readingMinutes: 3,
    body: [
      p(
        "Open with the fact that made the story worth filing. One sentence, no throat-clearing — the reader has already decided whether to continue by the end of it.",
      ),
      h("What happened"),
      p(
        "Set out the sequence plainly. Dates, places, names, in the order a person would need them to follow the account without re-reading anything.",
      ),
      h("What the records show"),
      p(
        "This is where documents, figures and responses belong. Where a number is disputed, say who disputes it.",
      ),
      q("A quotation carries more weight when it is the only one on the page."),
      h("What happens next"),
      p("Close on the open question rather than on a summary of what was already said."),
    ],
  },
];

/**
 * Where the work is published.
 *
 * VERIFIED: the YouTube channel and its figures. Education supplied by the
 * site's owner. Add further mastheads through the admin as they happen —
 * nothing is listed here that has not been confirmed.
 */
export const PUBLICATIONS: Publication[] = [
  {
    name: CHANNEL.name,
    role: "Reporter, producer and editor",
    period: "2025 — present",
    description: `Independent video reporting published on ${CHANNEL.handle}: campus systems, Kenyan culture and student life. ${CHANNEL.videoCount} pieces to date.`,
    url: CHANNEL.url,
  },
  {
    name: "Moi University",
    role: "Graduate",
    period: "Completed",
    description:
      "Where Victor trained before moving into independent reporting and video production.",
  },
];

/**
 * Awards.
 *
 * Deliberately empty. Inventing a prize for a real journalist would be a
 * fabricated credential, so the page renders an honest empty state until real
 * entries are added in the admin.
 */
export const AWARDS: Award[] = [];

/* ── Accessors ─────────────────────────────────────────────────── */

export const publishedStories = (): Story[] =>
  STORIES.filter((s) => s.status === "published").sort(
    (a, b) => +new Date(b.publishedAt) - +new Date(a.publishedAt),
  );

export const featuredStories = (): Story[] => publishedStories().filter((s) => s.featured);

export const storyBySlug = (slug: string): Story | undefined =>
  STORIES.find((s) => s.slug === slug);

export const storyById = (id: string): Story | undefined => STORIES.find((s) => s.id === id);

export const genreBySlug = (slug: string): Genre | undefined => GENRES.find((g) => g.slug === slug);

export const storiesByGenre = (slug: string): Story[] =>
  publishedStories().filter((s) => s.genre === slug);

export const genreName = (slug: string): string => genreBySlug(slug)?.name ?? slug;

export const relatedStories = (story: Story, limit = 3): Story[] => {
  const pool = publishedStories().filter((s) => s.id !== story.id);
  const sameGenre = pool.filter((s) => s.genre === story.genre);
  const rest = pool.filter((s) => s.genre !== story.genre);
  return [...sameGenre, ...rest].slice(0, limit);
};

/** Plain-text search across written work and video titles alike. */
export function searchStories(query: string): Story[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];

  return publishedStories()
    .map((story) => {
      const fields = [
        { text: story.title.toLowerCase(), weight: 6 },
        { text: story.dek.toLowerCase(), weight: 3 },
        { text: story.tags.join(" ").toLowerCase(), weight: 3 },
        { text: genreName(story.genre).toLowerCase(), weight: 2 },
        {
          text: story.body
            .map((b) => ("text" in b ? b.text : "items" in b ? b.items.join(" ") : ""))
            .join(" ")
            .toLowerCase(),
          weight: 1,
        },
      ];
      const score = fields.reduce((total, f) => total + (f.text.includes(q) ? f.weight : 0), 0);
      return { story, score };
    })
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((r) => r.story);
}

/** Video search, kept alongside so one query can cover the whole archive. */
export function searchVideos(query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return VIDEOS.filter(
    (v) => v.title.toLowerCase().includes(q) || v.topic.toLowerCase().includes(q),
  );
}
