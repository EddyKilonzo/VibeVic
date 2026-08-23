import type { Award, Genre, Publication, Story } from "./types";
import { CHANNEL, VIDEOS } from "./videos";
import { WORDPRESS_STORIES } from "./writing.generated";

/**
 * Site content.
 *
 * Everything in this file is real, and that is a change worth recording. It
 * used to carry a template article marked `placeholder: true` so the editor
 * and the listen-to-article feature had something to operate on; that piece
 * is gone, replaced by his actual writing imported from WordPress. Nothing
 * here is invented:
 *
 *   - the profile and the channel figures were read from the live YouTube
 *     channel and from what the site's owner supplied;
 *   - the written archive is imported verbatim from his own site, with a
 *     `sourceUrl` on every piece pointing back at the version he maintains;
 *   - awards is an empty array, because he has not told us of any.
 *
 * No reporting, award, quotation or byline has been invented and attributed
 * to Victor Kiplimo, and none should be.
 */

/* ── VERIFIED ──────────────────────────────────────────────────── */

export const PROFILE = {
  name: "Victor Kiplimo",
  role: "Journalist",
  /**
   * Corrected by the site's owner: he is a *current student* here, not a
   * graduate of anywhere. The earlier "Moi University graduate" was wrong on
   * both the institution and the status, and it is the sort of thing that has
   * to be right on a real journalist's page — every string below reads from
   * this one field so a correction lands everywhere at once.
   */
  education: "The Eldoret National Polytechnic",
  /** "student" / "graduate" — used wherever the relationship is described. */
  educationStatus: "student",
  /** Every report on the channel to date has been filed from Eldoret. */
  base: "Eldoret, Kenya",
  channel: CHANNEL,
  /** His real address, as published on his own site. */
  email: "vickiplimo901@gmail.com",
} as const;

/**
 * Where to follow the work.
 *
 * ── The URLs are cleaned on purpose ──────────────────────────────────────
 * Both links arrived with tracking on them: `igsh=` on the Instagram one and
 * `utm_source`/`utm_medium`/`r=` on the Substack one. Those identify the
 * account that shared the link and the app it was shared from, and they would
 * ride along on every visitor who clicked through from here. A link on
 * someone's own site should not be carrying a referral tag for them, so what
 * is stored below is the plain profile address in each case.
 */
export interface SocialAccount {
  id: "youtube" | "instagram" | "substack" | "tiktok" | "x" | "facebook";
  label: string;
  handle: string;
  url: string;
  /** What actually goes there — so a follow rail says more than a logo. */
  note: string;
}

export const SOCIAL = {
  youtube: {
    id: "youtube",
    label: "YouTube",
    handle: CHANNEL.handle,
    url: CHANNEL.url,
    note: "Every report, published here first",
  },
  instagram: {
    id: "instagram",
    label: "Instagram",
    handle: "@its_vickiplimo",
    url: "https://www.instagram.com/its_vickiplimo/",
    note: "Stills and work between shoots",
  },
  substack: {
    id: "substack",
    label: "Substack",
    handle: "@victorkiplimo",
    url: "https://substack.com/@victorkiplimo",
    note: "Longer writing, straight to your inbox",
  },
  tiktok: {
    id: "tiktok",
    label: "TikTok",
    handle: "@kiplimovic",
    url: "https://www.tiktok.com/@kiplimovic",
    note: "Short vertical cuts from the field",
  },
  x: {
    id: "x",
    label: "X",
    handle: "@late_bloomer999",
    url: "https://x.com/late_bloomer999",
    note: "Running commentary and links",
  },
  facebook: {
    id: "facebook",
    label: "Facebook",
    // A numeric profile URL rather than a vanity handle, so there is no
    // username to display — the label carries it instead of inventing one.
    handle: "Victor Kiplimo",
    url: "https://www.facebook.com/profile.php?id=61550855067186",
    note: "Where the local audience is",
  },
} as const satisfies Record<string, SocialAccount>;

/**
 * How to reach him.
 *
 * The phone number is real and was supplied by the site's owner. It is kept
 * here rather than inline in the view so there is exactly one place to change
 * it — a contact detail that is wrong in one of three files is worse than no
 * contact detail at all.
 *
 * `phoneDigits` is the same number in E.164 with no punctuation, which is what
 * `tel:` and `wa.me` both require; the spaced form is only ever displayed.
 */
export const CONTACT = {
  email: PROFILE.email,
  /**
   * ⚠ Two different numbers have been supplied for this.
   *
   * The WhatsApp instruction gave …376007; his own site lists …375 007. One
   * digit apart, which is exactly the shape of a typo, and there is no way to
   * tell from here which one is the typo. What is below is the number that was
   * given explicitly for WhatsApp, because that is the route the contact form
   * hands off to and a dead WhatsApp link fails loudly rather than silently.
   *
   * This needs confirming before launch. A wrong number on a tips page does
   * not bounce — it rings somebody else.
   */
  phone: "+254 704 376 007",
  phoneDigits: "254704376007",
  /**
   * Pre-filled so the first message is not a blank box. Deliberately says
   * nothing about the tip itself: WhatsApp shows a message preview on a lock
   * screen, and the opening line should not be the part worth reading.
   */
  whatsappMessage: "Hello Victor — I have something I'd like to share with you for a story.",
} as const;

/**
 * How he introduces himself, in his own words.
 *
 * Lifted verbatim from Vic Unfiltered rather than rewritten. An About page
 * written *about* someone in a house voice always reads a shade like a press
 * release; his own sentences say what the site is for in a way a third party
 * paraphrasing him cannot, and they are the ones he chose.
 */
export const ABOUT_INTRO = {
  greeting:
    "Greetings, esteemed visitor! I am Victor Kiplimo, and welcome to the world of Vic Unfiltered.",
  lines: [
    "This is a vibrant gallery of what I see, hear, and feel each day.",
    "Latest news, town talk, faith, science, nature… I write, you choose.",
  ],
} as const;

/**
 * The quote he runs on his own site.
 *
 * Kept as data with its attribution attached, so it is impossible to render
 * the words without the name — the failure mode for a pull quote on a
 * journalist's site is an unattributed line that reads as his own.
 */
export const QUOTE_OF_THE_WEEK = {
  text: "Everything that irritates us about others can lead us to an understanding of ourselves.",
  author: "Carl Gustav Jung",
} as const;

/**
 * Iteration order for follow rails.
 *
 * Roughly by weight of the work: the channel first because the reporting is
 * video, then the two places the writing lives, then the shorter-form and
 * social accounts. Not alphabetical — a reader scanning this should meet the
 * places with the most work on them first.
 */
export const SOCIAL_ACCOUNTS: SocialAccount[] = [
  SOCIAL.youtube,
  SOCIAL.substack,
  SOCIAL.instagram,
  SOCIAL.tiktok,
  SOCIAL.x,
  SOCIAL.facebook,
];

/**
 * The beats.
 *
 * Two levels: six subjects the site covers, and the specific ground inside
 * each. A story is filed against exactly one slug — a parent when the piece
 * is simply about that subject, a child when it belongs somewhere narrower —
 * and everything that counts work under a beat walks the family rather than
 * matching the slug alone (see `storiesByGenre`).
 *
 * ── Why this replaced the old seven ──────────────────────────────────────
 * The previous list mirrored the four video topics plus three written-only
 * beats, which described the channel rather than the site: it had a beat for
 * his college and none for faith, agriculture or history, which is most of
 * what the writing is actually about. The video topics still exist in
 * `data/videos` and still filter `/videos`; `TOPIC_BEAT` there maps each one
 * into this taxonomy so the beats page can keep showing reports and writing
 * side by side.
 *
 * Child slugs carry their parent as a prefix. That is not decoration: the
 * slug is the foreign key on every story and it appears in URLs, so `history`
 * the beat and a future `faith-history` must never be able to collide.
 */
export const GENRES: Genre[] = [
  {
    slug: "agriculture",
    name: "Agriculture",
    description:
      "Farming as an industry and a livelihood — what is grown, what it costs, and what the practice leaves behind.",
  },

  {
    slug: "faith",
    name: "Faith",
    description: "Belief as it is lived: in scripture, in testimony, and in the week between Sundays.",
  },
  {
    slug: "faith-devotionals",
    parent: "faith",
    name: "Devotionals",
    description: "Short readings that stay with one passage long enough to say something about it.",
  },
  {
    slug: "faith-testimonies",
    parent: "faith",
    name: "Testimonies & stories",
    description: "First-hand accounts, told by the people they happened to.",
  },

  {
    slug: "history",
    name: "History",
    description: "How the present got here, told from the record rather than from memory.",
  },

  {
    slug: "lifestyle",
    name: "Lifestyle",
    description:
      "The ordinary decisions — what to eat, where to live, how to spend a day — taken seriously.",
  },
  {
    slug: "lifestyle-health",
    parent: "lifestyle",
    name: "Health & Nutrition",
    description: "What the evidence says about eating, sleeping and staying well.",
  },
  {
    slug: "lifestyle-home",
    parent: "lifestyle",
    name: "Home & Interior Design",
    description: "Rooms, materials, and the small changes that make a space work.",
  },
  {
    slug: "lifestyle-productivity",
    parent: "lifestyle",
    name: "Productivity",
    description: "Work, study and attention — what helps, and what only feels like it does.",
  },
  {
    slug: "lifestyle-travel",
    parent: "lifestyle",
    name: "Travel",
    description: "Places, routes, and what it costs to get to them.",
  },
  {
    slug: "lifestyle-art",
    parent: "lifestyle",
    name: "Art & Culture",
    description: "Music, performance and the cultural weeks that shape how people see themselves.",
  },

  {
    slug: "news",
    name: "News",
    description: "What happened, who said it, and what follows from it.",
  },
  {
    slug: "news-africa",
    parent: "news",
    name: "Africa",
    description: "The continent's politics and economies, covered from inside them.",
  },
  {
    slug: "news-world",
    parent: "news",
    name: "World news",
    description: "What is happening elsewhere, and why it reaches here.",
  },
  {
    slug: "news-kenya",
    parent: "news",
    name: "Kenya",
    description: "National politics, and what is said in public by the people running it.",
  },
  {
    slug: "news-sports",
    parent: "news",
    name: "Sports",
    description: "Results, the athletes behind them, and the systems behind the athletes.",
  },

  {
    slug: "science",
    name: "Science",
    description: "Research, medicine and the evidence behind everyday decisions.",
  },
  {
    slug: "science-tech",
    parent: "science",
    name: "AI & Tech",
    description: "The tools, the people building them, and what they change.",
  },
  {
    slug: "science-conservation",
    parent: "science",
    name: "Conservation & Ecology",
    description: "Wildlife, habitat, and the technology now pointed at both.",
  },
  {
    slug: "science-energy",
    parent: "science",
    name: "Energy & Electricity",
    description: "Generation, grids, and the cost of keeping the lights on.",
  },
  {
    slug: "science-engineering",
    parent: "science",
    name: "Engineering",
    description: "Things that get built, and what it takes to build them.",
  },
];

/**
 * The six, in order.
 *
 * Anywhere with room for a list of beats but not for a taxonomy — the home
 * bento, the hero rail, the footer's top line, a sitemap of sections — reads
 * this rather than `GENRES`, which is three times longer.
 */
export const TOP_BEATS: Genre[] = GENRES.filter((g) => !g.parent);

/**
 * Where a new piece lands before anyone has said what it is.
 *
 * The catch-all beat, deliberately: the editor's beat control opens on this
 * and a writer changes it, which is honest about the fact that nothing has
 * been decided yet. It used to be whatever happened to be first in the list,
 * which quietly filed every new draft under Agriculture.
 */
export const DEFAULT_BEAT = "news";

/**
 * The written archive.
 *
 * These are Victor's own articles, imported from his WordPress site by
 * `scripts/import-wordpress.mjs` and stored in a generated file so a re-run
 * picks up any edit made at the source. Every one is real published work —
 * the template piece that used to sit here has been removed, because a site
 * with five actual articles has no business shipping demo prose under the
 * same byline.
 *
 * Newest first, matching every other archive on the site.
 */
export const STORIES: Story[] = [...WORDPRESS_STORIES].sort((a, b) =>
  b.publishedAt.localeCompare(a.publishedAt),
);

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
    name: "The Eldoret National Polytechnic",
    role: "Student",
    period: "Current",
    description:
      "Where Victor studies, and the institution most of his campus reporting is about.",
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

/** The beats filed directly under this one. Empty for a child, and for a leaf parent. */
export const childBeats = (slug: string): Genre[] => GENRES.filter((g) => g.parent === slug);

/**
 * A slug and everything under it.
 *
 * The reason every count and filter goes through this: a story about Kenyan
 * politics is filed `news-kenya`, so a `News` section that matched on the
 * slug alone would report zero pieces while sitting directly above them.
 * Called with a child, it is just that child — nothing inherits upwards.
 */
export const genreFamily = (slug: string): string[] => [
  slug,
  ...childBeats(slug).map((g) => g.slug),
];

/** The parent beat of a child slug, or undefined for a top-level one. */
export const parentBeat = (slug: string): Genre | undefined => {
  const parent = genreBySlug(slug)?.parent;
  return parent ? genreBySlug(parent) : undefined;
};

/** True when `storySlug` belongs to `filterSlug` — itself or one of its children. */
export const inGenre = (storySlug: string, filterSlug: string): boolean =>
  storySlug === filterSlug || genreBySlug(storySlug)?.parent === filterSlug;

export const storiesByGenre = (slug: string): Story[] =>
  publishedStories().filter((s) => inGenre(s.genre, slug));

export const genreName = (slug: string): string => genreBySlug(slug)?.name ?? slug;

/**
 * "News · Kenya" — the child under the beat it belongs to.
 *
 * For anywhere a beat is named out of context (a story card, an admin row),
 * where "Kenya" alone does not say which half of the archive it is from.
 */
export const genreLabel = (slug: string): string => {
  const parent = parentBeat(slug);
  return parent ? `${parent.name} · ${genreName(slug)}` : genreName(slug);
};

/**
 * What to read next.
 *
 * ── Why this stopped being "same beat first" ─────────────────────────────
 * It partitioned the archive into same-genre and everything-else, then took
 * the first three in publication order. With five pieces across seven beats
 * that is close to a random three: four of the seven beats hold exactly one
 * story, so the same-genre bucket is usually empty and the result is just
 * "the three most recent", which the site already shows on every other page.
 *
 * Tags are the finer signal. Two pieces sharing "mental health" belong
 * together whether one is filed under Science & health and the other under
 * Student life — and that cross-beat pairing is the one a reader could not
 * have found on their own, which is the only thing a related rail is for.
 *
 * Scoring, not bucketing: a shared tag is worth more than a shared beat,
 * because a beat is one of seven and a tag is specific. Recency breaks ties
 * so an unrelated filler slot is at least the newest thing available, and
 * stories with nothing in common are still returned rather than leaving a
 * short rail — three cards is the layout, and two is a gap.
 */
export const relatedStories = (story: Story, limit = 3): Story[] => {
  const tags = new Set(story.tags.map((t) => t.toLowerCase()));

  return publishedStories()
    .filter((s) => s.id !== story.id)
    .map((candidate) => {
      const shared = candidate.tags.filter((t) => tags.has(t.toLowerCase())).length;
      return {
        story: candidate,
        // 3 a tag, 1 a beat: two shared tags should outrank a beat match, and
        // one shared tag plus the same beat should outrank one tag alone.
        score: shared * 3 + (candidate.genre === story.genre ? 1 : 0),
      };
    })
    .sort(
      (a, b) =>
        b.score - a.score || b.story.publishedAt.localeCompare(a.story.publishedAt),
    )
    .slice(0, limit)
    .map((entry) => entry.story);
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
        // The full path, so a search for "news" reaches the pieces filed
        // under Kenya and a search for "kenya" still reaches them directly.
        { text: genreLabel(story.genre).toLowerCase(), weight: 2 },
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
