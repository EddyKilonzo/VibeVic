"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import type { Block } from "@/data/types";
import {
  createVoiceEngine,
  voiceSupported,
  extractArticle,
  type Chapter,
  type PlaybackState,
  type Segment,
  type VoiceEngine,
  type VoiceOption,
} from "@/lib/voice";
import { recordAudioEvent } from "@/lib/voice/analytics";
import { useLocalStorage } from "@/hooks/useLocalStorage";

export const PLAYBACK_RATES = [0.75, 1, 1.25, 1.5, 1.75, 2] as const;
export type PlaybackRate = (typeof PLAYBACK_RATES)[number];

export interface VoicePreferences {
  rate: PlaybackRate;
  voiceId: string | null;
  followAlong: boolean;
  volume: number;
}

const DEFAULT_PREFERENCES: VoicePreferences = {
  rate: 1,
  voiceId: null,
  followAlong: true,
  volume: 1,
};

export interface ArticleAudio {
  slug: string;
  title: string;
  segments: Segment[];
  chapters: Chapter[];
  totalSeconds: number;
}

interface VoiceContextValue {
  /** Null when no engine on this device can speak — hide the feature. */
  supported: boolean;
  /** True until voices have been resolved for the first time. */
  preparing: boolean;
  state: PlaybackState;
  error: string | null;

  /** The article currently loaded into the engine, if any. */
  article: ArticleAudio | null;
  segmentIndex: number;
  /** Block id of the sentence being spoken — drives paragraph highlighting. */
  activeBlockId: string | null;
  /** The sentence text being spoken, for sentence-level highlighting. */
  activeSentence: string | null;
  chapterIndex: number;

  /** Estimated seconds elapsed and total, already adjusted for playback rate. */
  elapsed: number;
  total: number;

  voices: VoiceOption[];
  preferences: VoicePreferences;

  load: (slug: string, title: string, blocks: Block[]) => ArticleAudio;
  play: () => void;
  pause: () => void;
  toggle: () => void;
  stop: () => void;
  restart: () => void;
  nextChapter: () => void;
  previousChapter: () => void;
  seekToChapter: (index: number) => void;
  seekToBlock: (blockId: string) => void;
  seekToSegment: (index: number) => void;
  setRate: (rate: PlaybackRate) => void;
  setVoice: (voiceId: string | null) => void;
  /**
   * Speak one line in a voice, without choosing it.
   *
   * Reading the article is the only way to find out what a voice sounds like
   * otherwise, and "Microsoft Zira" tells nobody anything. Returns the id
   * currently sampling, via `sampling`, so the row can show it.
   */
  previewVoice: (voiceId: string) => void;
  /** Voice id being sampled right now, or null. */
  sampling: string | null;
  setFollowAlong: (enabled: boolean) => void;
  setVolume: (volume: number) => void;
}

const VoiceContext = createContext<VoiceContextValue | null>(null);

export function useVoice(): VoiceContextValue {
  const ctx = useContext(VoiceContext);
  if (!ctx) throw new Error("useVoice must be used inside <VoiceProvider>");
  return ctx;
}

/**
 * Owns the single speaking engine for the whole app.
 *
 * One provider rather than per-page state, because speech synthesis is a
 * global, single-voice resource: two players would talk over each other. It
 * also means preferences survive navigation, and a story keeps playing while
 * the reader scrolls — but is stopped deliberately when they leave the piece.
 *
 * Nothing here ever starts playback on its own. Every `play()` is downstream
 * of a user gesture.
 */
export function VoiceProvider({ children }: { children: ReactNode }) {
  const [preferences, setPreferences] = useLocalStorage<VoicePreferences>(
    "vv:voice-preferences",
    DEFAULT_PREFERENCES,
  );

  const engineRef = useRef<VoiceEngine | null>(null);
  /**
   * Whether narration can exist on this device at all.
   *
   * Read straight from the engine registry rather than tracked in state: it is
   * a fixed property of the browser, and the server snapshot is deliberately
   * `false` so the markup never ships a Listen button that a device without
   * speech synthesis would render and then have to take away.
   */
  const supported = useSyncExternalStore(
    () => () => {},
    voiceSupported,
    () => false,
  );
  const [preparing, setPreparing] = useState(false);
  const [voices, setVoices] = useState<VoiceOption[]>([]);
  const [state, setState] = useState<PlaybackState>("idle");
  const [error, setError] = useState<string | null>(null);

  const [article, setArticle] = useState<ArticleAudio | null>(null);
  const [segmentIndex, setSegmentIndex] = useState(0);
  const [withinSegment, setWithinSegment] = useState(0);

  const segmentStartedAt = useRef(0);
  const listenStartedAt = useRef(0);
  // The ref mirrors `article` so engine callbacks — which are registered once
  // and outlive every load — can read the current piece without the whole
  // subscription being torn down and rebuilt each time a reader opens a story.
  // It is written together with the state rather than during render, so the two
  // can never disagree.
  const articleRef = useRef<ArticleAudio | null>(null);

  /* ── Engine lifecycle ───────────────────────────────────────── */

  useEffect(() => {
    if (!supported) return;

    const engine = createVoiceEngine();
    if (!engine) return;

    engineRef.current = engine;

    const offs = [
      engine.on("segmentStart", (index) => {
        setSegmentIndex(index);
        setWithinSegment(0);
        segmentStartedAt.current = performance.now();
      }),
      engine.on("stateChange", (next) => {
        setState(next);
        if (next === "playing") setError(null);
      }),
      engine.on("finish", () => {
        const current = articleRef.current;
        if (current) {
          recordAudioEvent({
            type: "complete",
            slug: current.slug,
            seconds: (performance.now() - listenStartedAt.current) / 1000,
          });
        }
      }),
      engine.on("error", (message) => setError(message)),
    ];

    return () => {
      offs.forEach((off) => off());
      engine.destroy();
      engineRef.current = null;
    };
  }, [supported]);

  /* ── Elapsed time within the current sentence ───────────────── */

  useEffect(() => {
    if (state !== "playing") return;
    const id = window.setInterval(() => {
      setWithinSegment((performance.now() - segmentStartedAt.current) / 1000);
    }, 250);
    return () => window.clearInterval(id);
  }, [state]);

  /* ── Actions ────────────────────────────────────────────────── */

  const load = useCallback(
    (slug: string, title: string, blocks: Block[]): ArticleAudio => {
      const extracted = extractArticle(title, blocks);
      const next: ArticleAudio = { slug, title, ...extracted };
      articleRef.current = next;
      setArticle(next);
      setSegmentIndex(0);
      setWithinSegment(0);
      return next;
    },
    [],
  );

  const play = useCallback(async () => {
    const engine = engineRef.current;
    const current = articleRef.current;
    if (!engine || !current) return;

    // Voices resolve lazily; the first press is the moment it matters.
    if (!voices.length) {
      setPreparing(true);
      await engine.init();
      const list = engine.listVoices();
      setVoices(list);
      setPreparing(false);

      // Adopt the platform default the first time, rather than forcing one.
      if (!preferences.voiceId) {
        const preferred =
          list.find((v) => v.isDefault && v.lang.toLowerCase().startsWith("en")) ??
          list.find((v) => v.lang.toLowerCase().startsWith("en")) ??
          list[0];
        if (preferred) {
          setPreferences((p) => ({ ...p, voiceId: preferred.id }));
        }
        engine.load(current.segments, {
          rate: preferences.rate,
          volume: preferences.volume,
          voiceId: preferred?.id ?? null,
        });
      } else {
        engine.load(current.segments, {
          rate: preferences.rate,
          volume: preferences.volume,
          voiceId: preferences.voiceId,
        });
      }
    } else if (state === "idle" || state === "ended" || state === "error") {
      engine.load(current.segments, {
        rate: preferences.rate,
        volume: preferences.volume,
        voiceId: preferences.voiceId,
      });
    }

    if (state === "paused") {
      engine.resume();
    } else {
      listenStartedAt.current = performance.now();
      recordAudioEvent({ type: "play", slug: current.slug, rate: preferences.rate });
      engine.play(state === "ended" ? 0 : segmentIndex);
    }
  }, [voices.length, preferences, state, segmentIndex, setPreferences]);

  const pause = useCallback(() => {
    const current = articleRef.current;
    if (current && listenStartedAt.current) {
      recordAudioEvent({
        type: "pause",
        slug: current.slug,
        seconds: (performance.now() - listenStartedAt.current) / 1000,
      });
    }
    engineRef.current?.pause();
  }, []);

  const toggle = useCallback(() => {
    if (state === "playing") pause();
    else void play();
  }, [state, pause, play]);

  const stop = useCallback(() => {
    engineRef.current?.stop();
    setSegmentIndex(0);
    setWithinSegment(0);
  }, []);

  const restart = useCallback(() => {
    engineRef.current?.seek(0);
    setSegmentIndex(0);
    setWithinSegment(0);
  }, []);

  const seekSegment = useCallback(
    (index: number) => {
      const current = articleRef.current;
      if (!current) return;
      const clamped = Math.max(0, Math.min(current.segments.length - 1, index));
      engineRef.current?.seek(clamped);
      setSegmentIndex(clamped);
      setWithinSegment(0);
      recordAudioEvent({ type: "seek", slug: current.slug });
    },
    [],
  );

  const chapterIndex = article?.segments[segmentIndex]?.chapterIndex ?? 0;

  const seekToChapter = useCallback(
    (index: number) => {
      const current = articleRef.current;
      const chapter = current?.chapters[index];
      if (chapter) seekSegment(chapter.startSegment);
    },
    [seekSegment],
  );

  const nextChapter = useCallback(() => {
    const current = articleRef.current;
    if (!current) return;
    const next = current.chapters[chapterIndex + 1];
    // At the last chapter, "next" means the end of the piece.
    seekSegment(next ? next.startSegment : current.segments.length - 1);
  }, [chapterIndex, seekSegment]);

  const previousChapter = useCallback(() => {
    const current = articleRef.current;
    if (!current) return;
    const chapter = current.chapters[chapterIndex];
    // Mirrors a music player: restart this chapter unless already at its start.
    const atStart = segmentIndex <= (chapter?.startSegment ?? 0) + 1;
    const target = atStart ? current.chapters[chapterIndex - 1] : chapter;
    seekSegment(target?.startSegment ?? 0);
  }, [chapterIndex, segmentIndex, seekSegment]);

  const seekToBlock = useCallback(
    (blockId: string) => {
      const current = articleRef.current;
      if (!current) return;
      const index = current.segments.findIndex((s) => s.blockId === blockId);
      if (index >= 0) seekSegment(index);
    },
    [seekSegment],
  );

  const setRate = useCallback(
    (rate: PlaybackRate) => {
      setPreferences((p) => ({ ...p, rate }));
      engineRef.current?.setRate(rate);
      const current = articleRef.current;
      if (current) recordAudioEvent({ type: "rate", slug: current.slug, rate });
    },
    [setPreferences],
  );

  const setVoice = useCallback(
    (voiceId: string | null) => {
      setPreferences((p) => ({ ...p, voiceId }));
      engineRef.current?.setVoice(voiceId);
      const current = articleRef.current;
      if (current) recordAudioEvent({ type: "voice", slug: current.slug });
    },
    [setPreferences],
  );

  /**
   * The sample line.
   *
   * One sentence, ordinary punctuation, no proper nouns a synthesiser will
   * mangle differently from one voice to the next — the point is to compare
   * the voices, not their handling of "Kiplimo".
   */
  const [sampling, setSampling] = useState<string | null>(null);

  const previewVoice = useCallback(
    (voiceId: string) => {
      if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
      const synth = window.speechSynthesis;
      const native = synth.getVoices().find((v) => v.voiceURI === voiceId);
      if (!native) return;

      /* Playback and the sample share one synthesiser, so the article has to
         give way. Pausing rather than stopping keeps the place: the engine's
         `resume` already copes with a queue that was cleared underneath it by
         re-speaking the current sentence. */
      if (state === "playing") engineRef.current?.pause();

      synth.cancel();
      // `cancel` on a paused synth leaves it paused, and a paused synth will
      // not speak anything new — including this.
      synth.resume();

      const utterance = new SpeechSynthesisUtterance(
        "This is how the article will sound in this voice.",
      );
      utterance.voice = native;
      utterance.lang = native.lang;
      utterance.rate = preferences.rate;
      utterance.volume = preferences.volume;
      utterance.onend = () => setSampling((id) => (id === voiceId ? null : id));
      utterance.onerror = () => setSampling((id) => (id === voiceId ? null : id));

      setSampling(voiceId);
      synth.speak(utterance);
    },
    [state, preferences.rate, preferences.volume],
  );

  const setFollowAlong = useCallback(
    (followAlong: boolean) => setPreferences((p) => ({ ...p, followAlong })),
    [setPreferences],
  );

  const setVolume = useCallback(
    (volume: number) => {
      setPreferences((p) => ({ ...p, volume }));
      engineRef.current?.setVolume(volume);
    },
    [setPreferences],
  );

  /* ── Derived timing ─────────────────────────────────────────── */

  const { elapsed, total } = useMemo(() => {
    if (!article) return { elapsed: 0, total: 0 };
    const before = article.segments
      .slice(0, segmentIndex)
      .reduce((sum, s) => sum + s.estimatedSeconds, 0);
    const currentLength = article.segments[segmentIndex]?.estimatedSeconds ?? 0;
    // Never let the within-sentence estimate overrun into the next sentence.
    const inside = Math.min(withinSegment * preferences.rate, currentLength);
    return {
      elapsed: (before + inside) / preferences.rate,
      total: article.totalSeconds / preferences.rate,
    };
  }, [article, segmentIndex, withinSegment, preferences.rate]);

  const activeSegment = article?.segments[segmentIndex] ?? null;

  const value: VoiceContextValue = {
    supported,
    preparing,
    state,
    error,
    article,
    segmentIndex,
    activeBlockId: state === "idle" ? null : (activeSegment?.blockId ?? null),
    activeSentence: state === "playing" || state === "paused" ? (activeSegment?.text ?? null) : null,
    chapterIndex,
    elapsed,
    total,
    voices,
    preferences,
    load,
    play,
    pause,
    toggle,
    stop,
    restart,
    nextChapter,
    previousChapter,
    seekToChapter,
    seekToBlock,
    seekToSegment: seekSegment,
    setRate,
    setVoice,
    previewVoice,
    sampling,
    setFollowAlong,
    setVolume,
  };

  return <VoiceContext.Provider value={value}>{children}</VoiceContext.Provider>;
}
