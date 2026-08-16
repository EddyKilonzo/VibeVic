/**
 * Victor Kiplimo's YouTube work.
 *
 * Every field here was read from the live channel
 * (youtube.com/@JournalistVictorKiplimo) — IDs, titles, durations, view counts
 * and publication dates are as published, not estimates. View counts are a
 * snapshot taken when this file was written; wire `api.videos()` to the
 * YouTube Data API to keep them live.
 */

export interface Video {
  /** YouTube watch ID. */
  id: string;
  title: string;
  /** "2:12" — as shown on the channel. */
  duration: string;
  /** Views at the time of capture. */
  views: number;
  /** ISO month; the channel reports these as "N months ago". */
  published: string;
  /** Long-form upload or Short. */
  format: "video" | "short";
  /** Editorial grouping, assigned from the subject of each report. */
  topic: TopicSlug;
}

export type TopicSlug = "campus" | "culture" | "student-life" | "features";

export interface Topic {
  slug: TopicSlug;
  name: string;
  description: string;
}

export const CHANNEL = {
  handle: "@JournalistVictorKiplimo",
  name: "Victor Kiplimo (Journalist)",
  id: "UCdQwlS_QYcKaOn7dP_8h4Tg",
  url: "https://www.youtube.com/@JournalistVictorKiplimo",
  subscribers: 29,
  videoCount: 8,
} as const;

export const TOPICS: Topic[] = [
  {
    slug: "campus",
    name: "Campus reporting",
    description:
      "Institutions, systems and the decisions that shape how a college actually runs.",
  },
  {
    slug: "culture",
    name: "Culture",
    description: "Kenyan culture on campus — the week, the preparation, and the performance.",
  },
  {
    slug: "student-life",
    name: "Student life",
    description: "The pressures students carry that rarely make it into an official statement.",
  },
  {
    slug: "features",
    name: "Features",
    description: "Longer-form pieces and commissioned work.",
  },
];

/** Newest first, matching the channel's own ordering. */
export const VIDEOS: Video[] = [
  {
    id: "f895dzgYWlE",
    title: "BABA: The Legacy Etched in Time",
    duration: "2:12",
    views: 50,
    published: "2025-11",
    format: "video",
    topic: "features",
  },
  {
    id: "hdO1R7E2j2w",
    title: "Eldoret National Polytechnic Wraps Up Cultural Week In Style",
    duration: "3:05",
    views: 79,
    published: "2025-10",
    format: "video",
    topic: "culture",
  },
  {
    id: "2BBoHfY5pC4",
    title: "Day 2 Of Kenyan Culture at the Eldoret National Polytechnic",
    duration: "3:05",
    views: 50,
    published: "2025-10",
    format: "video",
    topic: "culture",
  },
  {
    id: "ZipRAsCSADA",
    title: "Procurement at The Eldoret National Polytechnic Goes Digital",
    duration: "2:04",
    views: 47,
    published: "2025-10",
    format: "video",
    topic: "campus",
  },
  {
    id: "SUc2PxRU2vo",
    title: "Cultural Week Preparations at the Eldoret National Polytechnic",
    duration: "2:02",
    views: 31,
    published: "2025-10",
    format: "video",
    topic: "culture",
  },
  {
    id: "lvBl6mUA4XQ",
    title: "The War Between Comrades and Financial Lack",
    duration: "2:01",
    views: 47,
    published: "2025-10",
    format: "video",
    topic: "student-life",
  },
  {
    id: "XRE_3SmPoPU",
    title: "A Dream Maker Guitar Advertisement",
    duration: "0:30",
    views: 338,
    published: "2025-09",
    format: "short",
    topic: "features",
  },
  {
    id: "0VkzSTX3yoI",
    title: "September 30, 2025",
    duration: "0:24",
    views: 19,
    published: "2025-09",
    format: "short",
    topic: "features",
  },
];

/* ── Accessors ─────────────────────────────────────────────────── */

export const longFormVideos = (): Video[] => VIDEOS.filter((v) => v.format === "video");
export const shorts = (): Video[] => VIDEOS.filter((v) => v.format === "short");

export const videoById = (id: string): Video | undefined => VIDEOS.find((v) => v.id === id);

export const videosByTopic = (topic: TopicSlug): Video[] => VIDEOS.filter((v) => v.topic === topic);

export const topicName = (slug: TopicSlug): string =>
  TOPICS.find((t) => t.slug === slug)?.name ?? slug;

export const relatedVideos = (video: Video, limit = 3): Video[] => {
  const pool = VIDEOS.filter((v) => v.id !== video.id);
  const sameTopic = pool.filter((v) => v.topic === video.topic);
  const rest = pool.filter((v) => v.topic !== video.topic);
  return [...sameTopic, ...rest].slice(0, limit);
};

export const totalViews = (): number => VIDEOS.reduce((sum, v) => sum + v.views, 0);

/**
 * Poster frame served by YouTube itself.
 *
 * `hqdefault` rather than `maxresdefault`: every upload has one, so a card can
 * never fall back to a grey box, and it is a fraction of the bytes.
 */
export const posterFor = (id: string): string => `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;

/** Privacy-enhanced embed — no cookies until the viewer presses play. */
export const embedUrl = (id: string, autoplay = false): string =>
  `https://www.youtube-nocookie.com/embed/${id}?rel=0&modestbranding=1${autoplay ? "&autoplay=1" : ""}`;

export const watchUrl = (id: string): string => `https://www.youtube.com/watch?v=${id}`;
