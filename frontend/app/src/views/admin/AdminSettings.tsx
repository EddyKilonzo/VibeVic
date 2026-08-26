"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import {
  Database,
  Download,
  Lock,
  LogOut,
  Settings as SettingsIcon,
  SlidersHorizontal,
  Trash2,
} from "lucide-react";
import { PROFILE } from "@/data/content";
import { CHANNEL } from "@/data/videos";
import { exportAll, forget, useNewsroom, useNewsroomCounts } from "@/data/newsroom/useNewsroom";
import { listDrafts } from "@/lib/drafts";
import { formatBytes, listMedia } from "@/lib/media";
import { audioEvents, clearAudioAnalytics } from "@/lib/voice/analytics";
import { clearReadingPositions, readingMarkCount } from "@/hooks/useReadingPosition";
import { useBookmarks } from "@/context/BookmarksProvider";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { cn } from "@/lib/utils";
import { notify } from "@/lib/toast";
import { Reveal } from "@/components/motion";
import { Button } from "@/components/ui/Button";
import { signOut } from "@/app/admin/settings/actions";

/**
 * Settings.
 *
 * ── Only real switches ───────────────────────────────────────────────────
 * Every control on this screen is wired to something that already exists.
 * There is no "email notifications", no "team members", no "theme" — the
 * product sends no email, has no second user and ships one theme, and a
 * switch that flips nothing is a lie with a nice animation on it.
 *
 * ── The part that actually matters ───────────────────────────────────────
 * The newsroom's records — ideas, sources, quotes, the lot — are in Postgres
 * now, so clearing this browser no longer destroys them and a phone sees what
 * a laptop saved. Awards moved with them. Drafts are still this device's, which
 * is why the two are counted separately below rather than added into one
 * reassuring figure.
 *
 * Two things follow, and this is the screen where both are handled honestly:
 * everything can be exported, so no copy is hostage to one machine; and the
 * session can be ended, which twelve hours of passphrase cookie previously
 * made impossible.
 */
export default function AdminSettings() {
  return (
    <div className="mx-auto max-w-[900px]">
      <Reveal variant="fade-up">
        <p className="rule-label">Workspace</p>
        <h1 className="font-display display-2 mt-2 font-semibold">Settings</h1>
        <p className="mt-3 max-w-[62ch] text-sm leading-relaxed text-muted-foreground">
          Preferences for this browser, what the workspace is holding on this device, and how
          to take it with you. Every control here changes something real.
        </p>
      </Reveal>

      <div className="mt-8 space-y-5">
        <Preferences />
        <StoredData />
        <Access />
        <SiteFacts />
      </div>
    </div>
  );
}

/* ── Preferences ──────────────────────────────────────────────── */

/**
 * The three preferences the admin already persists.
 *
 * Each reads and writes the exact key its screen uses, through the same hook,
 * so changing one here and the same control there can never disagree —
 * `useLocalStorage` broadcasts within the document as well as across tabs.
 */
function Preferences() {
  const [face, setFace] = useLocalStorage<"display" | "sans">("vv:workspace-face", "display");
  const [collapsed, setCollapsed] = useLocalStorage("vv:admin-sidebar-collapsed", false);
  const [view, setView] = useLocalStorage<"list" | "grid">("vv:admin-stories-view", "list");

  return (
    <Reveal variant="fade-up" className="surface p-5 sm:p-6">
      <Head
        icon={<SlidersHorizontal className="h-[18px] w-[18px]" aria-hidden />}
        title="Preferences"
        detail="Remembered in this browser. They follow you between screens, not between devices."
      />

      <dl className="mt-6 divide-y divide-border">
        <Choice
          label="Compose in"
          detail="The face the editor sets your draft in. Fraunces is what the site publishes; the sans is for comparison. Neither is written onto the story."
          value={face}
          options={[
            { id: "display", label: "Fraunces" },
            { id: "sans", label: "Inter" },
          ]}
          onChange={setFace}
        />
        <Choice
          label="Stories open as"
          detail="List or grid on the stories screen."
          value={view}
          options={[
            { id: "list", label: "List" },
            { id: "grid", label: "Grid" },
          ]}
          onChange={setView}
        />
        <Choice
          label="Sidebar"
          detail="Icons only, or icons with labels. The rail remembers this on its own too."
          value={collapsed ? "collapsed" : "expanded"}
          options={[
            { id: "expanded", label: "Expanded" },
            { id: "collapsed", label: "Icons only" },
          ]}
          onChange={(next) => setCollapsed(next === "collapsed")}
        />
      </dl>
    </Reveal>
  );
}

/* ── Stored data ──────────────────────────────────────────────── */

interface Usage {
  drafts: number;
  media: number;
  mediaBytes: number;
  localBytes: number;
  audioEvents: number;
  readingMarks: number;
}

/**
 * What is on the device, and how to get it off.
 *
 * The figures are counted, not estimated: every store is enumerated and the
 * localStorage total is the actual length of the keys this product owns. The
 * one number that is an estimate is labelled as one, because it comes from
 * the browser's own quota API and that API says so itself.
 */
function StoredData() {
  /**
   * The record total comes from the API as a number, not from counting rows.
   *
   * This screen wants one figure. Loading every collection to reach it would
   * pull every source, quote and interview note across the network so that
   * their lengths could be added up and the material discarded — which is both
   * wasteful and a worse privacy position than asking Postgres to count. The
   * API's total also respects the confidential tier, so it never announces the
   * existence of rows this session is not allowed to see.
   */
  const { total: records, error: countsError } = useNewsroomCounts();

  /**
   * The export still needs the records themselves, so it names them.
   *
   * This is the one place that genuinely wants the material rather than a
   * count, and it is honest about the cost: eleven requests, made because
   * somebody asked for a backup.
   */
  const { newsroom } = useNewsroom(
    "ideas",
    "pitches",
    "sources",
    "quotes",
    "interviews",
    "entities",
    "evidence",
    "timeline",
    "notes",
    "deadlines",
    "collections",
  );
  const { count: bookmarks, clear: clearBookmarks } = useBookmarks();
  const [usage, setUsage] = useState<Usage | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);

  const measure = useCallback(async () => {
    const media = await listMedia();
    let localBytes = 0;
    try {
      for (let i = 0; i < window.localStorage.length; i += 1) {
        const key = window.localStorage.key(i);
        if (!key?.startsWith("vv:")) continue;
        localBytes += key.length + (window.localStorage.getItem(key)?.length ?? 0);
      }
    } catch {
      /* Storage refused. The rest of the summary is still worth showing. */
    }

    setUsage({
      // Counted here rather than during render: every one of these reads
      // browser storage, and a prerendered route that reads it on the first
      // client pass disagrees with the HTML React is hydrating against.
      drafts: listDrafts().length,
      media: media.length,
      mediaBytes: media.reduce((n, item) => n + (item.size ?? 0), 0),
      localBytes,
      audioEvents: audioEvents().length,
      readingMarks: readingMarkCount(),
    });
  }, []);

  // Ref callback rather than an effect: this route is prerendered, and the
  // measurement touches both localStorage and IndexedDB, neither of which the
  // server render can answer for.
  const load = useCallback(
    (node: HTMLDivElement | null) => {
      if (node) void measure();
    },
    [measure],
  );

  /**
   * One file, everything textual in it.
   *
   * Media is deliberately left out: uploads are blobs in IndexedDB, and
   * base64-ing a phone camera's output into a JSON file would produce
   * something too large to open in order to preserve something the file
   * cannot faithfully hold. The caption says so rather than letting the
   * journalist discover it when they restore.
   */
  const download = () => {
    const payload = {
      exportedAt: new Date().toISOString(),
      newsroom: JSON.parse(exportAll(newsroom)) as unknown,
      drafts: listDrafts(),
      // Awards are not read here any more. They are newsroom records now, and
      // the export takes those from the snapshot the screen is already holding
      // rather than making a request — an export that quietly fetched would be
      // a much heavier operation than the button appears to offer, and one that
      // could fail halfway through writing a backup.
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `newsroom-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    // Revoked immediately: the download has already been handed to the
    // browser, and an un-revoked object URL pins the blob for the life of the
    // document.
    URL.revokeObjectURL(url);
    notify.success("Export downloaded", "Drafts and the newsroom records.");
  };

  /** Two presses, not a modal. The second press is the confirmation. */
  const confirm = (id: string, run: () => void, done: string) => {
    if (confirming !== id) {
      setConfirming(id);
      return;
    }
    run();
    setConfirming(null);
    void measure();
    notify.success(done);
  };

  return (
    <Reveal variant="fade-up" delay={60} className="surface p-5 sm:p-6">
      <div ref={load}>
        <Head
          icon={<Database className="h-[18px] w-[18px]" aria-hidden />}
          title="On this device"
          detail="Newsroom records live in Postgres and are counted there. Everything else on this list is held by this browser, and is counted from the stores themselves."
        />

        <dl className="mt-6 grid gap-4 sm:grid-cols-2">
          <Figure
            label="Drafts"
            value={usage ? String(usage.drafts) : "—"}
            detail="Saved as you write"
          />
          <Figure
            label="Newsroom records"
            value={countsError ? "—" : (records !== null ? String(records) : "…")}
            detail={countsError ? "The newsroom could not be reached" : "Ideas, notes and everything private"}
          />
          <Figure
            label="Media items"
            value={usage ? String(usage.media) : "—"}
            detail={usage ? `${formatBytes(usage.mediaBytes)} of uploads` : "Reading the library"}
          />
          <Figure
            label="Text stored"
            value={usage ? formatBytes(usage.localBytes) : "—"}
            detail="Drafts, ideas and preferences"
          />
          <Figure
            label="Playback events"
            value={usage ? String(usage.audioEvents) : "—"}
            detail="Recorded by the voice player"
          />
          <Figure
            label="Reading marks"
            value={usage ? String(usage.readingMarks) : "—"}
            detail={`${bookmarks} saved ${bookmarks === 1 ? "story" : "stories"} alongside them`}
          />
        </dl>

        <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-border pt-5">
          <Button onClick={download} size="sm">
            <Download className="icon-pop h-4 w-4" aria-hidden />
            Export everything
          </Button>
          <p className="min-w-0 flex-1 text-[11px] leading-relaxed text-muted-foreground">
            One JSON file: drafts, ideas, beats and awards. Pictures and clips are not in it —
            they are files in this browser&rsquo;s database, and a JSON file is the wrong
            container for them.
          </p>
        </div>

        {/* Destructive, and behind a second press rather than a dialog — a
            modal here would block the page, and the thing being cleared is
            small enough that a confirming label is proportionate. */}
        <div className="mt-5 space-y-2 rounded-lg border border-dashed border-destructive/40 p-4">
          <p className="text-sm font-semibold">Clearing</p>
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            These cannot be undone, and drafts are not among them — a draft is deleted from the
            drafts screen, one at a time, with an undo.
          </p>

          <div className="mt-3 flex flex-wrap gap-2">
            <Danger
              active={confirming === "audio"}
              onClick={() =>
                confirm("audio", clearAudioAnalytics, "Recorded playback cleared")
              }
            >
              Clear recorded playback
            </Danger>
            <Danger
              active={confirming === "reading"}
              onClick={() =>
                confirm("reading", clearReadingPositions, "Reading marks cleared")
              }
            >
              Clear reading marks
            </Danger>
            <Danger
              active={confirming === "bookmarks"}
              onClick={() => confirm("bookmarks", clearBookmarks, "Saved stories cleared")}
            >
              Clear saved stories
            </Danger>
          </div>
        </div>
      </div>
    </Reveal>
  );
}

/* ── Access ───────────────────────────────────────────────────── */

function Access() {
  return (
    <Reveal variant="fade-up" delay={90} className="surface p-5 sm:p-6">
      <Head
        icon={<Lock className="h-[18px] w-[18px]" aria-hidden />}
        title="Access"
        detail="One shared passphrase, checked at the edge before any admin route is served."
      />

      <ul className="mt-6 space-y-4 text-sm">
        <Point
          title="It is not an account system"
          detail="No users, no roles, no sessions beyond one signed cookie — there is no backend to hold them. For a one-person newsroom that is the right size of lock, and it is replaced rather than extended when the API lands."
        />
        <Point
          title="The passphrase is set in the environment"
          detail="NEWSROOM_PASSPHRASE, read on the server. Changing it signs every open session out at the next request, because the cookie holds a hash of the old one."
        />
        <Point
          title="A missing passphrase locks the door"
          detail="With nothing configured the workspace stays shut rather than opening. A misconfigured lock reads as closed."
        />
        <Point
          title="The session lasts twelve hours"
          detail="One working day, not forever. Sign out to end it now — on a borrowed machine that is the difference between having left and appearing to have left."
        />
      </ul>

      {/* `forget()` before the action, because signing out is a client
          navigation and module state survives one. The cookie would be gone
          and the records would still be in memory, so the next person at the
          machine would find the workspace on screen — which is the failure
          this button was added to prevent. The server action still does the
          part that matters and still works without JavaScript. */}
      <form
        action={signOut}
        onSubmit={() => forget()}
        className="mt-6 border-t border-border pt-5"
      >
        <Button type="submit" variant="outline" size="sm">
          <LogOut className="h-4 w-4" aria-hidden />
          Sign out of the newsroom
        </Button>
      </form>
    </Reveal>
  );
}

/* ── The site's own facts ─────────────────────────────────────── */

/**
 * Read-only, and honest about why.
 *
 * These strings are compiled into the build and read by the public pages, the
 * feed, the sitemap and the structured data. Editing them from a browser
 * store would mean the admin and the served site disagreed about the
 * journalist's own name until someone redeployed — so the screen shows them
 * and says where they live instead of offering a field that would lie.
 */
function SiteFacts() {
  return (
    <Reveal variant="fade-up" delay={120} className="surface p-5 sm:p-6">
      <Head
        icon={<SettingsIcon className="h-[18px] w-[18px]" aria-hidden />}
        title="The site"
        detail="Compiled into the build, so they are shown here rather than edited here."
      />

      <dl className="mt-6 divide-y divide-border">
        <Row term="Name" value={PROFILE.name} />
        <Row term="Role" value={PROFILE.role} />
        <Row term="Based" value={PROFILE.base} />
        <Row term="Email" value={PROFILE.email} />
        <Row term="Channel" value={`${CHANNEL.handle} · ${CHANNEL.videoCount} reports`} />
      </dl>

      <p className="mt-5 border-t border-border pt-4 text-[11px] leading-relaxed text-muted-foreground">
        These live in <code className="text-primary">src/data/content.ts</code>. The public
        pages, the RSS feed, the sitemap and the structured data all read them from there, so
        a correction made once lands everywhere at the next build.{" "}
        <Link href="/" className="focus-ring underline-grow font-semibold text-primary">
          View the site
        </Link>
      </p>
    </Reveal>
  );
}

/* ── Small parts ──────────────────────────────────────────────── */

function Head({
  icon,
  title,
  detail,
}: {
  icon: React.ReactNode;
  title: string;
  detail: string;
}) {
  return (
    <div>
      <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-secondary text-primary">
        {icon}
      </span>
      <h2 className="font-display mt-4 text-lg font-semibold tracking-tight">{title}</h2>
      <p className="mt-1.5 max-w-[58ch] text-sm leading-relaxed text-muted-foreground">
        {detail}
      </p>
    </div>
  );
}

function Choice<T extends string>({
  label,
  detail,
  value,
  options,
  onChange,
}: {
  label: string;
  detail: string;
  value: T;
  options: { id: T; label: string }[];
  onChange: (next: T) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-3 py-4 first:pt-0 last:pb-0">
      <div className="min-w-0 flex-1">
        <dt className="text-sm font-semibold">{label}</dt>
        <dd className="mt-1 max-w-[52ch] text-sm leading-relaxed text-muted-foreground">
          {detail}
        </dd>
      </div>

      <div role="group" aria-label={label} className="surface-compact flex shrink-0 items-center gap-1 p-1">
        {options.map((option) => (
          <button
            key={option.id}
            type="button"
            onClick={() => onChange(option.id)}
            aria-pressed={value === option.id}
            className={cn(
              "focus-ring tap inline-flex h-8 items-center rounded-md px-3 text-xs font-semibold transition-colors duration-normal",
              value === option.id
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-primary",
            )}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function Figure({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="rounded-lg bg-secondary/50 p-4">
      <dt className="rule-label">{label}</dt>
      <dd className="font-display mt-1.5 text-2xl font-semibold tabular-nums text-primary">
        {value}
      </dd>
      <dd className="mt-1 text-[11px] leading-relaxed text-muted-foreground">{detail}</dd>
    </div>
  );
}

function Point({ title, detail }: { title: string; detail: string }) {
  return (
    <li className="border-t border-border pt-4 first:border-0 first:pt-0">
      <p className="font-semibold">{title}</p>
      <p className="mt-1 leading-relaxed text-muted-foreground">{detail}</p>
    </li>
  );
}

function Row({ term, value }: { term: string; value: string }) {
  return (
    <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1 py-3 first:pt-0 last:pb-0">
      <dt className="rule-label w-28 shrink-0">{term}</dt>
      <dd className="min-w-0 flex-1 break-words text-sm">{value}</dd>
    </div>
  );
}

function Danger({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "focus-ring tap inline-flex h-9 items-center gap-1.5 rounded-md px-3 text-xs font-semibold transition-colors duration-normal",
        active
          ? "bg-destructive text-destructive-foreground"
          : "border border-border text-muted-foreground hover:border-destructive hover:text-destructive",
      )}
    >
      <Trash2 className="h-3.5 w-3.5" aria-hidden />
      {active ? "Press again to confirm" : children}
    </button>
  );
}
