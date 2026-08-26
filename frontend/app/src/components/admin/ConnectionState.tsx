"use client";

import { useSyncExternalStore } from "react";
import { Check, CloudOff, Loader2, RefreshCw, Wifi } from "lucide-react";
import { cn } from "@/lib/utils";

export type ConnectionStatus = "online" | "saving" | "offline" | "syncing" | "synced";

/**
 * Whether the browser thinks it has a network.
 *
 * `navigator.onLine` is genuinely an external store, and it is also a weak
 * signal: it reports whether an interface is up, not whether anything is
 * reachable. That is exactly why the UI below says "offline" rather than
 * "no connection" — the browser is reporting its own belief, and the label
 * should claim no more than that.
 */
function useOnline(): boolean {
  return useSyncExternalStore(
    (onChange) => {
      window.addEventListener("online", onChange);
      window.addEventListener("offline", onChange);
      return () => {
        window.removeEventListener("online", onChange);
        window.removeEventListener("offline", onChange);
      };
    },
    () => navigator.onLine,
    // Assume connected during prerender: an "offline" badge flashing on every
    // cold load would train the journalist to ignore the one signal that
    // matters when it is real.
    () => true,
  );
}

const LOOK: Record<ConnectionStatus, { label: string; icon: typeof Wifi; tone: string }> = {
  online: { label: "Online", icon: Wifi, tone: "text-muted-foreground" },
  saving: { label: "Saving…", icon: Loader2, tone: "text-accent" },
  syncing: { label: "Syncing…", icon: RefreshCw, tone: "text-accent" },
  synced: { label: "All changes saved", icon: Check, tone: "text-primary" },
  offline: { label: "Offline — saved on this device", icon: CloudOff, tone: "text-destructive" },
};

/**
 * The workspace's connection and save state, always visible.
 *
 * The brief asks for this to be permanent rather than a transient toast, and
 * that is the right call: a journalist working on a train needs to know at a
 * glance whether their last paragraph is safe, not to have been told once
 * three minutes ago.
 *
 * Nothing here claims a sync that has not happened. This badge reports the
 * browser's own belief about the network and nothing else — it is mounted in
 * the layout with no props, so it never sees a request outcome and must not
 * imply one. `offline` says plainly that the work is on this device, which is
 * what `writeDraft` guarantees in every case.
 *
 * Where a save really landed is the workspace's own indicator to report, and it
 * does: `SaveIndicator` distinguishes "saved to the newsroom" from "saved on
 * this device only" because it is the thing holding the answer. Two components
 * both guessing at that would eventually disagree in front of a writer.
 */
export function ConnectionState({
  saving = false,
  savedAt = null,
  className,
}: {
  saving?: boolean;
  savedAt?: Date | null;
  className?: string;
}) {
  const online = useOnline();

  // Derived, not stored: the status is a pure function of three inputs, and
  // keeping a copy in state would only create a frame where the badge and the
  // thing it describes disagree.
  const status: ConnectionStatus = !online
    ? "offline"
    : saving
      ? "saving"
      : savedAt
        ? "synced"
        : "online";

  const { label, icon: Icon, tone } = LOOK[status];

  return (
    <p
      role="status"
      aria-live="polite"
      className={cn(
        "inline-flex items-center gap-1.5 text-[11px] font-semibold",
        tone,
        className,
      )}
    >
      <Icon
        // "syncing" is in the type for a screen that watches a request; this
        // one does not, so nothing produces it here and only "saving" spins.
        // The unreachable branch is left out rather than faked.
        className={cn("h-3.5 w-3.5", status === "saving" && "animate-spin")}
        aria-hidden
      />
      {label}
    </p>
  );
}
