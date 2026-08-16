import { toast as sonner } from "sonner";

/**
 * Feedback wrapper.
 *
 * The brief asks for confirmation without intrusion, so everything routes
 * through here with one short duration and no icons-by-default. Callers never
 * touch sonner directly — that keeps every confirmation in the product
 * looking and lasting the same.
 */
const BASE = { duration: 2400 } as const;

export const notify = {
  /** "Story saved", "Link copied" — the quiet confirmation case. */
  success(message: string, description?: string) {
    sonner.success(message, { ...BASE, description });
  },
  info(message: string, description?: string) {
    sonner(message, { ...BASE, description });
  },
  /** Errors linger slightly longer and can offer a retry. */
  error(message: string, description?: string, retry?: () => void) {
    sonner.error(message, {
      duration: 4000,
      description,
      action: retry ? { label: "Try again", onClick: retry } : undefined,
    });
  },
  /** Undoable actions — deletes in the admin. */
  undo(message: string, onUndo: () => void) {
    sonner(message, {
      duration: 5000,
      action: { label: "Undo", onClick: onUndo },
    });
  },
  dismiss() {
    sonner.dismiss();
  },
};
