"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Check, Link2, X as Close } from "lucide-react";

import { cn } from "@/lib/utils";
import { stagger, transitions } from "@/lib/motion";
import { useCopy } from "@/hooks/useCopy";
import { useIsDesktop } from "@/hooks/useMediaQuery";
import { notify } from "@/lib/toast";
import { Overlay } from "@/components/ui/Overlay";

/* Brand marks are inlined: lucide dropped its brand set, and four small paths
   are cheaper than another dependency. */
const BRAND_ICON: Record<string, string> = {
  WhatsApp:
    "M17.47 14.38c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.17-.17.2-.35.22-.65.07-.3-.15-1.26-.46-2.4-1.48-.89-.79-1.49-1.77-1.66-2.07-.17-.3-.02-.46.13-.61.14-.14.3-.35.45-.53.15-.18.2-.3.3-.5.1-.2.05-.38-.02-.53-.08-.15-.67-1.61-.92-2.21-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.53.07-.8.38-.28.3-1.05 1.02-1.05 2.5s1.08 2.9 1.23 3.1c.15.2 2.12 3.24 5.13 4.54.72.31 1.28.5 1.71.63.72.23 1.37.2 1.89.12.58-.09 1.76-.72 2.01-1.42.25-.7.25-1.29.17-1.42-.07-.13-.27-.2-.57-.35zM12.05 21.5h-.01a9.5 9.5 0 0 1-4.84-1.33l-.35-.2-3.6.94.96-3.5-.23-.36a9.44 9.44 0 0 1-1.45-5.05c0-5.23 4.28-9.49 9.53-9.49a9.48 9.48 0 0 1 9.52 9.5c0 5.22-4.28 9.49-9.53 9.49z",
  X: "M17.53 3h3.01l-6.58 7.53L21.7 21h-6.06l-4.75-6.21L5.46 21H2.45l7.04-8.05L2.3 3h6.21l4.29 5.68L17.53 3zm-1.06 16.2h1.67L7.62 4.71H5.83l10.64 14.49z",
  LinkedIn:
    "M4.98 3.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5zM3 9h4v12H3V9zm7 0h3.8v1.71h.05c.53-.95 1.83-1.96 3.77-1.96 4.03 0 4.78 2.6 4.78 5.98V21h-4v-5.35c0-1.28-.02-2.92-1.8-2.92-1.8 0-2.08 1.38-2.08 2.82V21h-4V9z",
  Facebook:
    "M22 12.06C22 6.5 17.52 2 12 2S2 6.5 2 12.06c0 5 3.66 9.15 8.44 9.94v-7.03H7.9v-2.91h2.54V9.85c0-2.52 1.49-3.91 3.77-3.91 1.09 0 2.24.2 2.24.2v2.46h-1.26c-1.24 0-1.63.78-1.63 1.57v1.89h2.78l-.45 2.91h-2.33V22c4.78-.79 8.44-4.94 8.44-9.94z",
};

const NETWORKS = [
  { name: "WhatsApp", href: (u: string, t: string) => `https://wa.me/?text=${t}%20${u}` },
  { name: "X", href: (u: string, t: string) => `https://twitter.com/intent/tweet?text=${t}&url=${u}` },
  {
    name: "LinkedIn",
    href: (u: string) => `https://www.linkedin.com/sharing/share-offsite/?url=${u}`,
  },
  { name: "Facebook", href: (u: string) => `https://www.facebook.com/sharer/sharer.php?u=${u}` },
] as const;

export interface ShareSheetProps {
  title: string;
  /** Path on this site, e.g. "/stories/the-quiet-ledger". */
  path: string;
  open: boolean;
  onClose: () => void;
}

/**
 * Share panel — a bottom sheet on mobile, a centred card on desktop.
 *
 * Network links open in a new tab and are plain anchors, so they work without
 * JavaScript running in the click path and never navigate the reader away
 * from the article they are in the middle of.
 */
export function ShareSheet({ title, path, open, onClose }: ShareSheetProps) {
  const desktop = useIsDesktop();
  const reduced = useReducedMotion();
  const { copied, copy } = useCopy();

  const url = typeof window === "undefined" ? "" : `${window.location.origin}${path}`;
  const encodedUrl = encodeURIComponent(url);
  const encodedTitle = encodeURIComponent(title);

  const onCopy = async () => {
    const ok = await copy(url);
    if (ok) notify.success("Link copied");
    else notify.error("Couldn't copy the link", "Your browser blocked clipboard access.");
  };

  return (
    <Overlay
      open={open}
      onClose={onClose}
      from={desktop ? "center" : "bottom"}
      label={`Share ${title}`}
      panelClassName={cn(desktop ? "max-w-md pt-[12vh]" : "max-w-none")}
    >
      <div
        className={cn(
          "bg-card p-6 shadow-deep",
          desktop ? "rounded-xl border border-border" : "rounded-t-2xl pb-[max(1.5rem,env(safe-area-inset-bottom))]",
        )}
      >
        {!desktop && (
          <div aria-hidden className="mx-auto mb-5 h-1 w-10 rounded-full bg-border" />
        )}

        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="rule-label">Share</p>
            <p className="font-display mt-1 truncate text-lg font-semibold tracking-tight">
              {title}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close share panel"
            className="focus-ring -mr-2 -mt-2 flex h-11 w-11 items-center justify-center rounded-md text-muted-foreground transition-colors hover:text-foreground"
          >
            <Close className="h-4 w-4" aria-hidden />
          </button>
        </div>

        <div className="mt-6 grid grid-cols-4 gap-2">
          {NETWORKS.map((network, i) => (
            <motion.a
              key={network.name}
              href={network.href(encodedUrl, encodedTitle)}
              target="_blank"
              rel="noreferrer noopener"
              onClick={onClose}
              initial={reduced ? false : { opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ ...transitions.normal, delay: reduced ? 0 : i * stagger.tight }}
              className="focus-ring press surface surface-hover flex min-h-[88px] flex-col items-center justify-center gap-2.5 text-primary hover:border-primary hover:bg-secondary"
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current" aria-hidden>
                <path d={BRAND_ICON[network.name]} />
              </svg>
              <span className="text-[11px] font-semibold">{network.name}</span>
            </motion.a>
          ))}
        </div>

        <button
          type="button"
          onClick={onCopy}
          className="focus-ring press mt-3 surface surface-hover flex h-12 w-full items-center gap-3 px-4 text-left hover:border-primary hover:bg-secondary"
        >
          {/* Icon and label cross-fade together: Copy → Copied ✓ */}
          <span className="relative flex h-4 w-4 items-center justify-center">
            <AnimatePresence mode="wait" initial={false}>
              <motion.span
                key={copied ? "done" : "idle"}
                initial={reduced ? false : { opacity: 0, scale: 0.7 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.7 }}
                transition={transitions.fast}
                className="absolute inset-0 flex items-center justify-center"
              >
                {copied ? (
                  <Check className="h-4 w-4 text-accent" aria-hidden />
                ) : (
                  <Link2 className="h-4 w-4 text-muted-foreground" aria-hidden />
                )}
              </motion.span>
            </AnimatePresence>
          </span>
          <span className="min-w-0 flex-1 truncate text-sm">
            <span className={cn("font-semibold", copied && "text-accent")}>
              {copied ? "Link copied" : "Copy link"}
            </span>
            <span className="ml-2 text-muted-foreground">{url.replace(/^https?:\/\//, "")}</span>
          </span>
        </button>
      </div>
    </Overlay>
  );
}
