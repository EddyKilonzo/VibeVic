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

export interface Genre {
  slug: string;
  name: string;
  description: string;
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
