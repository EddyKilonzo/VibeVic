"use client";

import { useId, useState, type ReactNode } from "react";
import { Eye, EyeOff, ShieldAlert } from "lucide-react";
import { Reveal } from "@/components/motion";
import { cn } from "@/lib/utils";

/**
 * The chrome around every screen at the door.
 *
 * Three forms live behind this now — sign in, ask for a link, choose a new
 * password — and they are the same card with different contents. Written once
 * so the three cannot drift into three slightly different doors, which is the
 * kind of difference a person reads, half-consciously, as "this page is not
 * the one I was on a moment ago".
 *
 * The card arrives, then its contents in order — icon, heading, sentence,
 * fields. A door is the one screen where a beat of ceremony is the point: it
 * says the workspace is a separate place rather than another tab of the same
 * site. The whole sequence is under 400ms, and `Reveal` sits it out entirely
 * under `prefers-reduced-motion`.
 */
export function AccessCard({
  icon,
  title,
  intro,
  children,
  footnote,
}: {
  icon: ReactNode;
  title: string;
  intro: ReactNode;
  children: ReactNode;
  footnote?: ReactNode;
}) {
  return (
    <Reveal variant="fade-scale" className="surface w-full max-w-[420px] p-7 sm:p-9">
      <Reveal variant="fade-up" delay={90} distance="sm">
        <span className="grid h-11 w-11 place-items-center rounded-lg bg-primary text-primary-foreground">
          {icon}
        </span>
      </Reveal>

      <Reveal variant="mask" delay={150}>
        <h1 className="font-display display-3 mt-5 font-semibold">{title}</h1>
      </Reveal>

      <Reveal variant="fade-up" delay={230} distance="sm">
        <div className="mt-2 text-sm leading-relaxed text-muted-foreground">{intro}</div>
      </Reveal>

      {children}

      {footnote ? (
        <Reveal variant="fade" delay={380}>
          <div className="mt-7 border-t border-border pt-5 text-[11px] leading-relaxed text-muted-foreground">
            {footnote}
          </div>
        </Reveal>
      ) : null}
    </Reveal>
  );
}

/**
 * The "nothing here is configured" panel.
 *
 * Shown instead of a form, never alongside one. A form that cannot possibly
 * work is worse than no form: it invites someone to type a password into a
 * server that has no way to check it, and then blames them for it.
 */
export function Unconfigured({ children }: { children: ReactNode }) {
  return (
    <div
      role="alert"
      className="mt-6 flex gap-3 rounded-lg border border-dashed border-destructive/40 bg-destructive/5 p-4 text-sm"
    >
      <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-destructive" aria-hidden />
      <p className="leading-relaxed text-muted-foreground">{children}</p>
    </div>
  );
}

/**
 * One labelled field, so the three forms cannot spell a label differently.
 *
 * ── The eye ──────────────────────────────────────────────────────────────
 * A masked field on a door is a field somebody is typing a long phrase into
 * with no way to check it, on a keyboard that may not be theirs. That is
 * exactly where a typo is most likely and most expensive: on the reset screen
 * the link is single-use, so a mistyped password that is confirmed with the
 * same mistyped password locks the account out of a link already spent.
 *
 * `type="button"`, and the reason is worth writing down: a `<button>` inside
 * a form with no explicit type is a submit button, so the obvious version of
 * this posts the form the first time somebody wants to look at what they
 * typed.
 *
 * Revealing is per field and never sticky — nothing is stored, so it cannot
 * come back revealed on the next visit or on another screen.
 */
export function Field({
  id,
  name,
  label,
  type = "text",
  autoComplete,
  hint,
  invalid,
  describedBy,
  defaultValue,
  onValueChange,
}: {
  id: string;
  name: string;
  label: string;
  type?: string;
  autoComplete?: string;
  hint?: ReactNode;
  invalid?: boolean;
  describedBy?: string;
  defaultValue?: string;
  /** Live value, for a form that shows whether a rule is met as it is typed. */
  onValueChange?: (value: string) => void;
}) {
  const [revealed, setRevealed] = useState(false);
  const secret = type === "password";
  const generatedHintId = useId();
  const hintId = hint ? `${id}-hint-${generatedHintId}` : undefined;

  return (
    <div className="mt-4 first:mt-0">
      <label htmlFor={id} className="rule-label">
        {label}
      </label>
      <div className="relative mt-2">
        <input
          id={id}
          name={name}
          // The name stays `password` whatever the input is showing, so
          // revealing changes what the person sees and nothing else.
          type={secret && revealed ? "text" : type}
          autoComplete={autoComplete}
          defaultValue={defaultValue}
          required
          aria-invalid={invalid || undefined}
          aria-describedby={[describedBy, hintId].filter(Boolean).join(" ") || undefined}
          onChange={onValueChange ? (event) => onValueChange(event.target.value) : undefined}
          className={cn(
            "focus-ring h-11 w-full rounded-md border border-border bg-background px-3 text-[15px] outline-none transition-colors focus:border-accent",
            secret && "pr-11",
          )}
        />
        {secret ? (
          <button
            type="button"
            onClick={() => setRevealed((shown) => !shown)}
            aria-label={revealed ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`}
            aria-pressed={revealed}
            aria-controls={id}
            title={revealed ? "Hide" : "Show"}
            className="focus-ring absolute inset-y-0 right-0 grid w-11 place-items-center rounded-md text-muted-foreground transition-colors hover:text-foreground"
          >
            {revealed ? (
              <EyeOff className="h-4 w-4" aria-hidden />
            ) : (
              <Eye className="h-4 w-4" aria-hidden />
            )}
          </button>
        ) : null}
      </div>
      {hint ? (
        <div id={hintId} className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
          {hint}
        </div>
      ) : null}
    </div>
  );
}
