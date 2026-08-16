"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { transitions } from "@/lib/motion";
import { PLAYBACK_RATES, useVoice, type PlaybackRate } from "@/context/VoiceProvider";

/** Shared dropdown shell: click-outside, Escape, and a 120ms open. */
function Menu({
  label,
  trigger,
  children,
  align = "left",
}: {
  label: string;
  trigger: React.ReactNode;
  children: (close: () => void) => React.ReactNode;
  align?: "left" | "right";
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();

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
            role="menu"
            initial={reduced ? { opacity: 0 } : { opacity: 0, y: 6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduced ? { opacity: 0 } : { opacity: 0, y: 4, scale: 0.98 }}
            transition={transitions.fast}
            className={cn(
              "absolute bottom-full z-30 mb-2 min-w-[168px] origin-bottom overflow-hidden rounded-md border border-border bg-popover p-1 shadow-xl",
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
  children,
}: {
  selected: boolean;
  onSelect: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="menuitemradio"
      aria-checked={selected}
      onClick={onSelect}
      className={cn(
        "focus-ring flex w-full items-center justify-between gap-3 rounded px-2.5 py-2 text-left text-xs transition-colors duration-fast hover:bg-secondary",
        selected ? "font-semibold text-primary" : "text-foreground",
      )}
    >
      <span className="truncate">{children}</span>
      {selected && <Check className="h-3.5 w-3.5 shrink-0 text-accent" aria-hidden />}
    </button>
  );
}

export function SpeedMenu() {
  const { preferences, setRate } = useVoice();

  return (
    <Menu label="Playback speed" trigger={<span className="tabular-nums">{preferences.rate}×</span>}>
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
 */
export function VoiceMenu() {
  const { voices, preferences, setVoice } = useVoice();
  if (voices.length < 2) return null;

  const current = voices.find((v) => v.id === preferences.voiceId);

  return (
    <Menu
      label="Reading voice"
      trigger={<span className="max-w-[110px] truncate">{current?.name ?? "Voice"}</span>}
    >
      {(close) => (
        <div className="max-h-64 overflow-y-auto">
          {voices.map((voice) => (
            <MenuItem
              key={voice.id}
              selected={voice.id === preferences.voiceId}
              onSelect={() => {
                setVoice(voice.id);
                close();
              }}
            >
              {voice.name}{" "}
              <span className="text-muted-foreground">
                {voice.lang}
                {voice.local ? "" : " · online"}
              </span>
            </MenuItem>
          ))}
        </div>
      )}
    </Menu>
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
