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
 * A quotation, with everything needed to credit it properly.
 *
 * `author` and `source` are separate fields rather than one pre-joined string
 * because they are two different claims: who said it, and where that can be
 * checked. A site whose premise is that nothing published is invented cannot
 * render the first without being able to produce the second.
 */
export interface Quote {
  text: string;
  /** Who said it. For a proverb, the tradition — never the person who repeated it. */
  author: string;
  /** Where it can be checked: the work, the speech, the interview. */
  source: string;
  /** A page about the author or the work, for the blockquote's `cite`. */
  cite: string;
}

/**
 * The rotation the quote bands draw from.
 *
 * ── Why these six, and why nothing else ──────────────────────────────────
 * Every line here is one somebody demonstrably said or wrote, in a work or on
 * an occasion named in `source`. That constraint did most of the choosing: the
 * quotations journalists pass around are, disproportionately, misattributed —
 * the "journalism is printing what someone else does not want printed" line
 * that follows Orwell around is the best-known example, and it is not his. A
 * quotation whose provenance could not be stated was left out rather than
 * included with a hedge, on the same rule the rest of this file runs on.
 *
 * The Igbo proverb is credited to the tradition, not to Chinua Achebe, and
 * that is the point of the entry as much as the words are. Achebe quoted it —
 * he was explicit in the Paris Review that he was reaching for "that great
 * proverb" — so putting his name where the author goes would be inventing an
 * attribution on a page that exists to argue against doing that.
 *
 * ── Order is the rotation ────────────────────────────────────────────────
 * `quoteOfTheDay` indexes this array by the day, so the sequence a reader
 * meets over a week is the order written here. Adding a seventh changes which
 * quote falls on which date, which is a thing to know before reordering but
 * not a thing to protect against — there is no state anywhere that expects
 * yesterday's choice to still hold.
 */
export const QUOTES: readonly Quote[] = [
  {
    text: "Everything that irritates us about others can lead us to an understanding of ourselves.",
    author: "Carl Gustav Jung",
    source: "Collected Works, Volume 17",
    cite: "https://en.wikipedia.org/wiki/Carl_Jung",
  },
  {
    text: "We tell ourselves stories in order to live.",
    author: "Joan Didion",
    source: "The White Album, 1979",
    cite: "https://en.wikipedia.org/wiki/The_White_Album_(book)",
  },
  {
    text: "A critical, independent and investigative press is the lifeblood of any democracy.",
    author: "Nelson Mandela",
    source: "International Press Institute Congress, Cape Town, 1994",
    cite: "https://en.wikipedia.org/wiki/Nelson_Mandela",
  },
  {
    text: "It's the little things citizens do. That's what will make the difference.",
    author: "Wangari Maathai",
    source: "Unbowed: A Memoir, 2006",
    cite: "https://en.wikipedia.org/wiki/Wangari_Maathai",
  },
  {
    text: "To be a good journalist you have to be a good person.",
    author: "Ryszard Kapuscinski",
    source: "The Other, 2008",
    cite: "https://en.wikipedia.org/wiki/Ryszard_Kapu%C5%9Bci%C5%84ski",
  },
  {
    text: "Until the lions have their own historians, the history of the hunt will always glorify the hunter.",
    author: "Igbo proverb",
    source: "quoted by Chinua Achebe, The Paris Review, 1994",
    cite: "https://en.wikipedia.org/wiki/Chinua_Achebe",
  },
];

/**
 * Which day it is, in the timezone the site is read in.
 *
 * Nairobi rather than the server's clock, and that is not fussiness: on a UTC
 * host the quote would change at three in the morning local time, so a reader
 * opening the page over breakfast would meet a line that had already been up
 * for five hours and call it yesterday's. `en-CA` is here because it formats
 * as `YYYY-MM-DD`, which is the one locale format that parses back without
 * ambiguity.
 */
const NAIROBI_DAY = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Africa/Nairobi",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

function dayNumber(now: Date): number {
  const [year, month, day] = NAIROBI_DAY.format(now).split("-").map(Number);
  return Math.floor(Date.UTC(year, month - 1, day) / 86_400_000);
}

/**
 * Today's quote.
 *
 * ── Called on the server, never in a component body ──────────────────────
 * The date is the input, so this is exactly the kind of "variable input which
 * changes each time it's called" that produces a hydration mismatch when a
 * client component reads it during render. The home route calls it once on the
 * server and passes the result down as a prop, so the server's choice and the
 * browser's are the same object rather than two calls that agreed.
 *
 * ── Modulo, not random ───────────────────────────────────────────────────
 * A hash or a shuffle would scatter the order and occasionally repeat a quote
 * on consecutive days, which reads as a bug to anybody who visits twice. Days
 * since the epoch modulo the list means the sequence is fixed, every quote
 * appears exactly as often as every other, and it is trivially checkable: the
 * page for a given date is the same page tomorrow's reader would predict.
 */
export function quoteOfTheDay(now: Date = new Date()): Quote {
  return QUOTES[dayNumber(now) % QUOTES.length];
}

/**
 * The quote he runs on his own site.
 *
 * The About page's band is a fixed line rather than the rotation — it is the
 * one he chose and has kept up, which is a different claim from "here is a
 * quotation". Defined by reference so the words exist once: the same entry is
 * the first in the rotation, and a correction to either is a correction to both.
 */
export const QUOTE_OF_THE_WEEK: Quote = QUOTES[0];

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
