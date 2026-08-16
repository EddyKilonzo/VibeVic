"use client";

import type { ComponentPropsWithoutRef, ElementType, ReactNode } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * The product's only button.
 *
 * Every state the brief calls for — hover, focus, press, disabled, loading —
 * is expressed here so no page reinvents them. Motion is limited to a 1px
 * lift, a colour transition, and a 3px arrow nudge (via `nudge-x` on any icon
 * child, driven by the `group`).
 *
 * It is polymorphic: `as={Link}` or `as="a"` renders a link that is styled and
 * sized identically, which matters because most primary actions on an
 * editorial site are navigations, not form submissions.
 */
const button = cva(
  [
    "group relative inline-flex items-center justify-center gap-2 whitespace-nowrap",
    "font-sans font-semibold tracking-tight",
    "transition-[background-color,color,border-color,box-shadow,transform] duration-normal ease-entrance",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
    "disabled:pointer-events-none disabled:opacity-45 aria-disabled:pointer-events-none aria-disabled:opacity-45",
    // Press is instant; the lift is only offered where a pointer can hover.
    "active:translate-y-0 active:scale-[0.985] active:duration-fast",
    "motion-reduce:transform-none motion-reduce:transition-none",
  ],
  {
    variants: {
      variant: {
        // Filled buttons carry real elevation — they are the one thing on the
        // page that should look pressable from across the room. Outline and
        // ghost stay flat at rest and only gain a shadow on hover, so a
        // toolbar of secondary actions doesn't read as a row of floating
        // tiles.
        primary:
          "bg-primary text-primary-foreground shadow-primary hover:bg-brand-ink-deep hover:shadow-primary-hover md:hover:-translate-y-px",
        accent:
          "bg-accent text-accent-foreground shadow-primary hover:bg-primary hover:shadow-primary-hover md:hover:-translate-y-px",
        outline:
          "border border-border bg-background text-foreground hover:border-primary hover:bg-secondary hover:text-primary hover:shadow-raised",
        ghost: "text-foreground hover:bg-secondary hover:text-primary",
        quiet: "text-muted-foreground hover:text-primary",
        destructive:
          "bg-destructive text-destructive-foreground shadow-primary hover:bg-destructive/90 hover:shadow-primary-hover",
      },
      size: {
        // 44px minimum touch target on every size that appears on mobile.
        // `sm` relaxes to 40px only from the `sm:` breakpoint up, where a
        // pointer is doing the aiming rather than a thumb.
        sm: "h-11 rounded-md px-3.5 text-[13px] sm:h-10",
        md: "h-11 rounded-md px-5 text-sm",
        lg: "h-[52px] rounded-md px-6 text-[15px] sm:px-7",
        icon: "h-11 w-11 rounded-md",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

type OwnProps<E extends ElementType> = VariantProps<typeof button> & {
  as?: E;
  loading?: boolean;
  /** Text shown while `loading`. Falls back to the normal children. */
  loadingText?: string;
  className?: string;
  children?: ReactNode;
};

export type ButtonProps<E extends ElementType = "button"> = OwnProps<E> &
  Omit<ComponentPropsWithoutRef<E>, keyof OwnProps<E>>;

export function Button<E extends ElementType = "button">({
  as,
  className,
  variant,
  size,
  loading = false,
  loadingText,
  disabled,
  children,
  ...props
}: ButtonProps<E>) {
  const Tag = (as ?? "button") as ElementType;
  const isButton = Tag === "button";
  const inactive = Boolean(disabled) || loading;

  return (
    <Tag
      className={cn(button({ variant, size }), className)}
      // Non-button elements have no `disabled`; aria-disabled carries it,
      // and the CVA base disables pointer events to match.
      {...(isButton ? { disabled: inactive } : inactive ? { "aria-disabled": true } : {})}
      aria-busy={loading || undefined}
      data-loading={loading || undefined}
      {...props}
    >
      {loading && <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />}
      <span className={cn("inline-flex items-center gap-2", loading && "opacity-90")}>
        {loading ? (loadingText ?? children) : children}
      </span>
    </Tag>
  );
}

export { button as buttonVariants };
