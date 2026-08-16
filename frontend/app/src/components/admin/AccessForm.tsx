import { Lock, ShieldAlert } from "lucide-react";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createHash, timingSafeEqual } from "node:crypto";
import { Button } from "@/components/ui/Button";

const COOKIE = "vv_newsroom";
const MAX_AGE = 60 * 60 * 12; // Twelve hours — one working day, not forever.

function digest(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

/**
 * Sign in to the newsroom.
 *
 * A server action rather than a fetch: the passphrase is compared on the
 * server and never reaches client JavaScript, and the form keeps working with
 * JavaScript disabled.
 *
 * The comparison is `timingSafeEqual` on the two hashes. A plain `===` on
 * secrets leaks their length and prefix through how long the mismatch takes to
 * find, which is a small thing that costs nothing to get right.
 */
async function signIn(formData: FormData) {
  "use server";

  const next = String(formData.get("next") ?? "/admin");
  const passphrase = process.env.NEWSROOM_PASSPHRASE;
  const submitted = String(formData.get("passphrase") ?? "");

  if (!passphrase) redirect("/newsroom-access?unconfigured=1");

  const a = Buffer.from(digest(passphrase));
  const b = Buffer.from(digest(submitted));
  const ok = a.length === b.length && timingSafeEqual(a, b);

  if (!ok) {
    redirect(`/newsroom-access?error=1&next=${encodeURIComponent(next)}`);
  }

  (await cookies()).set(COOKIE, digest(passphrase), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE,
  });

  // Only ever to a path on this site — an open redirect on a sign-in form is
  // a phishing primitive.
  redirect(next.startsWith("/admin") ? next : "/admin");
}

export function AccessForm({
  next,
  unconfigured,
  failed,
}: {
  next?: string;
  unconfigured?: boolean;
  failed?: boolean;
}) {
  return (
    <div className="surface w-full max-w-[420px] p-7 sm:p-9">
      <span className="grid h-11 w-11 place-items-center rounded-lg bg-primary text-primary-foreground">
        <Lock className="h-5 w-5" aria-hidden />
      </span>

      <h1 className="font-display display-3 mt-5 font-semibold">Newsroom access</h1>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
        The workspace holds drafts, sources and notes that are not published. It is not part of
        the public site.
      </p>

      {unconfigured ? (
        <div
          role="alert"
          className="mt-6 flex gap-3 rounded-lg border border-dashed border-destructive/40 bg-destructive/5 p-4 text-sm"
        >
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-destructive" aria-hidden />
          <p className="leading-relaxed text-muted-foreground">
            <span className="font-semibold text-foreground">No passphrase is configured.</span>{" "}
            The workspace stays locked until <code className="text-xs">NEWSROOM_PASSPHRASE</code>{" "}
            is set in the environment. A missing secret locks the door rather than opening it.
          </p>
        </div>
      ) : (
        <form action={signIn} className="mt-7">
          <input type="hidden" name="next" value={next ?? "/admin"} />

          <label htmlFor="passphrase" className="rule-label">
            Passphrase
          </label>
          <input
            id="passphrase"
            name="passphrase"
            type="password"
            autoComplete="current-password"
            required
            aria-invalid={failed || undefined}
            aria-describedby={failed ? "passphrase-error" : undefined}
            className="focus-ring mt-2 h-11 w-full rounded-md border border-border bg-background px-3 text-[15px] outline-none transition-colors focus:border-accent"
          />

          {failed && (
            <p id="passphrase-error" role="alert" className="mt-2 text-sm text-destructive">
              That passphrase was not recognised.
            </p>
          )}

          <Button type="submit" className="mt-5 w-full">
            Unlock the workspace
          </Button>
        </form>
      )}

      <p className="mt-7 border-t border-border pt-5 text-[11px] leading-relaxed text-muted-foreground">
        One shared passphrase, not an account system — there is no backend yet to hold users or
        roles. It is replaced with real authentication when the API lands.
      </p>
    </div>
  );
}
