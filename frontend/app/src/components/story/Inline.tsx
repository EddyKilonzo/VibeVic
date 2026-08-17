import { parseInline } from "@/lib/inline";

/**
 * Text with its emphasis rendered.
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
 * Not a client component: it is a pure function of its prop, so it renders on
 * the server and the emphasis is in the HTML a crawler receives.
 */
export function Inline({ text }: { text: string }) {
  const runs = parseInline(text);
  if (runs.length === 1 && !runs[0].bold && !runs[0].italic) return <>{runs[0].text}</>;

  return (
    <>
      {runs.map((run, i) => {
        if (run.bold && run.italic) {
          return (
            <strong key={i}>
              <em>{run.text}</em>
            </strong>
          );
        }
        if (run.bold) return <strong key={i}>{run.text}</strong>;
        if (run.italic) return <em key={i}>{run.text}</em>;
        return <span key={i}>{run.text}</span>;
      })}
    </>
  );
}

export default Inline;
