import type { Genre } from "@/data/types";
import { TOP_BEATS } from "@/data/content";

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
 * `beats` is the full list the workspace offers — the built-ins plus anything
 * opened locally (see `lib/beats`). Locally-opened beats have no parent, so
 * they gather in a group of their own rather than being dropped.
 */
export function BeatOptions({ beats }: { beats: Genre[] }) {
  const known = new Set(TOP_BEATS.map((b) => b.slug));
  const custom = beats.filter((b) => !b.parent && !known.has(b.slug));

  return (
    <>
      {TOP_BEATS.map((parent) => {
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

      {custom.length > 0 && (
        <optgroup label="Opened here">
          {custom.map((beat) => (
            <option key={beat.slug} value={beat.slug}>
              {beat.name}
            </option>
          ))}
        </optgroup>
      )}
    </>
  );
}
