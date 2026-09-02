"use client";

import { useState } from "react";
import Link from "next/link";
import { NavLink } from "@/components/nav/NavLink";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  Activity,
  BarChart3,
  FilePen,
  FileText,
  Image,
  LayoutDashboard,
  Lightbulb,
  Menu,
  PanelLeftClose,
  Settings,
  Tags,
  Trophy,
  UserCog,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { stagger, transitions } from "@/lib/motion";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { PageTransition } from "@/components/motion";
import { MobileAdminBar } from "@/components/admin/MobileAdminBar";
import { ConnectionState } from "@/components/admin/ConnectionState";
import { AccountMenu, type SessionSummary } from "@/components/admin/AccountMenu";
import { SessionProvider } from "@/components/admin/SessionContext";
import { newsroomPath, newsroomSuffix } from "@/lib/newsroom-path";
import { can, type Scope } from "@/lib/newsroom-scopes";

/**
 * The sections, all of them built — and no longer the same list for everybody.
 *
 * Each row used to be able to carry `soon`, and five of them did: the
 * sections were routed but landed on the same "isn't built yet" card, so the
 * dot was there to stop the journalist discovering that five times over. Each
 * of those five is a real screen now — ideas, analytics, readers, awards and
 * settings — so the flag has gone rather than lingering as a mark nothing
 * sets. A nav that can describe a state the product no longer has is a nav
 * that will eventually describe it wrongly.
 *
 * ── Why rows carry a scope ───────────────────────────────────────────────
 * Three of these are not shared. Ideas is the writer's notebook; diagnostics
 * and accounts are the dev's side of the machine. A rail that listed all
 * twelve to both accounts would be offering each of them two or three links
 * that answer 403 — which is a worse way to learn a boundary than never being
 * shown it, because it looks like a bug rather than a rule. The account menu
 * is where the boundary is *stated*; this is where it is simply not in the
 * way.
 *
 * ── And why hiding a row is not the control ──────────────────────────────
 * It is not one at all. Typing the URL still reaches the route, which is why
 * each of those three pages checks the session's role server-side before it
 * renders, and why the API re-checks the scope on every call behind them.
 * This filter is about what a rail should offer, not about what a person can
 * reach — the same argument the middleware's own header makes about hiding
 * the admin link.
 *
 * A row with no `scope` is shared by both roles, which is most of them.
 */
const NAV: {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  end?: boolean;
  scope?: Scope;
}[] = [
  { href: newsroomPath(), label: "Dashboard", icon: LayoutDashboard, end: true },
  { href: newsroomPath("/stories"), label: "Stories", icon: FileText },
  { href: newsroomPath("/drafts"), label: "Drafts", icon: FilePen },
  { href: newsroomPath("/ideas"), label: "Ideas", icon: Lightbulb, scope: "newsroom:ideas" },
  { href: newsroomPath("/media"), label: "Media", icon: Image },
  { href: newsroomPath("/analytics"), label: "Analytics", icon: BarChart3 },
  { href: newsroomPath("/readers"), label: "Readers", icon: Users },
  { href: newsroomPath("/genres"), label: "Beats", icon: Tags },
  { href: newsroomPath("/awards"), label: "Awards", icon: Trophy },
  {
    href: newsroomPath("/diagnostics"),
    label: "Diagnostics",
    icon: Activity,
    scope: "system:diagnostics",
  },
  {
    href: newsroomPath("/accounts"),
    label: "Accounts",
    icon: UserCog,
    scope: "system:accounts",
  },
  { href: newsroomPath("/settings"), label: "Settings", icon: Settings },
];

/**
 * Admin shell.
 *
 * The sidebar collapses to icons and remembers that choice. Its width is
 * animated by Motion rather than by a CSS width transition so the content
 * column reflows in the same frame — a width transition on a flex parent is
 * exactly the kind of layout animation the performance rules warn about, and
 * this is the one place it is worth it, on a single element, at 320ms.
 */
export default function AdminLayout({
  children,
  session,
}: {
  children: React.ReactNode;
  /** Verified in the route layout above; see the note there on what is passed. */
  session: SessionSummary;
}) {
  const [collapsed, setCollapsed] = useLocalStorage("vv:admin-sidebar-collapsed", false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const reduced = useReducedMotion();
  // Suffixes, for the reason given in MobileAdminBar.
  const pathname = newsroomSuffix(usePathname() ?? newsroomPath());

  /*
   * The rows this account is offered. Derived rather than stored, because the
   * role comes from a session that can end mid-visit and a memoised copy of
   * it would be the thing that went stale.
   *
   * The header title below still reads from the whole of `NAV`. If somebody
   * types a path their role cannot use, the page itself sends them away —
   * but for the frame it takes to do that, "Ideas" is a better thing to have
   * in the header than "Admin".
   */
  const sections = NAV.filter((item) => !item.scope || can(session.role, item.scope));

  return (
    /* The provider wraps the whole shell rather than only `main`, so the rail
       and the header are asking the same question from the same answer. */
    <SessionProvider session={session}>
    <div className="flex min-h-screen bg-muted/40">
      {/* Desktop sidebar.

          `honeycomb-invert` flips the lattice ink to white: every other weight
          is navy at a low alpha, which is right on paper and invisible against
          the sidebar's navy. The admin was the one surface in the product
          carrying no trace of the house motif. */}
      <motion.aside
        animate={{ width: collapsed ? 72 : 248 }}
        initial={false}
        transition={reduced ? { duration: 0 } : transitions.normal}
        // `shadow-deep` and a z-index, so the rail sits above the workspace
        // rather than beside it. Without the stacking context the shadow is
        // painted and then covered by the next sibling, which is the usual
        // reason a sidebar shadow "does not work".
        className="honeycomb honeycomb-invert sticky top-0 z-20 hidden h-screen shrink-0 flex-col overflow-hidden bg-sidebar text-sidebar-foreground shadow-deep lg:flex"
      >
        <div className="flex h-16 items-center gap-3 px-5">
          <Link
            href="/"
            aria-label="View the public site"
            className="focus-ring group relative inline-flex shrink-0 items-center justify-center"
          >
            {/* The house hex, at mark scale. Same clip-path as the stat
                cards, so the admin's one piece of identity is the shape the
                rest of the product already uses. */}
            <span
              aria-hidden
              className="absolute -inset-x-1.5 -inset-y-1 bg-white/10 transition-colors duration-normal group-hover:bg-white/20"
              style={{
                clipPath: "polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)",
              }}
            />
            <span className="font-display relative text-base font-semibold text-white">VK</span>
          </Link>
          <AnimatePresence initial={false}>
            {!collapsed && (
              <motion.span
                initial={reduced ? { opacity: 0 } : { opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0 }}
                transition={transitions.fast}
                className="truncate text-[11px] font-semibold uppercase tracking-[0.18em] text-sidebar-foreground/70"
              >
                Newsroom
              </motion.span>
            )}
          </AnimatePresence>
        </div>

        <nav aria-label="Admin" className="flex-1 overflow-y-auto px-3 py-2">
          <ul className="space-y-0.5">
            {sections.map((item) => (
              <li key={item.href}>
                <SidebarLink item={item} collapsed={collapsed} surface="rail" />
              </li>
            ))}
          </ul>
        </nav>

        <div className="border-t border-sidebar-border/50 p-3">
          <button
            type="button"
            onClick={() => setCollapsed((v) => !v)}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className="focus-ring flex h-10 w-full items-center gap-3 rounded-lg px-3 text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent hover:text-white"
          >
            <PanelLeftClose
              className={cn(
                "h-4 w-4 shrink-0 transition-transform duration-normal",
                collapsed && "rotate-180",
              )}
              aria-hidden
            />
            {!collapsed && <span className="truncate text-sm">Collapse</span>}
          </button>
        </div>
      </motion.aside>

      {/* Mobile drawer */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              className="fixed inset-0 z-40 bg-brand-ink-deep/40 lg:hidden"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileOpen(false)}
            />
            <motion.aside
              className="honeycomb honeycomb-invert fixed inset-y-0 left-0 z-50 w-[260px] overflow-hidden bg-sidebar p-3 text-sidebar-foreground shadow-deep lg:hidden"
              initial={reduced ? { opacity: 0 } : { x: "-100%" }}
              animate={reduced ? { opacity: 1 } : { x: 0 }}
              exit={reduced ? { opacity: 0 } : { x: "-100%" }}
              transition={transitions.sheet}
            >
              <nav aria-label="Admin" className="mt-4">
                <ul className="space-y-0.5">
                  {sections.map((item, i) => (
                    <motion.li
                      key={item.href}
                      initial={reduced ? false : { opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ ...transitions.normal, delay: i * stagger.tight }}
                    >
                              <SidebarLink
                        item={item}
                        collapsed={false}
                        surface="drawer"
                        onClick={() => setMobileOpen(false)}
                      />
                    </motion.li>
                  ))}
                </ul>
              </nav>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Title left, status and escape hatch right. It used to run
            hamburger → status → title → link with `ml-auto` on two of the
            four and an `order-last` on one of them, which put the status
            badge and the section title on either side of the same gap
            depending on the breakpoint. One right-hand group instead: the
            order is now the same at every width. */}
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border bg-background/85 px-5 shadow-raised backdrop-blur-xl sm:gap-4">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            aria-label="Open admin menu"
            className="focus-ring tap-square group -ml-2 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg transition-colors hover:bg-secondary lg:hidden"
          >
            <Menu className="icon-pop h-[18px] w-[18px]" aria-hidden />
          </button>

          <p className="font-display min-w-0 flex-1 truncate text-lg font-semibold tracking-tight">
            {NAV.find((n) =>
              n.end ? pathname === newsroomSuffix(n.href) : pathname.startsWith(newsroomSuffix(n.href)),
            )?.label ??
              "Admin"}
          </p>

          <div className="flex shrink-0 items-center gap-4">
            {/* Off on phones. Its longest label — "Offline — saved on this
                device" — is wider than the section title sitting next to it
                at 360px, and it would win the truncation fight. The
                workspace renders its own copy where the state actually
                matters, which is next to the thing being saved. */}
            <ConnectionState className="hidden sm:inline-flex" />
            <Link
              href="/"
              className="focus-ring underline-grow tap hidden items-center text-sm text-muted-foreground transition-colors hover:text-primary sm:inline-flex"
            >
              View site
            </Link>
            {/* Last in the row, which is where a person looks for it, and the
                one control here that stays at every width — on a phone the
                escape hatch to the public site drops away before the answer
                to "whose session is this". */}
            <AccountMenu session={session} />
          </div>
        </header>

        {/* Bottom padding clears the mobile bar so the last control on a
            page is never sitting underneath it.

            The lattice at base weight, not `-strong`: the panels sitting on
            this ground are white cards that carry the reading, and a ground
            that competes with them is a ground that has stopped being one. */}
        <main className="honeycomb min-w-0 flex-1 p-5 pb-28 sm:p-8 lg:pb-8">
          <PageTransition>{children}</PageTransition>
        </main>
      </div>

      <MobileAdminBar />
    </div>
    </SessionProvider>
  );
}

/**
 * `surface` keeps the two navigations' shared-layout animations apart.
 *
 * The rail and the drawer render the same links, and the rail stays
 * mounted at `display: none` on a phone. With one `layoutId` across both,
 * Motion pairs the drawer's active pill with a hidden element that measures
 * zero, and the pill animates out of the corner of the screen on open.
 */
function SidebarLink({
  item,
  collapsed,
  surface,
  onClick,
}: {
  item: (typeof NAV)[number];
  collapsed: boolean;
  surface: "rail" | "drawer";
  onClick?: () => void;
}) {
  const Icon = item.icon;
  const reduced = useReducedMotion();

  return (
    <NavLink
      href={item.href}
      end={item.end}
      onClick={onClick}
      title={collapsed ? item.label : undefined}
      className={({ isActive }) =>
        cn(
          "focus-ring group relative flex h-10 items-center gap-3 rounded-lg px-3 text-sm transition-colors duration-normal",
          isActive
            ? "font-semibold text-white"
            : "text-sidebar-foreground/75 hover:bg-sidebar-accent hover:text-white",
        )
      }
    >
      {({ isActive }) => (
        <>
          {isActive && (
            <motion.span
              layoutId={reduced ? undefined : `admin-nav-active-${surface}`}
              className="absolute inset-0 rounded-lg bg-sidebar-accent"
              transition={transitions.normal}
            />
          )}
          {/* A lit edge on the active row. The filled pill alone is a change
              of shade against a navy sidebar; the bar is the part that
              survives a dim screen, and it does not rely on colour. */}
          {isActive && (
            <motion.span
              layoutId={reduced ? undefined : `admin-nav-edge-${surface}`}
              className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-full bg-white"
              transition={transitions.normal}
            />
          )}
          <Icon className="icon-pop relative h-4 w-4 shrink-0" aria-hidden />
          {!collapsed && (
            <span className="relative min-w-0 flex-1 truncate">{item.label}</span>
          )}
        </>
      )}
    </NavLink>
  );
}
