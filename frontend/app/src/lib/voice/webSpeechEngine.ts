import type {
  EngineCapabilities,
  EngineEvents,
  PlaybackOptions,
  PlaybackState,
  Segment,
  VoiceEngine,
  VoiceOption,
} from "./types";

/**
 * The browser-native engine: `window.speechSynthesis`.
 *
 * Chosen for the MVP because it needs no key, no network and no per-character
 * cost, and it is the only option that works offline. Its limitations are real
 * and are handled explicitly rather than papered over:
 *
 *  - Voices load asynchronously, and on some browsers only after a `voiceschanged`
 *    event that may fire more than once.
 *  - Chrome silently stops synthesis after roughly 15 seconds of continuous
 *    speech unless it is nudged; see `startKeepAlive`.
 *  - There is no duration and no seek. Timing is therefore *estimated* from
 *    word counts and reconciled at every segment boundary, so the reported
 *    position can drift within a sentence but is corrected once per sentence.
 *  - `onboundary` is unreliable across browsers, so sentence-level segments —
 *    not word boundaries — drive the highlight.
 */
export class WebSpeechEngine implements VoiceEngine {
  readonly id = "web-speech";
  readonly label = "Device voice";

  readonly capabilities: EngineCapabilities;

  private synth: SpeechSynthesis | null = null;
  private voices: VoiceOption[] = [];
  private nativeVoices: SpeechSynthesisVoice[] = [];

  private segments: Segment[] = [];
  private options: PlaybackOptions = { rate: 1, volume: 1, voiceId: null };

  private index = 0;
  private state: PlaybackState = "idle";
  private current: SpeechSynthesisUtterance | null = null;
  private keepAlive: number | undefined;
  /** Set while we cancel deliberately, so `onend` isn't mistaken for progress. */
  private interrupting = false;
  private initialised = false;

  private listeners: { [K in keyof EngineEvents]: Set<EngineEvents[K]> } = {
    segmentStart: new Set(),
    segmentEnd: new Set(),
    boundary: new Set(),
    stateChange: new Set(),
    finish: new Set(),
    error: new Set(),
  };

  /**
   * Cheap capability probe.
   *
   * Split out from the constructor so the UI can ask "should this feature
   * exist at all?" without instantiating an engine and its listeners. It reads
   * only globals, so it is safe to call during render and on the server.
   */
  static isSupported(): boolean {
    return (
      typeof window !== "undefined" &&
      "speechSynthesis" in window &&
      typeof window.SpeechSynthesisUtterance === "function"
    );
  }

  constructor() {
    const supported = WebSpeechEngine.isSupported();

    this.synth = supported ? window.speechSynthesis : null;

    this.capabilities = {
      available: supported,
      voiceSelection: supported,
      rateControl: supported,
      volumeControl: supported,
      // Reported honestly: we do not rely on boundary events, and several
      // browsers never fire them.
      wordBoundaries: false,
      downloadable: false,
      // Backgrounded tabs throttle timers and some platforms suspend synthesis.
      backgroundPlayback: false,
    };
  }

  async init(): Promise<void> {
    if (!this.synth || this.initialised) return;

    await new Promise<void>((resolve) => {
      const collect = () => {
        const list = this.synth?.getVoices() ?? [];
        if (list.length) {
          this.nativeVoices = list;
          this.voices = list.map((v) => ({
            id: v.voiceURI,
            name: v.name,
            lang: v.lang,
            local: v.localService,
            isDefault: v.default,
          }));
          resolve();
          return true;
        }
        return false;
      };

      if (collect()) return;

      // Safari and Chrome populate the list asynchronously.
      const onChange = () => {
        if (collect()) this.synth?.removeEventListener("voiceschanged", onChange);
      };
      this.synth?.addEventListener("voiceschanged", onChange);

      // Never hang the UI on a browser that simply exposes no voices.
      window.setTimeout(() => {
        this.synth?.removeEventListener("voiceschanged", onChange);
        resolve();
      }, 1500);
    });

    this.initialised = true;
  }

  listVoices(): VoiceOption[] {
    // English first — the corpus is English — then alphabetical.
    return [...this.voices].sort((a, b) => {
      const aEn = a.lang.toLowerCase().startsWith("en") ? 0 : 1;
      const bEn = b.lang.toLowerCase().startsWith("en") ? 0 : 1;
      return aEn - bEn || a.name.localeCompare(b.name);
    });
  }

  load(segments: Segment[], options: PlaybackOptions): void {
    this.stop();
    this.segments = segments;
    this.options = { ...options };
    this.index = 0;
  }

  play(fromIndex?: number): void {
    if (!this.synth || !this.segments.length) {
      this.emitError("Audio isn't available on this device.");
      return;
    }

    if (typeof fromIndex === "number") this.index = this.clamp(fromIndex);

    // A stale queue from another article or a previous run must not bleed in.
    this.interrupting = true;
    this.synth.cancel();
    this.interrupting = false;

    this.setState("playing");
    this.speakCurrent();
    this.startKeepAlive();
  }

  pause(): void {
    if (!this.synth || this.state !== "playing") return;
    // Some engines refuse pause mid-utterance; cancel-and-resume-from-segment
    // is the reliable fallback, and sentence granularity makes it invisible.
    try {
      this.synth.pause();
    } catch {
      this.interrupting = true;
      this.synth.cancel();
      this.interrupting = false;
    }
    this.stopKeepAlive();
    this.setState("paused");
  }

  resume(): void {
    if (!this.synth || this.state !== "paused") return;

    if (this.synth.paused && this.synth.speaking) {
      this.synth.resume();
    } else {
      // We had to cancel instead of pausing — restart this sentence.
      this.speakCurrent();
    }
    this.setState("playing");
    this.startKeepAlive();
  }

  stop(): void {
    if (!this.synth) return;
    this.interrupting = true;
    this.synth.cancel();
    this.interrupting = false;
    this.current = null;
    this.stopKeepAlive();
    this.index = 0;
    this.setState("idle");
  }

  seek(index: number): void {
    const target = this.clamp(index);
    this.index = target;

    if (this.state === "playing") {
      this.interrupting = true;
      this.synth?.cancel();
      this.interrupting = false;
      this.speakCurrent();
    } else {
      // Paused or idle: move the highlight without starting playback.
      this.emit("segmentStart", target);
    }
  }

  setRate(rate: number): void {
    this.options.rate = rate;
    // Rate is fixed for the life of an utterance, so restart the sentence to
    // apply it immediately rather than at the next full stop.
    if (this.state === "playing") this.seek(this.index);
  }

  setVolume(volume: number): void {
    this.options.volume = volume;
    if (this.current) this.current.volume = volume;
  }

  setVoice(voiceId: string | null): void {
    this.options.voiceId = voiceId;
    if (this.state === "playing") this.seek(this.index);
  }

  on<K extends keyof EngineEvents>(event: K, handler: EngineEvents[K]): () => void {
    this.listeners[event].add(handler);
    return () => {
      this.listeners[event].delete(handler);
    };
  }

  destroy(): void {
    this.stop();
    (Object.keys(this.listeners) as Array<keyof EngineEvents>).forEach((k) =>
      this.listeners[k].clear(),
    );
  }

  /* ── internals ──────────────────────────────────────────────── */

  private clamp(i: number): number {
    return Math.max(0, Math.min(this.segments.length - 1, i));
  }

  private speakCurrent(): void {
    const segment = this.segments[this.index];
    if (!segment || !this.synth) return;

    const utterance = new SpeechSynthesisUtterance(segment.text);
    utterance.rate = this.options.rate;
    utterance.volume = this.options.volume;
    // A heading read at the same pitch as body copy is indistinguishable from
    // a sentence; a touch of lift restores the structure by ear.
    utterance.pitch = segment.isHeading ? 1.06 : 1;

    const voice = this.nativeVoices.find((v) => v.voiceURI === this.options.voiceId);
    if (voice) {
      utterance.voice = voice;
      utterance.lang = voice.lang;
    }

    utterance.onstart = () => this.emit("segmentStart", this.index);
    utterance.onboundary = (e) => this.emit("boundary", this.index, e.charIndex);

    utterance.onend = () => {
      if (this.interrupting) return;
      this.emit("segmentEnd", this.index);
      this.advance();
    };

    utterance.onerror = (e) => {
      // "interrupted" and "canceled" are our own cancels, not failures.
      if (this.interrupting || e.error === "interrupted" || e.error === "canceled") return;
      this.stopKeepAlive();
      this.emitError(
        e.error === "not-allowed"
          ? "Your browser blocked audio playback. Try pressing play again."
          : "Audio playback stopped unexpectedly.",
      );
    };

    this.current = utterance;
    this.synth.speak(utterance);
  }

  private advance(): void {
    if (this.index >= this.segments.length - 1) {
      this.stopKeepAlive();
      this.current = null;
      this.setState("ended");
      this.emit("finish");
      return;
    }
    this.index += 1;
    if (this.state === "playing") this.speakCurrent();
  }

  /**
   * Chrome stops speaking after roughly 15 seconds unless synthesis is
   * poked. Pausing and immediately resuming resets that timer without any
   * audible seam.
   */
  private startKeepAlive(): void {
    this.stopKeepAlive();
    this.keepAlive = window.setInterval(() => {
      if (!this.synth?.speaking || this.synth.paused) return;
      this.synth.pause();
      this.synth.resume();
    }, 10000);
  }

  private stopKeepAlive(): void {
    if (this.keepAlive) window.clearInterval(this.keepAlive);
    this.keepAlive = undefined;
  }

  private setState(state: PlaybackState): void {
    if (this.state === state) return;
    this.state = state;
    this.emit("stateChange", state);
  }

  private emitError(message: string): void {
    this.setState("error");
    this.emit("error", message);
  }

  private emit<K extends keyof EngineEvents>(
    event: K,
    ...args: Parameters<EngineEvents[K]>
  ): void {
    this.listeners[event].forEach((handler) => {
      (handler as (...a: unknown[]) => void)(...args);
    });
  }
}
