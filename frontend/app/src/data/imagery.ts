/**
 * Stock photography.
 *
 * ── The rule ────────────────────────────────────────────────────────────
 * These are **atmosphere, never evidence**. A photograph on a journalist's
 * site carries an implicit claim — that he was there, that this is what he
 * saw. Stock imagery makes that claim falsely, so it is confined to places
 * where nothing is being reported: section grounds, empty states, and the
 * contact page.
 *
 * Concretely, a stock photo may never appear:
 *   - as a story or report's cover image;
 *   - beside a byline, dateline or quotation;
 *   - anywhere a reader could reasonably read it as his own footage.
 *
 * Every entry carries a `credit` so attribution is available at the point of
 * use rather than living in a licence file nobody opens. Unsplash does not
 * require attribution, but a newsroom that quietly passes off other people's
 * pictures has already lost the argument about sourcing.
 *
 * URLs pin explicit width and quality parameters so the CDN returns a sized
 * image rather than the full-resolution original.
 */

export interface StockImage {
  /** Unsplash photo id, so the source is always traceable. */
  id: string;
  url: string;
  /** Describes the picture, and never implies it is his reporting. */
  alt: string;
  credit: string;
  creditUrl: string;
}

const cdn = (id: string, w = 1600) =>
  `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=${w}&q=80`;

/** Newsroom desk — used behind the contact page's tip form. */
export const CONTACT_ATMOSPHERE: StockImage = {
  id: "1585829365295-ab7cd400c167",
  url: cdn("1585829365295-ab7cd400c167"),
  alt: "A notebook and pen on a desk beside a laptop",
  credit: "Unsplash",
  creditUrl: "https://unsplash.com/photos/1585829365295-ab7cd400c167",
};

/** Reading — used on the writing archive's empty and intro states. */
export const READING_ATMOSPHERE: StockImage = {
  id: "1457369804613-52c61a468e7d",
  url: cdn("1457369804613-52c61a468e7d"),
  alt: "An open book resting on a table",
  credit: "Unsplash",
  creditUrl: "https://unsplash.com/photos/1457369804613-52c61a468e7d",
};

/** Microphone — used on the awards page while it has no entries. */
export const RECOGNITION_ATMOSPHERE: StockImage = {
  id: "1478737270239-2f02b77fc618",
  url: cdn("1478737270239-2f02b77fc618"),
  alt: "A microphone on a stand under low light",
  credit: "Unsplash",
  creditUrl: "https://unsplash.com/photos/1478737270239-2f02b77fc618",
};
