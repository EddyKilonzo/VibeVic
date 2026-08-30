import type { ReactNode } from "react";
import { ShieldAlert } from "lucide-react";
import { Reveal } from "@/components/motion";

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

/** One labelled field, so the three forms cannot spell a label differently. */
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
}: {
  id: string;
  name: string;
  label: string;
  type?: string;
  autoComplete?: string;
  hint?: string;
  invalid?: boolean;
  describedBy?: string;
  defaultValue?: string;
}) {
  const hintId = hint ? `${id}-hint` : undefined;

  return (
    <div className="mt-4 first:mt-0">
      <label htmlFor={id} className="rule-label">
        {label}
      </label>
      <input
        id={id}
        name={name}
        type={type}
        autoComplete={autoComplete}
        defaultValue={defaultValue}
        required
        aria-invalid={invalid || undefined}
        aria-describedby={[describedBy, hintId].filter(Boolean).join(" ") || undefined}
        className="focus-ring mt-2 h-11 w-full rounded-md border border-border bg-background px-3 text-[15px] outline-none transition-colors focus:border-accent"
      />
      {hint ? (
        <p id={hintId} className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
