"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Field } from "@/lib/newsroom-schema";

/**
 * One field of one record, drawn from the schema.
 *
 * ── Why the kinds are few ────────────────────────────────────────────────
 * Nine of them cover every field in the newsroom model, and the restraint is
 * the point: a schema that can express anything ends up expressing each field
 * slightly differently, and the journalist pays for that in surprises. A date
 * is a date everywhere. A visibility select looks the same on a source as on a
 * note. Where the model needs something genuinely new, a tenth kind is a small
 * and visible change.
 *
 * ── State lives above ────────────────────────────────────────────────────
 * Every kind is controlled by the draft in `RecordPanel`, except the two that
 * hold a half-typed entry — tags and lines — which keep their own input buffer
 * and commit whole values upward. That is the only local state here, and it is
 * the reason a tag typed and clicked away from is not silently lost.
 */

const INPUT =
  "focus-ring h-10 w-full rounded-md border border-border bg-background px-3 text-sm outline-none transition-colors focus:border-accent";

export function RecordField({
  field,
  value,
  onChange,
  options,
  id,
}: {
  field: Field;
  value: unknown;
  onChange: (next: unknown) => void;
  /** Rows to choose from, for `ref` and `refs`. Resolved by the panel. */
  options?: readonly { id: string; label: string }[];
  id: string;
}) {
  const label = (
    <label htmlFor={id} className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
      {field.label}
      {field.required && <span className="ml-1 text-destructive">*</span>}
    </label>
  );

  const help = field.help && (
    <p className="mt-1.5 text-[11px] leading-snug text-muted-foreground">{field.help}</p>
  );

  return (
    <div className={cn("min-w-0", field.wide && "sm:col-span-2")}>
      {field.kind !== "toggle" && label}
      <div className={field.kind === "toggle" ? "" : "mt-1.5"}>
        <Control field={field} value={value} onChange={onChange} options={options} id={id} />
      </div>
      {help}
    </div>
  );
}

function Control({
  field,
  value,
  onChange,
  options,
  id,
}: {
  field: Field;
  value: unknown;
  onChange: (next: unknown) => void;
  options?: readonly { id: string; label: string }[];
  id: string;
}) {
  const text = typeof value === "string" ? value : "";
  const list = Array.isArray(value) ? (value as string[]) : [];

  switch (field.kind) {
    case "textarea":
      return (
        <textarea
          id={id}
          value={text}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder}
          rows={4}
          className="focus-ring w-full resize-y rounded-md border border-border bg-background px-3 py-2 text-sm leading-relaxed outline-none transition-colors focus:border-accent"
        />
      );

    case "select":
      return (
        <select
          id={id}
          value={text}
          onChange={(e) => onChange(e.target.value)}
          className={INPUT}
        >
          {field.options?.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      );

    case "date":
    case "datetime":
      return (
        <input
          id={id}
          type={field.kind === "date" ? "date" : "datetime-local"}
          value={forInput(text, field.kind)}
          onChange={(e) => onChange(e.target.value)}
          className={INPUT}
        />
      );

    case "toggle":
      return (
        <label className="flex cursor-pointer items-center gap-2.5 text-sm">
          <input
            id={id}
            type="checkbox"
            checked={value === true}
            onChange={(e) => onChange(e.target.checked)}
            className="focus-ring h-4 w-4 rounded border-border accent-primary"
          />
          <span className="font-semibold text-muted-foreground">{field.label}</span>
        </label>
      );

    case "tags":
      return <Chips values={list} onChange={onChange} id={id} placeholder={field.placeholder} />;

    case "lines":
      return <Lines values={list} onChange={onChange} id={id} />;

    case "ref":
      return (
        <select
          id={id}
          value={text}
          onChange={(e) => onChange(e.target.value)}
          className={INPUT}
        >
          {/* An explicit "none", because clearing a reference is a thing
              people need to do and an empty first option is the only way a
              select offers it. */}
          <option value="">— none —</option>
          {options?.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </select>
      );

    case "refs":
      if (!options || options.length === 0) {
        return (
          <p className="text-[13px] text-muted-foreground">
            Nothing to link to yet — add some first.
          </p>
        );
      }
      return (
        <div className="max-h-44 space-y-1 overflow-y-auto rounded-md border border-border bg-background p-2">
          {options.map((option) => {
            const on = list.includes(option.id);
            return (
              <label
                key={option.id}
                className="flex cursor-pointer items-start gap-2 rounded px-1.5 py-1 text-[13px] leading-snug transition-colors hover:bg-secondary"
              >
                <input
                  type="checkbox"
                  checked={on}
                  onChange={() =>
                    onChange(on ? list.filter((x) => x !== option.id) : [...list, option.id])
                  }
                  className="focus-ring mt-0.5 h-3.5 w-3.5 rounded border-border accent-primary"
                />
                <span className="min-w-0 flex-1 truncate">{option.label}</span>
              </label>
            );
          })}
        </div>
      );

    default:
      return (
        <input
          id={id}
          type="text"
          value={text}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder}
          className={INPUT}
        />
      );
  }
}

/**
 * Chips you can remove, and one input that commits on Enter, comma or blur.
 *
 * The same behaviour as the tag field on the ideas screen, and the blur commit
 * is the part that matters: a tag typed and then clicked away from has been
 * typed, and dropping it is what every tag field gets wrong. The person finds
 * out much later, when a filter comes up empty.
 */
function Chips({
  values,
  onChange,
  id,
  placeholder,
}: {
  values: string[];
  onChange: (next: string[]) => void;
  id: string;
  placeholder?: string;
}) {
  const [draft, setDraft] = useState("");

  const commit = (raw: string) => {
    const added = raw
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
    setDraft("");
    if (added.length === 0) return;

    const next = [...values];
    for (const entry of added) if (!next.includes(entry)) next.push(entry);
    onChange(next);
  };

  return (
    <div>
      {values.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {values.map((entry) => (
            <span
              key={entry}
              className="inline-flex h-7 items-center gap-1 rounded-full bg-secondary pl-2.5 pr-1 text-[11px] font-semibold text-muted-foreground"
            >
              {entry}
              <button
                type="button"
                onClick={() => onChange(values.filter((x) => x !== entry))}
                aria-label={`Remove ${entry}`}
                className="focus-ring flex h-5 w-5 items-center justify-center rounded-full transition-colors hover:bg-background hover:text-primary"
              >
                <X className="h-3 w-3" aria-hidden />
              </button>
            </span>
          ))}
        </div>
      )}
      <input
        id={id}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === ",") {
            e.preventDefault();
            commit(draft);
          } else if (e.key === "Backspace" && !draft && values.length > 0) {
            onChange(values.slice(0, -1));
          }
        }}
        onBlur={() => commit(draft)}
        placeholder={placeholder ?? "Type, then Enter"}
        className={INPUT}
      />
    </div>
  );
}

/**
 * A list of lines, edited as a textarea.
 *
 * `Interview.followUps` is an ordered list of open questions, and questions
 * are sentences — a chip field would wrap them into unreadable pills and lose
 * the order that makes the list worth keeping. A textarea split on newlines is
 * the shape people already use for a list of things to ask.
 *
 * The split is deferred to blur rather than run on every keystroke, so pressing
 * Enter to start the next question does not immediately reformat what is above
 * it under the cursor.
 */
function Lines({
  values,
  onChange,
  id,
}: {
  values: string[];
  onChange: (next: string[]) => void;
  id: string;
}) {
  const [text, setText] = useState(values.join("\n"));

  return (
    <textarea
      id={id}
      value={text}
      onChange={(e) => setText(e.target.value)}
      onBlur={() => onChange(text.split("\n").map((line) => line.trim()).filter(Boolean))}
      rows={4}
      placeholder="One per line"
      className="focus-ring w-full resize-y rounded-md border border-border bg-background px-3 py-2 text-sm leading-relaxed outline-none transition-colors focus:border-accent"
    />
  );
}

/**
 * An ISO instant, as the value the corresponding input wants.
 *
 * The API returns full ISO strings; `<input type="date">` wants `YYYY-MM-DD`
 * and `datetime-local` wants `YYYY-MM-DDTHH:mm` with no zone. Handing either
 * one a full ISO string makes it render blank — which reads as "this record
 * has no date" and invites somebody to type one over a value that was there
 * all along.
 *
 * A value already in input shape is passed through, so this is safe to call on
 * something the person is midway through typing.
 */
function forInput(value: string, kind: "date" | "datetime"): string {
  if (!value) return "";
  if (kind === "date" && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  if (kind === "datetime" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return value;

  const at = new Date(value);
  if (Number.isNaN(at.getTime())) return "";

  const pad = (n: number) => String(n).padStart(2, "0");
  const day = `${at.getFullYear()}-${pad(at.getMonth() + 1)}-${pad(at.getDate())}`;
  return kind === "date" ? day : `${day}T${pad(at.getHours())}:${pad(at.getMinutes())}`;
}
