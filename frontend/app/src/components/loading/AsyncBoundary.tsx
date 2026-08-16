"use client";

import { Component, Suspense, type ErrorInfo, type ReactNode } from "react";
import { ErrorState } from "@/components/ui/States";

/**
 * One wrapper for the two ways an async subtree can fail to render: it is not
 * ready yet, or it broke. Suspense covers the first, an error boundary the
 * second, and pairing them means no caller can remember one and forget the
 * other.
 *
 * The retry is a real remount (the `key` bump), not a cosmetic reset — a
 * "Try again" button that only clears the error message and shows the same
 * broken tree is worse than no button.
 */
interface AsyncBoundaryProps {
  children: ReactNode;
  /** Shown while suspended. Pass the skeleton that matches this subtree. */
  fallback?: ReactNode;
  /** Shown when the subtree throws. Defaults to the standard error state. */
  errorFallback?: (reset: () => void) => ReactNode;
}

export function AsyncBoundary({ children, fallback = null, errorFallback }: AsyncBoundaryProps) {
  return (
    <SubtreeErrorBoundary errorFallback={errorFallback}>
      <Suspense fallback={fallback}>{children}</Suspense>
    </SubtreeErrorBoundary>
  );
}

interface BoundaryState {
  error: Error | null;
  /** Bumped on retry so React discards the failed subtree entirely. */
  attempt: number;
}

class SubtreeErrorBoundary extends Component<
  { children: ReactNode; errorFallback?: (reset: () => void) => ReactNode },
  BoundaryState
> {
  state: BoundaryState = { error: null, attempt: 0 };

  static getDerivedStateFromError(error: Error): Partial<BoundaryState> {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Kept to the console deliberately: there is no error-reporting backend
    // wired up yet, and pretending otherwise would hide real failures.
    console.error("[AsyncBoundary]", error, info.componentStack);
  }

  reset = () => this.setState((s) => ({ error: null, attempt: s.attempt + 1 }));

  render() {
    const { error, attempt } = this.state;
    const { children, errorFallback } = this.props;

    if (error) {
      return (
        errorFallback?.(this.reset) ?? (
          <ErrorState
            description="This section could not be loaded. The rest of the page is unaffected."
            onRetry={this.reset}
          />
        )
      );
    }

    return <div key={attempt} className="contents">{children}</div>;
  }
}
