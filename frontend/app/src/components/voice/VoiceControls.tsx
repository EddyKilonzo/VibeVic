"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Check, ChevronDown, Play, Volume2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { transitions } from "@/lib/motion";
import type { VoiceOption } from "@/lib/voice/types";
import { groupVoices, isNaturalVoice } from "@/lib/voice/catalog";
import { PLAYBACK_RATES, useVoice, type PlaybackRate } from "@/context/VoiceProvider";

/** Shared dropdown shell: click-outside, Escape, and a 120ms open. */
function Menu({
  label,
  trigger,
  children,
  align = "left",
  placement = "down",
}: {
  label: string;
  trigger: React.ReactNode;
  children: (close: () => void) => React.ReactNode;
  align?: "left" | "right";
  /**
   * Which way the panel opens.
   *
   * Down by default, which is what a control halfway up the page should do.
   * The one caller that overrides it is the mobile bottom bar, where there is
   * nothing below the trigger but the edge of the screen.
   */
  placement?: "up" | "down";
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();

  /**
   * Bring the panel into view once it opens.
   *
   * Opening downward means opening into whatever is below, and in the article
   * rail that is the bottom edge of a card which scrolls its own overflow. So
   * the panel would be there, correctly placed, and mostly invisible. `block:
   * "nearest"` scrolls the least it can get away with — the card if the card
   * is what is in the way, the page if it is the page — and does nothing at
   * all when the panel already fits.
   */
  useEffect(() => {
    if (!open) return;
    const id = window.setTimeout(() => {
      panelRef.current?.scrollIntoView({
        block: "nearest",
        behavior: reduced ? "auto" : "smooth",
      });
    }, 60);
    return () => window.clearTimeout(id);
  }, [open, reduced]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={label}
        className="focus-ring tap inline-flex h-9 items-center gap-1.5 rounded-md px-2.5 text-xs font-semibold text-muted-foreground transition-colors duration-normal hover:bg-secondary hover:text-primary"
      >
        {trigger}
        <ChevronDown
          className={cn(
            "h-3 w-3 transition-transform duration-normal",
            open && "rotate-180",
          )}
          aria-hidden
        />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            ref={panelRef}
            role="menu"
            initial={
              reduced ? { opacity: 0 } : { opacity: 0, y: placement === "up" ? 6 : -6, scale: 0.98 }
            }
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={
              reduced ? { opacity: 0 } : { opacity: 0, y: placement === "up" ? 4 : -4, scale: 0.98 }
            }
            transition={transitions.fast}
            className={cn(
              // `rounded-xl` and a real elevation, matching `.surface`: this
              // is a panel that floats over the article, and the 6px radius
              // with a flat border it had read as a browser context menu
              // sitting on top of the design rather than part of it. The
              // hairline highlight along the top edge is the same one every
              // raised surface on the site carries.
              "absolute z-30 min-w-[176px] overflow-hidden rounded-xl border border-border bg-popover p-1.5 shadow-2xl",
              "before:pointer-events-none before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-white/60",
              placement === "up" ? "bottom-full mb-2 origin-bottom" : "top-full mt-2 origin-top",
              align === "right" ? "right-0" : "left-0",
            )}
          >
            {children(() => setOpen(false))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function MenuItem({
  selected,
  onSelect,
  meta,
  children,
}: {
  selected: boolean;
  onSelect: () => void;
  /** Second line, for anything that qualifies the choice rather than names it. */
  meta?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="menuitemradio"
      aria-checked={selected}
      onClick={onSelect}
      className={cn(
        "focus-ring flex w-full items-center justify-between gap-3 rounded-lg px-2.5 py-2 text-left text-xs transition-colors duration-fast",
        selected
          ? "bg-accent/10 font-semibold text-primary"
          : "text-foreground hover:bg-secondary",
      )}
    >
      <span className="min-w-0">
        <span className="block truncate">{children}</span>
        {meta && (
          <span className="mt-0.5 block truncate text-[10px] font-normal text-muted-foreground">
            {meta}
          </span>
        )}
      </span>
      {selected && <Check className="h-3.5 w-3.5 shrink-0 text-accent" aria-hidden />}
    </button>
  );
}

export function SpeedMenu({ placement }: { placement?: "up" | "down" } = {}) {
  const { preferences, setRate } = useVoice();

  return (
    <Menu
      label="Playback speed"
      placement={placement}
      trigger={<span className="tabular-nums">{preferences.rate}×</span>}
    >
      {(close) =>
        PLAYBACK_RATES.map((rate) => (
          <MenuItem
            key={rate}
            selected={preferences.rate === rate}
            onSelect={() => {
              setRate(rate as PlaybackRate);
              close();
            }}
          >
            {rate}× {rate === 1 && <span className="text-muted-foreground">Normal</span>}
          </MenuItem>
        ))
      }
    </Menu>
  );
}

/**
 * Voice picker.
 *
 * Renders nothing when the device exposes no voices — several browsers expose
 * exactly one, or none until the first utterance. Showing an empty selector
 * would advertise a choice that does not exist.
 *
 * The list is the platform's and every entry in it is offered; what this does
 * is order and label them (see `lib/voice/catalog`), because a flat run of
 * sixty system voices is a list nobody reads to the end of, and the two or
 * three worth hearing are never at the top of it.
 */
export function VoiceMenu({ placement }: { placement?: "up" | "down" } = {}) {
  const { voices, preferences, setVoice, previewVoice, sampling } = useVoice();
  const groups = useMemo(() => groupVoices(voices), [voices]);
  if (voices.length < 2) return null;

  const current = voices.find((v) => v.id === preferences.voiceId);

  return (
    <Menu
      label="Reading voice"
      placement={placement}
      trigger={<span className="max-w-[110px] truncate">{current?.name ?? "Voice"}</span>}
    >
      {(close) => (
        /* Width, not min-width, and narrower on large screens.
           The player's own card is `overflow-y-auto` when it is the sticky
           article rail, and a box that scrolls vertically clips horizontally
           too — CSS will not give you one axis visible and the other
           scrollable. So this panel cannot hang outside the card: at lg it is
           sized to the rail's inner width, and below lg, where the player is
           full-width, it takes the room it wants. Long voice names truncate;
           the language underneath is what distinguishes them. */
        <div
          data-lenis-prevent
          className="-mx-0.5 max-h-80 w-[248px] overflow-y-auto px-0.5 lg:w-[176px]"
        >
          {groups.map((group) => (
            <div key={group.id} role="group" aria-label={group.label}>
              {/* Sticky, so a scroll through forty voices never leaves you
                  looking at names with no idea which language you are in. */}
              <p className="sticky top-0 z-10 bg-popover/95 px-2 pb-1.5 pt-2.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground backdrop-blur-sm">
                {group.label}
              </p>
              {group.voices.map((voice) => (
                <VoiceRow
                  key={voice.id}
                  voice={voice}
                  selected={voice.id === preferences.voiceId}
                  sampling={sampling === voice.id}
                  onSelect={() => {
                    setVoice(voice.id);
                    close();
                  }}
                  onSample={() => previewVoice(voice.id)}
                />
              ))}
            </div>
          ))}
        </div>
      )}
    </Menu>
  );
}

/**
 * One voice: choose it, or hear it first.
 *
 * Two controls in one row rather than a button inside a button, which is
 * invalid and which no keyboard or screen reader handles the way the markup
 * implies. The row itself is a plain container; the name is the radio, and
 * the speaker is an ordinary button beside it.
 *
 * Sampling deliberately does not select. Choosing a reading voice by playing
 * four of them means four selections you did not want if the two are the same
 * action — and on a synthesiser, changing the voice mid-article restarts the
 * sentence, so the cost of an accidental one is real.
 */
function VoiceRow({
  voice,
  selected,
  sampling,
  onSelect,
  onSample,
}: {
  voice: VoiceOption;
  selected: boolean;
  sampling: boolean;
  onSelect: () => void;
  onSample: () => void;
}) {
  return (
    <div
      className={cn(
        "relative flex items-center gap-0.5 rounded-lg pr-1 transition-colors duration-fast",
        selected ? "bg-accent/10" : "hover:bg-secondary",
      )}
    >
      {/* The selected marker is a bar, not a tick: at this width a tick
          competes with the sample control for the same eight pixels, and the
          bar reads at a glance down a list of forty. */}
      {selected && (
        <span
          aria-hidden
          className="absolute inset-y-1.5 left-0 w-[3px] rounded-full bg-accent"
        />
      )}

      <button
        type="button"
        role="menuitemradio"
        aria-checked={selected}
        onClick={onSelect}
        className="focus-ring min-w-0 flex-1 rounded-lg px-2.5 py-2 text-left text-xs"
      >
        <span className={cn("block truncate", selected && "font-semibold text-primary")}>
          {voice.name}
        </span>
        <span className="mt-0.5 block truncate text-[10px] text-muted-foreground">
          {voice.lang}
          {isNaturalVoice(voice) && " · natural"}
          {!voice.local && " · online"}
          {voice.isDefault && " · default"}
        </span>
      </button>

      <button
        type="button"
        onClick={onSample}
        aria-label={sampling ? `Sampling ${voice.name}` : `Hear ${voice.name}`}
        title="Hear a sample"
        className={cn(
          // `tap-square` rather than `tap-reach`: this sits hard against the
          // voice-name button beside it, and an invisible 44px reach would
          // take taps meant for its neighbour. Growing the box instead makes
          // the row taller on a phone, which the row can afford.
          "focus-ring tap-square flex h-8 w-8 shrink-0 items-center justify-center rounded-md transition-colors duration-fast hover:bg-background hover:text-primary",
          sampling ? "text-accent" : "text-muted-foreground",
        )}
      >
        {sampling ? (
          <Volume2 className="h-3.5 w-3.5 animate-pulse" aria-hidden />
        ) : (
          <Play className="h-3 w-3" fill="currentColor" aria-hidden />
        )}
      </button>
    </div>
  );
}

/**
 * Follow-along toggle.
 *
 * Off by default would hide the feature; on by default risks moving the page
 * under someone. The compromise, implemented in `useFollowAlong`, is that the
 * scroll only happens when the spoken paragraph has actually left the
 * viewport, and any manual scroll suspends it.
 */
export function FollowAlongToggle() {
  const { preferences, setFollowAlong } = useVoice();
  const reduced = useReducedMotion();
  const on = preferences.followAlong;

  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={() => setFollowAlong(!on)}
      className="focus-ring tap inline-flex h-9 items-center gap-2 rounded-md px-2.5 text-xs font-semibold text-muted-foreground transition-colors duration-normal hover:text-primary"
    >
      <span
        className={cn(
          "relative flex h-[18px] w-[30px] shrink-0 items-center rounded-full p-[2px] transition-colors duration-normal",
          on ? "bg-accent" : "bg-border",
        )}
      >
        <motion.span
          className="h-[14px] w-[14px] rounded-full bg-white shadow-sm"
          animate={{ x: on ? 12 : 0 }}
          transition={reduced ? { duration: 0 } : { type: "spring", stiffness: 520, damping: 30 }}
        />
      </span>
      Follow along
    </button>
  );
}
