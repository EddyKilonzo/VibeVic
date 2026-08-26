import type { Genre } from "@/data/types";
import { topBeats } from "@/lib/taxonomy";

/**
 * The beat tree, as `<select>` options.
 *
 * A native select is the right control here — it is a single choice from a
 * closed list, it is keyboard- and screen-reader-complete for free, and on a
 * phone it becomes the platform picker. What it is not good at is a flat run
 * of twenty-one entries where five of them are called things like "Kenya",
 * so the children sit inside `<optgroup>`s named for their parent.
 *
 * The parent itself stays selectable at the top of its own group. A story
 * about the news that is not specifically Kenyan, African, global or sport
 * has to be filable somewhere, and forcing a wrong child is worse filing than
 * an honest general one.
 *
 * `beats` is the whole taxonomy, from `useTaxonomy().genres`. It used to be two
 * lists — the published beats and anything opened locally — because a beat
 * opened in the workspace had no row and could not have a page. Beats are rows
 * now, so there is one list and one kind of beat, and the second parameter is
 * gone rather than kept as a shim that would always receive the same array
 * twice.
 *
 * The parent groups are derived from that same list rather than from a separate
 * constant: two sources for "which beats are top-level" is two answers that can
 * disagree, and the one that disagrees silently drops a beat from the picker.
 */
export function BeatOptions({ beats }: { beats: Genre[] }) {
  const parents = topBeats(beats);
  const known = new Set(parents.map((b) => b.slug));

  // A beat with no parent that is not itself a parent still has to be pickable.
  const loose = beats.filter((b) => !b.parent && !known.has(b.slug));

  return (
    <>
      {parents.map((parent) => {
        const children = beats.filter((b) => b.parent === parent.slug);
        if (children.length === 0) {
          return (
            <option key={parent.slug} value={parent.slug}>
              {parent.name}
            </option>
          );
        }

        return (
          <optgroup key={parent.slug} label={parent.name}>
            <option value={parent.slug}>{parent.name} — general</option>
            {children.map((child) => (
              <option key={child.slug} value={child.slug}>
                {child.name}
              </option>
            ))}
          </optgroup>
        );
      })}

      {loose.length > 0 && (
        <optgroup label="Other beats">
          {loose.map((beat) => (
            <option key={beat.slug} value={beat.slug}>
              {beat.name}
            </option>
          ))}
        </optgroup>
      )}
    </>
  );
}
