"use client";

import { useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Check, Copy, Mail, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { transitions } from "@/lib/motion";
import { useCopy } from "@/hooks/useCopy";
import { notify } from "@/lib/toast";
import { Reveal } from "@/components/motion";
import { Button } from "@/components/ui/Button";

const EMAIL = "tips@maraellison.example";
const SIGNAL = "+44 7700 900112";

type FormState = "idle" | "sending" | "sent" | "error";

export default function Contact() {
  const [state, setState] = useState<FormState>("idle");
  const reduced = useReducedMotion();

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (state === "sending") return;

    setState("sending");
    // Stands in for the real submission endpoint.
    await new Promise((resolve) => setTimeout(resolve, 900));

    // No backend is wired up yet, so this reports honestly rather than
    // claiming a delivery that did not happen.
    setState("error");
    notify.error(
      "Message not sent",
      "The contact form isn't connected yet — please use the email address instead.",
    );
  };

  return (
    <div className="container-site pt-32 sm:pt-40">
      <Reveal variant="fade-up">
        <p className="rule-label">Contact</p>
        <h1 className="font-display mt-3 text-4xl font-semibold tracking-tight text-balance sm:text-6xl">
          Tips and corrections
        </h1>
        <p className="mt-4 max-w-xl text-lg leading-relaxed text-muted-foreground">
          If you have seen something that should be reported, I would like to hear from you. If I
          have got something wrong, I would like to hear that faster.
        </p>
      </Reveal>

      <div className="mt-16 grid gap-14 lg:grid-cols-[1fr_1.1fr]">
        <Reveal variant="fade-right">
          <div className="space-y-px">
            <CopyRow label="Email" value={EMAIL} icon={<Mail className="h-4 w-4" aria-hidden />} />
            <CopyRow
              label="Signal"
              value={SIGNAL}
              icon={<ShieldCheck className="h-4 w-4" aria-hidden />}
            />
          </div>

          <div className="mt-8 border border-dashed border-border p-6">
            <p className="rule-label">Before you send</p>
            <ul className="mt-4 space-y-3 text-sm leading-relaxed text-muted-foreground">
              <li>Do not use a work device or a work network.</li>
              <li>Signal is preferred for anything sensitive; set messages to disappear.</li>
              <li>
                I will not publish anything that identifies you without agreeing it with you first.
              </li>
            </ul>
          </div>
        </Reveal>

        <Reveal variant="fade-left">
          <form onSubmit={onSubmit} className="space-y-5">
            <Field label="Your name" name="name" autoComplete="name" />
            <Field label="Email" name="email" type="email" required autoComplete="email" />
            <Field label="Subject" name="subject" required />
            <Field label="Message" name="message" required multiline />

            <div className="flex flex-wrap items-center gap-4 pt-1">
              <Button type="submit" size="lg" loading={state === "sending"} loadingText="Sending">
                Send message
              </Button>

              <AnimatePresence mode="wait">
                {state === "error" && (
                  <motion.p
                    key="error"
                    role="status"
                    initial={reduced ? { opacity: 0 } : { opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={transitions.normal}
                    className="text-sm text-destructive"
                  >
                    Not connected yet — please email instead.
                  </motion.p>
                )}
                {state === "sent" && (
                  <motion.p
                    key="sent"
                    role="status"
                    initial={reduced ? { opacity: 0 } : { opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={transitions.normal}
                    className="flex items-center gap-2 text-sm text-accent"
                  >
                    <Check className="h-4 w-4" aria-hidden />
                    Message sent.
                  </motion.p>
                )}
              </AnimatePresence>
            </div>
          </form>
        </Reveal>
      </div>
    </div>
  );
}

/** Copy → Copied ✓, reverting on its own. */
function CopyRow({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
}) {
  const { copied, copy } = useCopy();
  const reduced = useReducedMotion();

  return (
    <button
      type="button"
      onClick={() => void copy(value)}
      className="focus-ring press group flex w-full items-center gap-4 border-t border-border py-5 text-left transition-colors duration-normal hover:border-primary"
    >
      <span className="text-muted-foreground transition-colors group-hover:text-accent">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="rule-label block">{label}</span>
        <span className="mt-1 block truncate font-medium">{value}</span>
      </span>
      <span
        className={cn(
          "flex shrink-0 items-center gap-2 text-xs font-semibold transition-colors",
          copied ? "text-accent" : "text-muted-foreground",
        )}
      >
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
              {copied ? <Check className="h-4 w-4" aria-hidden /> : <Copy className="h-4 w-4" aria-hidden />}
            </motion.span>
          </AnimatePresence>
        </span>
        {copied ? "Copied" : "Copy"}
      </span>
    </button>
  );
}

function Field({
  label,
  name,
  type = "text",
  required,
  multiline,
  autoComplete,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  multiline?: boolean;
  autoComplete?: string;
}) {
  const base =
    "peer w-full border-b border-border bg-transparent pb-2 pt-6 text-[15px] outline-none transition-colors duration-normal focus:border-accent placeholder:text-transparent";

  return (
    <div className="relative">
      {multiline ? (
        <textarea id={name} name={name} rows={5} required={required} placeholder={label} className={cn(base, "resize-y")} />
      ) : (
        <input
          id={name}
          name={name}
          type={type}
          required={required}
          autoComplete={autoComplete}
          placeholder={label}
          className={base}
        />
      )}
      {/* Label rises out of the field on focus or once it has content. */}
      <label
        htmlFor={name}
        className="pointer-events-none absolute left-0 top-6 text-[15px] text-muted-foreground transition-all duration-normal ease-entrance peer-focus:top-0 peer-focus:text-[11px] peer-focus:font-semibold peer-focus:uppercase peer-focus:tracking-[0.16em] peer-focus:text-accent peer-[:not(:placeholder-shown)]:top-0 peer-[:not(:placeholder-shown)]:text-[11px] peer-[:not(:placeholder-shown)]:font-semibold peer-[:not(:placeholder-shown)]:uppercase peer-[:not(:placeholder-shown)]:tracking-[0.16em]"
      >
        {label}
        {required && <span className="text-accent"> *</span>}
      </label>
    </div>
  );
}
