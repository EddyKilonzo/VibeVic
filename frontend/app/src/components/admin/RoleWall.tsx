import Link from "next/link";
import { Lock } from "lucide-react";
import { CAPABILITIES } from "@/lib/role-capabilities";
import type { NewsroomRole } from "@/lib/newsroom-session";
import type { Scope } from "@/lib/newsroom-scopes";
import { newsroomPath } from "@/lib/newsroom-path";

/**
 * What a screen shows the role it does not belong to.
 *
 * ── Why this rather than a 404 ───────────────────────────────────────────
 * A 404 would be right if the existence of the screen were the secret. It is
 * not: both accounts belong to the same two-person newsroom, the split is
 * printed in the account menu, and pretending `/accounts` does not exist to
 * the person who read about it a minute ago is a lie that makes the product
 * feel broken rather than governed.
 *
 * So it says the true thing instead, in the same voice the account menu uses
 * for a withheld capability: here is the rule, here is why it exists, here is
 * where you were going. `AccountMenu` already argues this — naming a boundary
 * turns a confusing absence into a stated one — and a whole screen that a
 * role cannot open is the largest possible version of that absence.
 *
 * ── Why it is not the control either ─────────────────────────────────────
 * It is rendered *instead of* the screen, server-side, before any of that
 * screen's code is reached — so the data it would have fetched is never
 * requested. And the API behind it refuses the same role on its own, on the
 * caller's own token. This is the third of three locks, and the only one a
 * person is meant to read.
 */
export function RoleWall({
  role,
  scope,
  what,
}: {
  role: NewsroomRole;
  /** The scope this screen needs. Its wording comes from the capability list. */
  scope: Scope;
  /** The screen, named as the person would name it. "the ideas notebook". */
  what: string;
}) {
  const capability = CAPABILITIES.find((entry) => entry.scope === scope);
  const held = role === "WRITER" ? "a writer" : "a developer";

  return (
    <div className="mx-auto max-w-[640px] pt-10">
      <div className="surface p-6 sm:p-8">
        <span
          aria-hidden
          className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-secondary text-muted-foreground"
        >
          <Lock className="h-[18px] w-[18px]" />
        </span>

        <h1 className="font-display mt-4 text-xl font-semibold tracking-tight">
          {what} is not this account&rsquo;s screen
        </h1>

        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          You are signed in as {held}, and {what} belongs to the other role. This is the
          split working, not a fault — nothing here is broken and nothing needs reporting.
        </p>

        {capability && (
          <p className="mt-4 border-l-2 border-border pl-4 text-sm leading-relaxed text-muted-foreground">
            <span className="font-medium text-foreground">{capability.label}.</span>{" "}
            {capability.detail}
          </p>
        )}

        <p className="mt-5 text-sm">
          <Link
            href={newsroomPath()}
            className="focus-ring underline-grow font-medium text-primary"
          >
            Back to the dashboard
          </Link>
        </p>
      </div>
    </div>
  );
}
