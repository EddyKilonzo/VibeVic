/**
 * Content model.
 *
 * Articles are stored as an ordered list of typed blocks rather than as HTML.
 * That is what lets the editor drag blocks around and the voice engine read
 * only the parts that should be spoken — with a blob of markup, neither is
 * possible without parsing guesswork.
 */

export type BlockType = "paragraph" | "heading" | "quote" | "image" | "list" | "divider";

export interface BaseBlock {
  id: string;
  type: BlockType;
}

export interface ParagraphBlock extends BaseBlock {
  type: "paragraph";
  text: string;
}

export interface HeadingBlock extends BaseBlock {
  type: "heading";
  text: string;
  level: 2 | 3;
}

export interface QuoteBlock extends BaseBlock {
  type: "quote";
  text: string;
  attribution?: string;
}

export interface ImageBlock extends BaseBlock {
  type: "image";
  /** Seed for generated cover art, or a real URL once uploads exist. */
  src: string;
  alt: string;
  caption?: string;
}

export interface ListBlock extends BaseBlock {
  type: "list";
  items: string[];
  ordered?: boolean;
}

export interface DividerBlock extends BaseBlock {
  type: "divider";
}

export type Block =
  | ParagraphBlock
  | HeadingBlock
  | QuoteBlock
  | ImageBlock
  | ListBlock
  | DividerBlock;

export type StoryStatus = "published" | "draft" | "scheduled";

export interface Story {
  id: string;
  slug: string;
  title: string;
  /** Standfirst / deck. */
  dek: string;
  genre: string;
  tags: string[];
  status: StoryStatus;
  /** ISO date. */
  publishedAt: string;
  updatedAt: string;
  readingMinutes: number;
  featured?: boolean;
  /**
   * Template text shipped with the site, not authored reporting. Rendered
   * with a visible label so it can never be mistaken for published work;
   * cleared once the piece is rewritten in the admin.
   */
  placeholder?: boolean;
  /** Where it originally ran, if syndicated. */
  publication?: string;
  /**
   * The piece at its original home.
   *
   * Set on imported work. A syndicated article should always be able to point
   * at the version its author maintains — if the two ever diverge, the reader
   * can see which is which rather than having to trust this copy.
   */
  sourceUrl?: string;
  /**
   * A real cover photograph. When absent the site falls back to generated
   * art keyed off the slug, which is deliberately abstract — it is decoration
   * standing in for a picture, and must never be mistaken for one.
   */
  cover?: string;
  body: Block[];
  /** Analytics, only meaningful for published work. */
  stats?: {
    views: number;
    reads: number;
    /** Listens via the voice player. */
    listens: number;
    avgListenSeconds: number;
  };
}

/**
 * A story without its article body.
 *
 * What every listing actually has. The API projects listings through a summary
 * view and keeps bodies on the single-article route, because a page showing
 * twenty cards has no business downloading twenty articles — so the type the
 * cards are written against should be the one the network really delivers.
 *
 * `Story` is assignable to this, so anything already holding a full story can
 * still be passed to a card without a cast.
 */
export type StorySummary = Omit<Story, "body">;

export interface Genre {
  slug: string;
  name: string;
  description: string;
  /**
   * The beat this one sits under, if any.
   *
   * A flat list of twenty-one subjects is not a taxonomy, it is a wall — so
   * the archive is two levels: six beats a reader can hold in their head, and
   * the specific subjects underneath them. Only one level of nesting exists
   * and nothing here should add a second: a story is filed against exactly
   * one slug, parent or child, and everything that counts work under a parent
   * (`storiesByGenre`, the beats page, the filters) walks the family rather
   * than assuming a story sits on the parent itself.
   */
  parent?: string;
}

export interface Publication {
  name: string;
  role: string;
  period: string;
  description: string;
  url?: string;
}

export interface Award {
  year: string;
  title: string;
  body: string;
  description: string;
  result: "Winner" | "Finalist" | "Shortlisted" | "Honourable mention";
}
