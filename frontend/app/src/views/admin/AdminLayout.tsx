"use client";

import { useState } from "react";
import Link from "next/link";
import { NavLink } from "@/components/nav/NavLink";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  BarChart3,
  FileText,
  Image,
  LayoutDashboard,
  Lightbulb,
  Menu,
  PanelLeftClose,
  Settings,
  Tags,
  Trophy,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { stagger, transitions } from "@/lib/motion";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { PageTransition } from "@/components/motion";
import { MobileAdminBar } from "@/components/admin/MobileAdminBar";
import { ConnectionState } from "@/components/admin/ConnectionState";

/**
 * `soon` marks a section that is routed but has no screen yet.
 *
 * Seven of these nine are placeholders, and until now nothing in the sidebar
 * said so — they looked exactly like the two that work, so the only way to
 * find out was to click each one and read the same "isn't built yet" card
 * seven times. Marking them costs a dot and turns a maze into a map.
 *
 * They stay in the nav rather than being hidden. A section that vanishes is
 * one nobody can plan around; a section marked "soon" is a roadmap the person
 * using the product can actually see.
 */
const NAV = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard, end: true },
  { href: "/admin/stories", label: "Stories", icon: FileText },
  { href: "/admin/ideas", label: "Ideas", icon: Lightbulb, soon: true },
  { href: "/admin/media", label: "Media", icon: Image, soon: true },
  { href: "/admin/analytics", label: "Analytics", icon: BarChart3, soon: true },
  { href: "/admin/readers", label: "Readers", icon: Users, soon: true },
  { href: "/admin/genres", label: "Genres & tags", icon: Tags, soon: true },
  { href: "/admin/awards", label: "Awards", icon: Trophy, soon: true },
  { href: "/admin/settings", label: "Settings", icon: Settings, soon: true },
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
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useLocalStorage("vv:admin-sidebar-collapsed", false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const reduced = useReducedMotion();
  const pathname = usePathname() ?? "/admin";

  return (
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
        className="honeycomb honeycomb-invert sticky top-0 hidden h-screen shrink-0 flex-col overflow-hidden bg-sidebar text-sidebar-foreground lg:flex"
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
            {NAV.map((item) => (
              <li key={item.href}>
                <SidebarLink item={item} collapsed={collapsed} scope="rail" />
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
              className="honeycomb honeycomb-invert fixed inset-y-0 left-0 z-50 w-[260px] overflow-hidden bg-sidebar p-3 text-sidebar-foreground lg:hidden"
              initial={reduced ? { opacity: 0 } : { x: "-100%" }}
              animate={reduced ? { opacity: 1 } : { x: 0 }}
              exit={reduced ? { opacity: 0 } : { x: "-100%" }}
              transition={transitions.sheet}
            >
              <nav aria-label="Admin" className="mt-4">
                <ul className="space-y-0.5">
                  {NAV.map((item, i) => (
                    <motion.li
                      key={item.href}
                      initial={reduced ? false : { opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ ...transitions.normal, delay: i * stagger.tight }}
                    >
                              <SidebarLink
                        item={item}
                        collapsed={false}
                        scope="drawer"
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
            {NAV.find((n) => (n.end ? pathname === n.href : pathname.startsWith(n.href)))?.label ??
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
              className="focus-ring underline-grow tap inline-flex items-center text-sm text-muted-foreground transition-colors hover:text-primary"
            >
              View site
            </Link>
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
  );
}

/**
 * `scope` keeps the two navigations' shared-layout animations apart.
 *
 * The rail and the drawer render the same nine links, and the rail stays
 * mounted at `display: none` on a phone. With one `layoutId` across both,
 * Motion pairs the drawer's active pill with a hidden element that measures
 * zero, and the pill animates out of the corner of the screen on open.
 */
function SidebarLink({
  item,
  collapsed,
  scope,
  onClick,
}: {
  item: (typeof NAV)[number];
  collapsed: boolean;
  scope: "rail" | "drawer";
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
              layoutId={reduced ? undefined : `admin-nav-active-${scope}`}
              className="absolute inset-0 rounded-lg bg-sidebar-accent"
              transition={transitions.normal}
            />
          )}
          {/* A lit edge on the active row. The filled pill alone is a change
              of shade against a navy sidebar; the bar is the part that
              survives a dim screen, and it does not rely on colour. */}
          {isActive && (
            <motion.span
              layoutId={reduced ? undefined : `admin-nav-edge-${scope}`}
              className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-full bg-white"
              transition={transitions.normal}
            />
          )}
          <Icon className="icon-pop relative h-4 w-4 shrink-0" aria-hidden />
          {!collapsed && (
            <>
              <span className="relative min-w-0 flex-1 truncate">{item.label}</span>
              {/* A dot, not the word "soon". Nine rows each carrying a badge
                  is a sidebar of badges; the dot reads as "different" at a
                  glance and the title says which way. It is not the only
                  signal — the section's own screen states it plainly. */}
              {item.soon && (
                <span
                  className="relative h-1.5 w-1.5 shrink-0 rounded-full bg-sidebar-foreground/40"
                  title="Not built yet"
                  aria-label="Not built yet"
                  role="img"
                />
              )}
            </>
          )}
        </>
      )}
    </NavLink>
  );
}
