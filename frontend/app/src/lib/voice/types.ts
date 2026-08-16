/**
 * Voice engine contract.
 *
 * Nothing above this file knows that the browser's Speech Synthesis API
 * exists. The player, the provider and the article page all talk to a
 * `VoiceEngine`, so adding a neural cloud voice later means writing one more
 * implementation of this interface and registering it — no UI changes, no
 * vendor names leaking into components.
 *
 * The contract is deliberately segment-based rather than "speak this string":
 * segments are what make sentence highlighting, chapter jumps and resumable
 * playback possible, and they are equally natural for a cloud provider that
 * returns one audio file per paragraph.
 */

export type PlaybackState = "idle" | "preparing" | "playing" | "paused" | "ended" | "error";

export interface VoiceOption {
  id: string;
  name: string;
  /** BCP-47 tag, e.g. "en-GB". */
  lang: string;
  /** Runs on-device — no network, no per-character cost. */
  local: boolean;
  /** The platform's preferred voice for its language. */
  isDefault: boolean;
}

/** One spoken unit. Sentences, in practice — see `extract.ts`. */
export interface Segment {
  id: string;
  text: string;
  /** The article block this sentence belongs to, for paragraph highlighting. */
  blockId: string;
  /** Index into the chapter list, for the chapter rail. */
  chapterIndex: number;
  /** Set for the sentence that *is* a heading, so it can be spoken differently. */
  isHeading?: boolean;
  /** Estimated speaking time at 1x, in seconds. */
  estimatedSeconds: number;
}

export interface Chapter {
  index: number;
  title: string;
  /** Index of the first segment in this chapter. */
  startSegment: number;
  /** Estimated running time of the chapter, in seconds at 1x. */
  seconds: number;
}

/**
 * What a given engine can actually do.
 *
 * The UI reads these rather than assuming: browsers differ wildly in whether
 * they expose voices at all, and a cloud engine would flip `downloadable` and
 * `wordBoundaries` the other way.
 */
export interface EngineCapabilities {
  /** False means the feature must be hidden or disabled outright. */
  available: boolean;
  voiceSelection: boolean;
  rateControl: boolean;
  volumeControl: boolean;
  /** Fires per-word events during playback. */
  wordBoundaries: boolean;
  /** Can hand the reader an audio file. */
  downloadable: boolean;
  /** Playback survives the tab being backgrounded. */
  backgroundPlayback: boolean;
}

export interface EngineEvents {
  /** A segment began. `index` is into the loaded segment list. */
  segmentStart: (index: number) => void;
  segmentEnd: (index: number) => void;
  /** Word-level position within the current segment, where supported. */
  boundary: (index: number, charIndex: number) => void;
  stateChange: (state: PlaybackState) => void;
  /** The whole article finished. */
  finish: () => void;
  error: (message: string) => void;
}

export interface PlaybackOptions {
  rate: number;
  volume: number;
  voiceId: string | null;
}

export interface VoiceEngine {
  readonly id: string;
  readonly label: string;
  readonly capabilities: EngineCapabilities;

  /** Resolve voices and any async setup. Safe to call more than once. */
  init(): Promise<void>;
  listVoices(): VoiceOption[];

  load(segments: Segment[], options: PlaybackOptions): void;

  play(fromIndex?: number): void;
  pause(): void;
  resume(): void;
  stop(): void;
  /** Jump to a segment and continue in the current play/pause state. */
  seek(index: number): void;

  setRate(rate: number): void;
  setVolume(volume: number): void;
  setVoice(voiceId: string | null): void;

  on<K extends keyof EngineEvents>(event: K, handler: EngineEvents[K]): () => void;
  destroy(): void;
}
