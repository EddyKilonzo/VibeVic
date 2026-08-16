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

interface EngineRegistration {
  create: EngineFactory;
  /**
   * Cheap probe answering "could this engine ever work here?" — no network, no
   * DOM writes, no instance. It exists so the UI can decide whether to render
   * the Listen affordance at all without paying to construct an engine, and so
   * that decision is safe to make during render.
   */
  isSupported: () => boolean;
}

const REGISTRY = new Map<string, EngineRegistration>([
  ["web-speech", { create: () => new WebSpeechEngine(), isSupported: WebSpeechEngine.isSupported }],
]);

export function registerEngine(
  id: string,
  factory: EngineFactory,
  isSupported: () => boolean = () => true,
): void {
  REGISTRY.set(id, { create: factory, isSupported });
}

/** True when at least one registered engine could run on this device. */
export function voiceSupported(): boolean {
  for (const registration of REGISTRY.values()) {
    if (registration.isSupported()) return true;
  }
  return false;
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
    const registration = REGISTRY.get(id);
    if (!registration || !registration.isSupported()) continue;
    const engine = registration.create();
    if (engine.capabilities.available) return engine;
    engine.destroy();
  }

  return null;
}
