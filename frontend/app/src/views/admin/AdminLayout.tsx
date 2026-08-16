"use client";

import { useState } from "react";
import Link from "next/link";
import { NavLink } from "@/components/nav/NavLink";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  BarChart3,
  BookMarked,
  FileText,
  Image,
  LayoutDashboard,
  Lightbulb,
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

const NAV = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard, end: true },
  { href: "/admin/stories", label: "Stories", icon: FileText },
  { href: "/admin/ideas", label: "Ideas", icon: Lightbulb },
  { href: "/admin/media", label: "Media", icon: Image },
  { href: "/admin/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/admin/readers", label: "Readers", icon: Users },
  { href: "/admin/genres", label: "Genres & tags", icon: Tags },
  { href: "/admin/publications", label: "Publications", icon: BookMarked },
  { href: "/admin/awards", label: "Awards", icon: Trophy },
  { href: "/admin/settings", label: "Settings", icon: Settings },
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
      {/* Desktop sidebar */}
      <motion.aside
        animate={{ width: collapsed ? 72 : 248 }}
        initial={false}
        transition={reduced ? { duration: 0 } : transitions.normal}
        className="sticky top-0 hidden h-screen shrink-0 flex-col overflow-hidden bg-sidebar text-sidebar-foreground lg:flex"
      >
        <div className="flex h-16 items-center gap-3 px-5">
          <Link
            href="/"
            className="focus-ring font-display shrink-0 text-base font-semibold text-white"
          >
            VK
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
                <SidebarLink item={item} collapsed={collapsed} />
              </li>
            ))}
          </ul>
        </nav>

        <div className="p-3">
          <button
            type="button"
            onClick={() => setCollapsed((v) => !v)}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className="focus-ring flex h-10 w-full items-center gap-3 rounded-md px-3 text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent hover:text-white"
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
              className="fixed inset-y-0 left-0 z-50 w-[260px] bg-sidebar p-3 text-sidebar-foreground lg:hidden"
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
                      <SidebarLink item={item} collapsed={false} onClick={() => setMobileOpen(false)} />
                    </motion.li>
                  ))}
                </ul>
              </nav>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b border-border bg-background/85 px-5 backdrop-blur-xl">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            aria-label="Open admin menu"
            className="focus-ring flex h-10 w-10 items-center justify-center rounded-md lg:hidden"
          >
            <PanelLeftClose className="h-4 w-4 rotate-180" aria-hidden />
          </button>

          <p className="font-display truncate text-lg font-semibold tracking-tight">
            {NAV.find((n) => (n.end ? pathname === n.href : pathname.startsWith(n.href)))?.label ??
              "Admin"}
          </p>

          <Link
            href="/"
            className="focus-ring underline-grow ml-auto text-sm text-muted-foreground transition-colors hover:text-primary"
          >
            View site
          </Link>
        </header>

        <main className="min-w-0 flex-1 p-5 sm:p-8">
          <PageTransition>{children}</PageTransition>
        </main>
      </div>
    </div>
  );
}

function SidebarLink({
  item,
  collapsed,
  onClick,
}: {
  item: (typeof NAV)[number];
  collapsed: boolean;
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
          "focus-ring relative flex h-10 items-center gap-3 rounded-md px-3 text-sm transition-colors duration-normal",
          isActive
            ? "text-white"
            : "text-sidebar-foreground/75 hover:bg-sidebar-accent hover:text-white",
        )
      }
    >
      {({ isActive }) => (
        <>
          {isActive && (
            <motion.span
              layoutId={reduced ? undefined : "admin-nav-active"}
              className="absolute inset-0 rounded-md bg-sidebar-accent"
              transition={transitions.normal}
            />
          )}
          <Icon className="relative h-4 w-4 shrink-0" aria-hidden />
          {!collapsed && <span className="relative truncate">{item.label}</span>}
        </>
      )}
    </NavLink>
  );
}
