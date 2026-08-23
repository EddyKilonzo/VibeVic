import type { VoiceOption } from "./types";

/**
 * Making sense of the device's voice list.
 *
 * A browser hands over whatever the operating system has installed, in
 * whatever order it likes: on a well-stocked Windows machine that is sixty
 * entries, three of which are worth listening to, with the good ones buried
 * between Hungarian and Kannada. Nothing here adds a voice — there is nothing
 * to add, the set is the platform's — it sorts and labels what is already
 * there so the reader can find the three.
 */

/**
 * Names the vendors give their modern, non-concatenative voices.
 *
 * A heuristic on a display name, and deliberately a generous one: a false
 * positive costs a reader one disappointing sentence and a second tap, while
 * a false negative hides the best voice on the device in the bottom group.
 */
const NATURAL_HINT =
  /\b(natural|neural|premium|enhanced|studio|journey|wavenet|siri|nova|multilingual)\b/i;

/**
 * True for voices likely to sound like a person rather than a phoneme
 * splicer.
 *
 * The `!local` arm carries most of the weight in practice: a voice that needs
 * the network is, on every current browser, a vendor's server-side model —
 * Google's `en-GB Standard`, Microsoft's `Online (Natural)` — and those are
 * uniformly better than the on-device set they ship beside.
 */
export function isNaturalVoice(voice: VoiceOption): boolean {
  return NATURAL_HINT.test(voice.name) || !voice.local || /^google\s/i.test(voice.name);
}

/** Base language of a BCP-47 tag: "en-GB" → "en". */
function baseLanguage(tag: string): string {
  return (tag || "").toLowerCase().split(/[-_]/)[0] || "und";
}

/**
 * "sw" → "Swahili".
 *
 * `Intl.DisplayNames` is everywhere this site runs, but it throws on a
 * malformed tag rather than returning something — and voice tags are supplied
 * by the platform, not by us. The raw tag is a worse label than the real name
 * and a much better one than a crash.
 */
export function languageName(tag: string): string {
  const base = baseLanguage(tag);
  try {
    return new Intl.DisplayNames(["en"], { type: "language" }).of(base) ?? base.toUpperCase();
  } catch {
    return base.toUpperCase();
  }
}

export interface VoiceGroup {
  id: string;
  label: string;
  voices: VoiceOption[];
}

/**
 * The picker's sections.
 *
 * The corpus is English, so English leads and splits in two — the natural
 * voices first, because that is the choice most people are actually hunting
 * for. Everything else follows as one section per language, alphabetically,
 * which is the only order that lets someone find their own language without
 * reading the whole list.
 *
 * Empty sections are dropped rather than rendered as headings with nothing
 * under them.
 */
export function groupVoices(voices: VoiceOption[], primary = "en"): VoiceGroup[] {
  const primaryBase = baseLanguage(primary);
  const byName = (a: VoiceOption, b: VoiceOption) =>
    Number(b.isDefault) - Number(a.isDefault) || a.name.localeCompare(b.name);

  const primaryVoices = voices.filter((v) => baseLanguage(v.lang) === primaryBase);
  const natural = primaryVoices.filter(isNaturalVoice).sort(byName);
  const standard = primaryVoices.filter((v) => !isNaturalVoice(v)).sort(byName);

  const rest = new Map<string, VoiceOption[]>();
  for (const voice of voices) {
    const base = baseLanguage(voice.lang);
    if (base === primaryBase) continue;
    const bucket = rest.get(base);
    if (bucket) bucket.push(voice);
    else rest.set(base, [voice]);
  }

  const primaryLabel = languageName(primaryBase);
  const groups: VoiceGroup[] = [
    { id: `${primaryBase}-natural`, label: `${primaryLabel} · natural`, voices: natural },
    {
      id: `${primaryBase}-standard`,
      // Only worth qualifying when there is a natural group above it to
      // distinguish from; on a device with one kind of voice it is just
      // "English".
      label: natural.length ? `${primaryLabel} · standard` : primaryLabel,
      voices: standard,
    },
    ...[...rest.entries()]
      .map(([base, list]) => ({
        id: base,
        label: languageName(base),
        voices: list.sort(byName),
      }))
      .sort((a, b) => a.label.localeCompare(b.label)),
  ];

  return groups.filter((group) => group.voices.length > 0);
}
