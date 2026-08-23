import type { ReactNode } from "react";
import { isExternalHref, parseInline } from "@/lib/inline";

/**
 * Text with its emphasis and links rendered.
 *
 * `<strong>` and `<em>`, not `<b>` and `<i>`: a screen reader announces the
 * first pair and ignores the second, and emphasis in a news story is meaning
 * rather than decoration.
 *
 * Unmarked text — which is nearly every paragraph — comes back as a bare
 * string rather than a wrapped one, so the common case stays a single text
 * node. Selection, find-in-page and copy all behave better when prose has not
 * been diced into spans for nothing.
 *
 * ── Links ────────────────────────────────────────────────────────────────
 * The href has already been through `safeHref` in the parser, which is an
 * allow-list: a run only carries one if it is http(s), mailto, or a path on
 * this site. Nothing here has to re-decide that, and nothing here should —
 * one place deciding what a link may point at is the whole reason it is safe.
 *
 * Off-site links get `rel="noreferrer noopener"` and open in a new tab. On a
 * journalist's site the citation is the evidence, and sending a reader out of
 * the piece to check it — losing their place, their scroll position and the
 * audio they had playing — is a bad trade for a footnote.
 *
 * Not a client component: it is a pure function of its prop, so it renders on
 * the server and both the emphasis and the links are in the HTML a crawler
 * receives.
 */
export function Inline({ text }: { text: string }) {
  const runs = parseInline(text);
  if (runs.length === 1 && !runs[0].bold && !runs[0].italic && !runs[0].href) {
    return <>{runs[0].text}</>;
  }

  return (
    <>
      {runs.map((run, i) => {
        let node: ReactNode = run.text;
        if (run.bold && run.italic) {
          node = (
            <strong>
              <em>{run.text}</em>
            </strong>
          );
        } else if (run.bold) {
          node = <strong>{run.text}</strong>;
        } else if (run.italic) {
          node = <em>{run.text}</em>;
        }

        if (run.href) {
          const external = isExternalHref(run.href);
          return (
            <a
              key={i}
              href={run.href}
              className="underline-grow font-medium text-primary underline decoration-accent/40 underline-offset-2 transition-colors hover:decoration-accent"
              {...(external ? { target: "_blank", rel: "noreferrer noopener" } : {})}
            >
              {node}
            </a>
          );
        }

        return <span key={i}>{node}</span>;
      })}
    </>
  );
}

export default Inline;
