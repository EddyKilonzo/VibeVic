import { cn } from "@/lib/utils";

export interface EditorialLoaderProps {
  /** Short, specific copy. "Preparing the story…" beats "Loading…". */
  label?: string;
  /** `bar` sits inline in a page; `inset` centres itself in its container. */
  variant?: "bar" | "inset";
  className?: string;
}

/**
 * The branded loading banner.
 *
 * Held to 48px tall on desktop and 44px on mobile so it reads as a status
 * line, not a screen takeover. It is a server component with no JavaScript at
 * all — the sweep is a CSS keyframe, which is the right trade for something
 * whose whole job is to appear before anything heavy has loaded.
 */
export function EditorialLoader({
  label = "Loading…",
  variant = "bar",
  className,
}: EditorialLoaderProps) {
  const content = (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "flex h-11 items-center gap-3 sm:h-12",
        variant === "bar" && "w-full",
        className,
      )}
    >
      <span
        aria-hidden
        className="font-display grid h-8 w-8 shrink-0 place-items-center rounded-sm bg-primary text-[13px] font-semibold text-primary-foreground"
      >
        VK
      </span>

      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13px] font-medium text-muted-foreground">
          {label}
        </span>
        {/* Indeterminate sweep: we do not know a percentage, so we don't imply one. */}
        <span
          aria-hidden
          className="mt-1.5 block h-px w-full overflow-hidden bg-border"
        >
          <span className="loader-sweep block h-full w-1/3 bg-accent" />
        </span>
      </span>
    </div>
  );

  if (variant === "inset") {
    return (
      <div className="flex min-h-[40vh] items-center justify-center px-6">
        <div className="w-full max-w-[280px]">{content}</div>
      </div>
    );
  }

  return content;
}
