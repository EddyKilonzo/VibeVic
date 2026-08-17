"use client";

import { useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Check, Copy, Mail, MessageCircle, Phone } from "lucide-react";
import { cn } from "@/lib/utils";
import { transitions } from "@/lib/motion";
import { useCopy } from "@/hooks/useCopy";
import { notify } from "@/lib/toast";
import { CONTACT } from "@/data/content";
import { Reveal } from "@/components/motion";
import { Button } from "@/components/ui/Button";
import { PageHero } from "@/components/hero/PageHero";
import { AtmosphereBand } from "@/components/ui/AtmosphereBand";
import { CONTACT_ATMOSPHERE } from "@/data/imagery";

/**
 * WhatsApp's own deep link, with the first message pre-filled. `wa.me` opens
 * the installed app on a phone and WhatsApp Web on a desktop, so one link
 * covers both without sniffing anything.
 */
const whatsappUrl = `https://wa.me/${CONTACT.phoneDigits}?text=${encodeURIComponent(
  CONTACT.whatsappMessage,
)}`;

type FormState = "idle" | "sending" | "sent" | "error";

export default function Contact() {
  const [state, setState] = useState<FormState>("idle");
  const reduced = useReducedMotion();

  /**
   * The form hands off to WhatsApp instead of posting anywhere.
   *
   * There is no backend to receive a submission, and the previous version of
   * this handler spent 900ms pretending to send before admitting it had not —
   * honest, but useless to someone with a tip. Composing the fields into a
   * WhatsApp draft makes the form do the thing it looks like it does: the
   * reader writes once, presses the button, and lands in a chat with the
   * message already typed and nothing sent until they press send again.
   *
   * When the API lands this becomes a real POST and the WhatsApp route stays
   * as the second option beside it.
   */
  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const data = new FormData(e.currentTarget);
    const value = (key: string) => String(data.get(key) ?? "").trim();

    const message = value("message");
    if (!message) {
      notify.error("Nothing to send", "Write your message first.");
      return;
    }

    const lines = [
      value("subject") || "Message from victorkiplimo.com",
      "",
      message,
      "",
      // Only what they actually filled in — an empty "From:" line reads as a
      // field that failed rather than one left blank on purpose.
      value("name") && `From: ${value("name")}`,
      value("email") && `Reply to: ${value("email")}`,
    ].filter(Boolean);

    setState("sent");
    window.open(
      `https://wa.me/${CONTACT.phoneDigits}?text=${encodeURIComponent(lines.join("\n"))}`,
      "_blank",
      "noopener,noreferrer",
    );
  };

  return (
    <>
      <PageHero
        label="Contact"
        title="Tips and corrections"
        lead="If you have seen something that should be reported, I would like to hear from you. If I have got something wrong, I would like to hear that faster."
      />

      <div className="container-site">
        {/* Atmosphere only — a desk, not a scene he reported. */}
        <AtmosphereBand image={CONTACT_ATMOSPHERE} className="mt-12" height="min-h-[220px]">
          <p className="rule-label text-brand-sky">Confidential</p>
          <p className="font-display mt-2 max-w-[36ch] text-2xl font-semibold leading-snug text-white sm:text-3xl">
            If it needs to stay off the record, say so in the first line.
          </p>
        </AtmosphereBand>


      <div className="mt-16 grid gap-14 lg:grid-cols-[1fr_1.1fr]">
        <Reveal variant="fade-right">
          <div className="space-y-px">
            <CopyRow
              label="Email"
              value={CONTACT.email}
              icon={<Mail className="h-4 w-4" aria-hidden />}
            />
            <CopyRow
              label="Phone"
              value={CONTACT.phone}
              icon={<Phone className="h-4 w-4" aria-hidden />}
            />
          </div>

          {/* The fastest route, and the one most people will actually use.
              The message is pre-written so the first thing a reader has to do
              is not compose an opening line to a stranger. */}
          <Button
            as="a"
            href={whatsappUrl}
            target="_blank"
            rel="noreferrer noopener"
            size="lg"
            className="group mt-6 w-full sm:w-auto"
          >
            <MessageCircle className="icon-rise h-4 w-4" aria-hidden />
            Message on WhatsApp
          </Button>

          <div className="mt-8 border border-dashed border-border p-6">
            <p className="rule-label">Before you send</p>
            <ul className="mt-4 space-y-3 text-sm leading-relaxed text-muted-foreground">
              <li>Do not use a work device or a work network.</li>
              {/* This used to recommend Signal, which is not one of the routes
                  above. Saying WhatsApp is fine for sensitive material would
                  be worse than saying nothing: its message contents are
                  end-to-end encrypted, but it is tied to your phone number and
                  the fact that you contacted a journalist is visible in the
                  metadata. A source deciding how much risk to take deserves
                  that distinction, not reassurance. */}
              <li>
                WhatsApp encrypts what you write, but it is tied to your phone number and records
                that you got in touch. For anything that could identify you, say so first and we
                will agree a safer channel before you send it.
              </li>
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
              {/* The label says where the button goes. "Send message" beside a
                  handler that opens WhatsApp would be a small lie, and the one
                  page on the site where a reader needs to know exactly which
                  app their words are about to land in is this one. */}
              <Button type="submit" size="lg" className="group">
                <MessageCircle className="icon-rise h-4 w-4" aria-hidden />
                Open in WhatsApp
              </Button>

              <AnimatePresence mode="wait">
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
                    Drafted in WhatsApp — press send there.
                  </motion.p>
                )}
              </AnimatePresence>
            </div>

            <p className="text-xs leading-relaxed text-muted-foreground">
              This opens WhatsApp with your message written out. Nothing is sent until you press
              send there, and nothing is stored on this site — there is no server behind this form.
            </p>
          </form>
        </Reveal>
      </div>
      </div>
    </>
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
