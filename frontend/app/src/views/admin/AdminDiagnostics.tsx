"use client";

import type { ReactNode } from "react";
import { Activity, Check, Database, Minus, Server, X } from "lucide-react";
import { useAsync } from "@/hooks/useAsync";
import { formatRelative } from "@/lib/format";
import { Reveal } from "@/components/motion";
import { Button } from "@/components/ui/Button";
import { ErrorState } from "@/components/ui/States";
import { Skeleton } from "@/components/ui/Skeleton";

/**
 * Diagnostics.
 *
 * ── Who this screen is for, and why it is not the public health check ────
 * The site already has `/health`, and its controller's own comment explains
 * why it stays thin: every field on an unauthenticated endpoint is another
 * free fact about the deployment. This is the same kind of information
 * without that constraint, behind `system:diagnostics` — which the developer
 * account holds and the writer account does not.
 *
 * ── What it is careful never to show ─────────────────────────────────────
 * A value from the environment. Everything under Configuration is a yes/no or
 * a count, decided server-side in `DiagnosticsService`, because this is
 * exactly the screen somebody screenshots into a chat when they are asking
 * for help. A boolean cannot be leaked by being looked at.
 *
 * ── Why the failures are fields rather than errors ───────────────────────
 * A diagnostics screen that shows an error card because the database is down
 * has failed in the one situation it exists for. The API reports an
 * unreachable database as `reachable: false` and still answers, so the panel
 * below renders a red row rather than the page collapsing. The error state
 * here is kept for not reaching the API at all — which is itself the finding,
 * and is said in those words.
 */

interface Diagnostics {
  checkedAt: string;
  process: {
    nodeEnv: string;
    nodeVersion: string;
    uptimeSeconds: number;
    memoryMb: number;
  };
  database: {
    reachable: boolean;
    latencyMs: number | null;
    migrations: {
      applied: number;
      latest: string | null;
      unfinished: number;
      readable: boolean;
    };
  };
  configuration: {
    authMode: string;
    sessionMinutes: number;
    jwtSecretSet: boolean;
    appUrlSet: boolean;
    corsOrigins: number;
    smtpConfigured: boolean;
    directUrlSet: boolean;
  };
}

export default function AdminDiagnostics() {
  const { data, loading, error, reload } = useAsync<Diagnostics>(async () => {
    const response = await fetch("/api/newsroom/diagnostics", { cache: "no-store" });
    const body = (await response.json()) as Diagnostics & { error?: string };
    if (!response.ok) throw new Error(body.error ?? "The report could not be read.");
    return body;
  }, []);

  return (
    <div className="mx-auto max-w-[900px]">
      <Reveal variant="fade-up">
        <p className="rule-label">Workspace</p>
        <h1 className="font-display display-2 mt-2 font-semibold">Diagnostics</h1>
        <p className="mt-3 max-w-[64ch] text-sm leading-relaxed text-muted-foreground">
          What the API is doing right now — the database, the migrations that ran, and which
          pieces of configuration are present. Values are never shown, only whether they are
          set: this is a screen people paste into chat windows.
        </p>
      </Reveal>

      <div className="mt-8 space-y-5">
        {loading && <Skeleton className="h-64 w-full rounded-lg" />}

        {error && (
          <ErrorState
            title="The API did not answer"
            description={`${error.message} That is itself the finding — nothing else on this screen can be read until it does.`}
            onRetry={reload}
          />
        )}

        {data && (
          <>
            <Panel
              icon={<Database className="h-[18px] w-[18px]" aria-hidden />}
              title="Database"
              detail={
                data.database.reachable
                  ? "Reachable, and the migration table read."
                  : "Not reachable. The API is up and Postgres is not."
              }
            >
              <Row
                label="Connection"
                state={data.database.reachable}
                value={
                  data.database.reachable ? `${data.database.latencyMs} ms` : "unreachable"
                }
              />
              <Row
                label="Migrations applied"
                state={data.database.migrations.readable}
                value={
                  data.database.migrations.readable
                    ? String(data.database.migrations.applied)
                    : "table not readable"
                }
              />
              <Row
                label="Latest migration"
                state={data.database.migrations.latest !== null}
                value={data.database.migrations.latest ?? "none"}
              />
              {/* An unfinished migration is the commonest reason a deploy
                  looks healthy and behaves as though a column is missing, so
                  it gets a row of its own rather than a footnote. */}
              <Row
                label="Unfinished migrations"
                state={data.database.migrations.unfinished === 0}
                value={
                  data.database.migrations.unfinished === 0
                    ? "none"
                    : `${data.database.migrations.unfinished} — a deploy died half way`
                }
              />
            </Panel>

            <Panel
              icon={<Server className="h-[18px] w-[18px]" aria-hidden />}
              title="Process"
              detail="The API container itself."
            >
              <Row label="Environment" state={null} value={data.process.nodeEnv} />
              <Row label="Node" state={null} value={data.process.nodeVersion} />
              <Row label="Uptime" state={null} value={humanUptime(data.process.uptimeSeconds)} />
              <Row label="Memory" state={null} value={`${data.process.memoryMb} MB resident`} />
            </Panel>

            <Panel
              icon={<Activity className="h-[18px] w-[18px]" aria-hidden />}
              title="Configuration"
              detail="Set or not set. Never the value."
            >
              <Row
                label="Auth mode"
                state={data.configuration.authMode === "jwt"}
                value={data.configuration.authMode}
              />
              <Row
                label="Session length"
                state={null}
                value={`${data.configuration.sessionMinutes} minutes`}
              />
              <Row label="AUTH_JWT_SECRET" state={data.configuration.jwtSecretSet} />
              <Row label="APP_URL" state={data.configuration.appUrlSet} />
              <Row
                label="CORS origins"
                state={data.configuration.corsOrigins > 0}
                value={
                  data.configuration.corsOrigins > 0
                    ? `${data.configuration.corsOrigins} allowed`
                    : "none — no browser origin may call the API"
                }
              />
              <Row
                label="Email (SMTP)"
                state={data.configuration.smtpConfigured}
                value={
                  data.configuration.smtpConfigured
                    ? "configured"
                    : "not configured — resets and setup links refuse with 503"
                }
              />
              <Row label="DIRECT_URL (migrations)" state={data.configuration.directUrlSet} />
            </Panel>

            <div className="flex items-center justify-between gap-4">
              <p className="text-xs text-muted-foreground">Read {formatRelative(data.checkedAt)}.</p>
              <Button variant="outline" size="sm" onClick={reload}>
                Check again
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function Panel({
  icon,
  title,
  detail,
  children,
}: {
  icon: ReactNode;
  title: string;
  detail: string;
  children: ReactNode;
}) {
  return (
    <Reveal variant="fade-up" className="surface p-5 sm:p-6">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-secondary text-muted-foreground">
          {icon}
        </span>
        <div className="min-w-0">
          <h2 className="font-display text-base font-semibold tracking-tight">{title}</h2>
          <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{detail}</p>
        </div>
      </div>
      <dl className="mt-5 divide-y divide-border">{children}</dl>
    </Reveal>
  );
}

/**
 * One fact.
 *
 * `state` is a tri-state on purpose. True and false get a tick and a cross,
 * because they are things that are right or wrong. Null gets a dash, for the
 * facts that are neither — a Node version is not good or bad, and marking it
 * green would train the eye to stop reading the colours.
 */
function Row({
  label,
  state,
  value,
}: {
  label: string;
  state: boolean | null;
  value?: string;
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-2.5">
      <dt className="text-sm">{label}</dt>
      <dd className="flex min-w-0 items-center gap-2 text-right text-sm text-muted-foreground">
        <span className="min-w-0 break-words">{value ?? (state ? "set" : "not set")}</span>
        {state === true && <Check className="h-4 w-4 shrink-0 text-accent" aria-label="yes" />}
        {state === false && <X className="h-4 w-4 shrink-0 text-destructive" aria-label="no" />}
        {state === null && (
          <Minus className="h-4 w-4 shrink-0 text-muted-foreground/50" aria-hidden />
        )}
      </dd>
    </div>
  );
}

/** Seconds into something a person reads without counting zeros. */
function humanUptime(seconds: number): string {
  if (seconds < 90) return `${seconds}s`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 90) return `${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours} hours`;
  return `${Math.round(hours / 24)} days`;
}
