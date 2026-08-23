import { Lock, ShieldAlert } from "lucide-react";
import { redirect } from "next/navigation";
import { cookies, headers } from "next/headers";
import { createHash, timingSafeEqual } from "node:crypto";
import { SESSION_SECONDS, issueToken } from "@/lib/newsroom-token";
import { Button } from "@/components/ui/Button";
import { Reveal } from "@/components/motion";

const COOKIE = "vv_newsroom";

function digest(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

/**
 * Failed attempts, per address, in this instance's memory.
 *
 * ── What this is and is not ──────────────────────────────────────────────
 * It is a speed bump. Serverless instances come and go and do not share
 * memory, so a determined attacker gets a fresh allowance whenever a new
 * instance answers — this cannot be an access control and is not written as
 * one. What it does buy is that the obvious attack, a script hammering one
 * instance with a wordlist, stops being free.
 *
 * The real answer is a rate-limiting rule at the edge (Vercel WAF) or a
 * shared store. Both are worth having; neither is a reason to leave the door
 * ungated in the meantime.
 */
const attempts = new Map<string, { count: number; first: number }>();
const WINDOW_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 8;

function tooManyAttempts(key: string): boolean {
  const now = Date.now();
  const seen = attempts.get(key);
  if (!seen || now - seen.first > WINDOW_MS) {
    attempts.set(key, { count: 1, first: now });
    return false;
  }
  seen.count += 1;
  return seen.count > MAX_ATTEMPTS;
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

  // Keyed on the forwarded address. Spoofable, and it does not matter: this
  // slows a script down, it does not decide who gets in.
  const caller = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (tooManyAttempts(caller)) {
    redirect(`/newsroom-access?error=1&next=${encodeURIComponent(next)}`);
  }

  const a = Buffer.from(digest(passphrase));
  const b = Buffer.from(digest(submitted));
  const ok = a.length === b.length && timingSafeEqual(a, b);

  if (!ok) {
    // A fixed pause on failure. Cheap for a person typing a passphrase once,
    // expensive for anything trying a list of them.
    await new Promise((resolve) => setTimeout(resolve, 400));
    redirect(`/newsroom-access?error=1&next=${encodeURIComponent(next)}`);
  }

  attempts.delete(caller);

  /*
   * A signed, expiring session — not the passphrase's hash.
   *
   * The cookie used to be a deterministic function of the secret: the same
   * value on every device, valid until the passphrase itself changed, and
   * expiring only because the browser had been asked nicely to forget it.
   * The server states the expiry inside the token now and signs it, so a
   * cookie that outlives its window is refused rather than honoured.
   */
  const token = await issueToken();
  if (!token) redirect("/newsroom-access?unconfigured=1");

  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_SECONDS,
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
    /* The card arrives, then its contents in order — lock, heading, sentence,
       field. A door is the one screen where a beat of ceremony is the point:
       it says the workspace is a separate place rather than another tab of
       the same site. The whole sequence is under 400ms, and `Reveal` sits it
       out entirely under `prefers-reduced-motion`. */
    <Reveal
      variant="fade-scale"
      className="surface w-full max-w-[420px] p-7 sm:p-9"
    >
      <Reveal variant="fade-up" delay={90} distance="sm">
        <span className="grid h-11 w-11 place-items-center rounded-lg bg-primary text-primary-foreground">
          <Lock className="h-5 w-5" aria-hidden />
        </span>
      </Reveal>

      <Reveal variant="mask" delay={150}>
        <h1 className="font-display display-3 mt-5 font-semibold">Newsroom access</h1>
      </Reveal>

      <Reveal variant="fade-up" delay={230} distance="sm">
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          The workspace holds drafts, sources and notes that are not published. It is not part of
          the public site.
        </p>
      </Reveal>

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

      <Reveal variant="fade" delay={380}>
        <p className="mt-7 border-t border-border pt-5 text-[11px] leading-relaxed text-muted-foreground">
          One shared passphrase, not an account system — there is no backend yet to hold users or
          roles. It is replaced with real authentication when the API lands.
        </p>
      </Reveal>
    </Reveal>
  );
}
