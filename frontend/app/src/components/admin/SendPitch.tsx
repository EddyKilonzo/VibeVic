"use client";

import { useState } from "react";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { notify } from "@/lib/toast";
import type { Draft } from "@/lib/newsroom-schema";

/**
 * Putting a pitch in front of an editor.
 *
 * ── The step that used to happen outside the product ─────────────────────
 * The desk works an idea up into angles, the people who would have to be
 * called and the questions the piece would answer. `targetPublication` has
 * been a column since the newsroom was written. Nothing could act on either,
 * so a finished pitch was copied by hand into a mail client — where it stopped
 * being the record and became a message nobody could find again.
 *
 * ── Two clicks, and the second one shows the address ─────────────────────
 * This is the only thing in the newsroom that leaves the building and the only
 * one that cannot be undone. A record can be edited, a story can be taken back
 * down; a pitch that has gone to the wrong editor has gone. So "Send" opens
 * the form rather than sending, the address is typed rather than derived from
 * the masthead on the record, and the confirm button says where it is going.
 *
 * That is a confirmation and not a modal on purpose. A dialog asking "are you
 * sure?" gets dismissed reflexively and adds nothing a person reads; a button
 * that says "Send to editor@example.com" is read because the address is the
 * information.
 *
 * ── What it does not claim afterwards ────────────────────────────────────
 * "The relay accepted it", not "delivered". The mail service is explicit that
 * those are different, and there is no `sentAt` on the record for the same
 * reason — a stamp the server cannot support would be a fact the writer would
 * then rely on.
 */
export function SendPitch({ record }: { record: Draft }) {
  const [open, setOpen] = useState(false);
  const [to, setTo] = useState("");
  const [note, setNote] = useState("");
  const [sending, setSending] = useState(false);

  const id = String(record.id ?? "");
  const target = typeof record.targetPublication === "string" ? record.targetPublication : "";

  const send = async () => {
    setSending(true);
    try {
      const response = await fetch(`/api/newsroom/pitch/${encodeURIComponent(id)}/send`, {
        method: "POST",
        headers: { Accept: "application/json", "Content-Type": "application/json" },
        body: JSON.stringify({ to: to.trim(), note: note.trim() || undefined }),
        cache: "no-store",
      });

      if (response.ok) {
        setOpen(false);
        setTo("");
        setNote("");
        notify.success("Sent", `The relay accepted it for ${to.trim()}.`);
        return;
      }

      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      notify.error("Not sent", body?.error ?? `The newsroom returned ${response.status}.`);
    } catch {
      notify.error("Not sent", "Could not reach the newsroom. Nothing has gone out.");
    } finally {
      setSending(false);
    }
  };

  if (!open) {
    return (
      <Button size="sm" variant="outline" onClick={() => setOpen(true)} disabled={!id}>
        <Send className="h-3.5 w-3.5" aria-hidden />
        Send
      </Button>
    );
  }

  return (
    <div className="mt-3 w-full rounded-lg border border-accent/40 bg-secondary/40 p-3.5">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="min-w-0">
          <label
            htmlFor={`to-${id}`}
            className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"
          >
            Editor&rsquo;s address
          </label>
          <input
            id={`to-${id}`}
            type="email"
            value={to}
            onChange={(event) => setTo(event.target.value)}
            placeholder="editor@example.com"
            className="focus-ring mt-1.5 h-10 w-full rounded-md border border-border bg-background px-3 text-sm outline-none focus:border-accent"
          />
          {target && (
            <p className="mt-1.5 text-[11px] leading-snug text-muted-foreground">
              Filed as a pitch to {target}. The address is not derived from that — a masthead
              is a note to self, not a mailbox.
            </p>
          )}
        </div>

        <div className="min-w-0">
          <label
            htmlFor={`note-${id}`}
            className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"
          >
            Covering line
          </label>
          <textarea
            id={`note-${id}`}
            value={note}
            onChange={(event) => setNote(event.target.value)}
            rows={3}
            placeholder="Optional — a pitch that reads well needs no preamble."
            className="focus-ring mt-1.5 w-full resize-y rounded-md border border-border bg-background px-3 py-2 text-sm leading-relaxed outline-none focus:border-accent"
          />
        </div>
      </div>

      <p className="mt-3 max-w-[62ch] text-[11px] leading-snug text-muted-foreground">
        The title, the angle, and whichever of the three sections you filled in. Sources
        travel as a count and never as names — an email is a poor place to be responsible
        for a source.
      </p>

      <div className="mt-3.5 flex flex-wrap items-center gap-2">
        <Button size="sm" onClick={() => void send()} disabled={sending || !to.trim()}>
          <Send className="h-3.5 w-3.5" aria-hidden />
          {sending ? "Sending…" : to.trim() ? `Send to ${to.trim()}` : "Send"}
        </Button>
        <Button size="sm" variant="quiet" onClick={() => setOpen(false)} disabled={sending}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
