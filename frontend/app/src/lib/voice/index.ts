import type { VoiceEngine } from "./types";
import { WebSpeechEngine } from "./webSpeechEngine";

export * from "./types";
export * from "./extract";
export { WebSpeechEngine } from "./webSpeechEngine";

/**
 * Engine registry.
 *
 * Adding a premium neural provider is a two-line change here plus one class
 * implementing `VoiceEngine` — no component imports an engine directly, and
 * nothing in the UI branches on which one is running. It branches on
 * `engine.capabilities` instead, which is exactly the information that
 * differs between a device voice and a cloud voice.
 *
 * A cloud engine would additionally want, behind the same interface:
 *   - per-segment audio synthesis with a client-side cache keyed by
 *     (segment text + voice + rate), so a re-listen costs nothing;
 *   - prefetch of the next few segments while the current one plays;
 *   - `downloadable: true`, backing an "export as podcast episode" action;
 *   - real `wordBoundaries` from provider timing marks, which would upgrade
 *     the highlight from sentence-level to word-level for free.
 */
type EngineFactory = () => VoiceEngine;

const REGISTRY = new Map<string, EngineFactory>([["web-speech", () => new WebSpeechEngine()]]);

export function registerEngine(id: string, factory: EngineFactory): void {
  REGISTRY.set(id, factory);
}

export function availableEngineIds(): string[] {
  return [...REGISTRY.keys()];
}

/**
 * Returns the first engine that reports itself usable, preferring `preferred`.
 * Returns null when the device supports none — the caller must then hide the
 * feature rather than render a player that cannot play.
 */
export function createVoiceEngine(preferred?: string): VoiceEngine | null {
  const order = preferred ? [preferred, ...availableEngineIds()] : availableEngineIds();

  for (const id of order) {
    const factory = REGISTRY.get(id);
    if (!factory) continue;
    const engine = factory();
    if (engine.capabilities.available) return engine;
    engine.destroy();
  }

  return null;
}
