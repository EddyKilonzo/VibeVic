"use client";

import type { ReactNode } from "react";
import { AlertCircle, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "./Button";
import { Reveal } from "@/components/motion";

export interface EmptyStateProps {
  /** A quiet line-art mark, not an illustration. */
  icon?: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
  className?: string;
}

/**
 * Empty states get a voice, not an animation. One soft reveal on mount and
 * nothing after that.
 */
export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <Reveal variant="fade-up" distance="sm">
      <div
        className={cn(
          // `rounded-xl`, matching `.surface`: this is a card-scale object,
          // and 8px next to the 12px panels around it reads as a mistake
          // rather than as a distinction.
          "honeycomb honeycomb-strong flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card/60 px-6 py-20 text-center",
          className,
        )}
      >
        {icon && (
          <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-full bg-secondary text-primary">
            {icon}
          </div>
        )}
        <h3 className="font-display text-xl font-semibold tracking-tight text-foreground">
          {title}
        </h3>
        <p className="mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">{description}</p>
        {action && <div className="mt-7">{action}</div>}
      </div>
    </Reveal>
  );
}

export interface ErrorStateProps {
  title?: string;
  description?: string;
  onRetry?: () => void;
  retrying?: boolean;
  className?: string;
}

export function ErrorState({
  title = "Something went wrong.",
  description = "The page could not be loaded. This is usually temporary.",
  onRetry,
  retrying = false,
  className,
}: ErrorStateProps) {
  return (
    <Reveal variant="fade-up" distance="sm">
      <div
        role="alert"
        className={cn(
          "surface flex flex-col items-center justify-center px-6 py-16 text-center",
          className,
        )}
      >
        <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
          <AlertCircle className="h-5 w-5" aria-hidden />
        </div>
        <h3 className="font-display text-xl font-semibold tracking-tight">{title}</h3>
        <p className="mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">{description}</p>
        {onRetry && (
          <Button
            variant="outline"
            size="sm"
            className="mt-7"
            onClick={onRetry}
            loading={retrying}
            loadingText="Retrying"
          >
            <RefreshCw className="h-4 w-4" aria-hidden />
            Try again
          </Button>
        )}
      </div>
    </Reveal>
  );
}
