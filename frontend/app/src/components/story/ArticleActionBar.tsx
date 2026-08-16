"use client";

import { useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { BookOpen, Headphones, Share2 } from "lucide-react";
import type { Story } from "@/data/types";
import { cn } from "@/lib/utils";
import { transitions } from "@/lib/motion";
import { formatDuration } from "@/lib/format";
import { useVoice } from "@/context/VoiceProvider";
import { BookmarkButton } from "./BookmarkButton";
import { ShareSheet } from "./ShareSheet";
import { VoicePlayer } from "@/components/voice/VoicePlayer";
import { ChapterRail } from "@/components/voice/ChapterRail";

/**
 * The reader's controls: Read / Listen, Save, Share.
 *
 * "Read" and "Listen" are presented as two modes of the same article rather
 * than as a player being switched on — choosing Listen expands the transport
 * in place, and choosing Read collapses it without stopping playback, so a
 * listener can put the controls away and keep listening.
 *
 * When the device has no speech synthesis at all, the Listen control is
 * absent rather than broken, and a single quiet line explains why.
 */
export function ArticleActionBar({ story }: { story: Story }) {
  const { supported, state, article, total, preparing, play } = useVoice();
  const reduced = useReducedMotion();
  const [mode, setMode] = useState<"read" | "listen">("read");
  const [chaptersOpen, setChaptersOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);

  const listening = state === "playing" || state === "paused";
  const expanded = mode === "listen";

  const openListen = () => {
    setMode("listen");
    // First press is the user gesture that unlocks audio — start immediately
    // rather than making them press twice.
    if (state === "idle" || state === "ended") play();
  };

  const estimated = article && total > 0 ? formatDuration(total) : null;

  return (
    <div className="mt-8">
      <div className="flex flex-wrap items-center gap-2">
        {supported && (
          <div
            role="group"
            aria-label="Reading mode"
            className="surface-compact relative inline-flex items-center p-1"
          >
            {(
              [
                { key: "read", label: "Read", icon: BookOpen },
                { key: "listen", label: "Listen", icon: Headphones },
              ] as const
            ).map(({ key, label, icon: Icon }) => {
              const active = mode === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => (key === "listen" ? openListen() : setMode("read"))}
                  aria-pressed={active}
                  className={cn(
                    "focus-ring tap relative inline-flex h-9 items-center gap-2 rounded px-3.5 text-[13px] font-semibold transition-colors duration-normal",
                    active ? "text-primary-foreground" : "text-muted-foreground hover:text-primary",
                  )}
                >
                  {/* One shared pill slides between the two modes. */}
                  {active && (
                    <motion.span
                      layoutId={reduced ? undefined : "mode-pill"}
                      className="absolute inset-0 rounded bg-primary"
                      transition={transitions.normal}
                    />
                  )}
                  <Icon className="relative h-3.5 w-3.5" aria-hidden />
                  <span className="relative">{label}</span>
                </button>
              );
            })}
          </div>
        )}

        <BookmarkButton itemId={story.slug} title={story.title} variant="inline" />

        <button
          type="button"
          onClick={() => setShareOpen(true)}
          className="focus-ring press inline-flex h-11 items-center gap-2 rounded-md border border-border px-4 text-sm font-semibold transition-colors duration-normal hover:border-primary hover:text-primary"
        >
          <Share2 className="h-4 w-4" aria-hidden />
          Share
        </button>

        {supported && !expanded && (
          <p className="ml-auto hidden text-xs text-muted-foreground sm:block">
            {preparing
              ? "Preparing audio…"
              : listening
                ? "Playing — open Listen for controls"
                : estimated
                  ? `${estimated} listen`
                  : "Listen to this story"}
          </p>
        )}
      </div>

      {!supported && (
        <p className="mt-3 text-xs text-muted-foreground">
          Audio isn't available on this device — the full story is below.
        </p>
      )}

      <AnimatePresence initial={false}>
        {expanded && supported && (
          <motion.div
            initial={reduced ? { opacity: 0 } : { opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={reduced ? { opacity: 0 } : { opacity: 0, height: 0 }}
            transition={transitions.normal}
            className="overflow-hidden"
          >
            <div className="pt-4">
              <VoicePlayer
                chaptersOpen={chaptersOpen}
                onToggleChapters={() => setChaptersOpen((v) => !v)}
              />
              <ChapterRail open={chaptersOpen} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <ShareSheet
        title={story.title}
        path={`/stories/${story.slug}`}
        open={shareOpen}
        onClose={() => setShareOpen(false)}
      />
    </div>
  );
}
