import type { Award, Genre, Publication, Story } from "./types";
import { CHANNEL } from "./videos";
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

/* ── Accessors: removed ─────────────────────────────────────────── */

/**
 * There used to be twenty accessors below this line — `publishedStories`,
 * `genreLabel`, `storiesByGenre`, `searchStories` and the rest — each closing
 * over the arrays above.
 *
 * They are gone because they were the thing keeping the site static. A helper
 * that answers "which stories are filed under News" out of a compiled array
 * cannot also answer it out of the database, and as long as one existed it was
 * the easy thing to import — so any new screen would quietly go back to the
 * bundle.
 *
 * The same logic now lives in `lib/taxonomy.ts` as pure functions that take
 * their data as an argument. Server code passes what it fetched from the API;
 * client components get the same functions pre-bound through `useTaxonomy()`.
 *
 * What stays in this file is the two things the database cannot supply: the
 * journalist's own details (`PROFILE`, `CONTACT`, `SOCIAL_ACCOUNTS`,
 * `ABOUT_INTRO`) which are site chrome rather than content rows, and the
 * `GENRES` / `STORIES` / `PUBLICATIONS` / `AWARDS` arrays — which are no longer
 * read by the app at all. Those four are now purely the *seed source*: the
 * backend's `prisma/export-content.js` compiles this file to snapshot them into
 * `seed-data/content.json`, which is what populates Postgres.
 *
 * So editing the arrays above changes what a fresh database gets seeded with.
 * It no longer changes what the running site shows — that comes from the API.
 */
