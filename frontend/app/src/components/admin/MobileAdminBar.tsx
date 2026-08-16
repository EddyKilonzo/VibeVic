"use client";

import { Fragment } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, FileText, LayoutDashboard, Lightbulb, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

const ITEMS = [
  { href: "/admin", label: "Home", icon: LayoutDashboard, end: true },
  { href: "/admin/stories", label: "Stories", icon: FileText },
  // The centre slot is the compose action, inserted between these.
  { href: "/admin/ideas", label: "Ideas", icon: Lightbulb },
  { href: "/admin/analytics", label: "Data", icon: BarChart3 },
];

/**
 * The admin's bottom bar on phones.
 *
 * A sidebar behind a hamburger costs two taps to reach anything, and on a
 * phone the journalist's thumb is at the bottom of the screen, not the top.
 * Four destinations plus a raised compose button in the middle — the one
 * action that starts work rather than navigating to it.
 *
 * It sits above the safe-area inset so it clears the home indicator, and it is
 * hidden from `lg:` up where the real sidebar takes over. Only one of the two
 * is ever in the accessibility tree.
 */
export function MobileAdminBar() {
  const pathname = usePathname() ?? "/admin";

  const isActive = (href: string, end?: boolean) =>
    end ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <nav
      aria-label="Workspace"
      className={cn(
        "glass-strong frost fixed inset-x-0 bottom-0 z-40 lg:hidden",
        "border-t border-border/60 pb-[env(safe-area-inset-bottom)]",
      )}
    >
      <ul className="mx-auto flex max-w-[560px] items-stretch justify-around px-2">
        {ITEMS.map((item, i) => (
          // The compose button is spliced into the middle of the list rather
          // than floated over it, so it takes part in the same layout and
          // cannot end up covering a destination on a narrow screen.
          <Fragment key={item.href}>
            {i === 2 && (
              <li className="flex items-center px-1">
                <Link
                  href="/admin/stories/new"
                  aria-label="New story"
                  className={cn(
                    "focus-ring press -mt-5 flex h-14 w-14 items-center justify-center rounded-full",
                    "bg-primary text-primary-foreground shadow-primary",
                  )}
                >
                  <Plus className="h-6 w-6" aria-hidden />
                </Link>
              </li>
            )}
            <li className="flex-1">
              <Link
                href={item.href}
                aria-current={isActive(item.href, item.end) ? "page" : undefined}
                className={cn(
                  "focus-ring flex min-h-[56px] flex-col items-center justify-center gap-1 rounded-lg text-[10px] font-semibold",
                  "transition-colors duration-normal",
                  isActive(item.href, item.end)
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <item.icon className="h-[18px] w-[18px]" aria-hidden />
                {item.label}
              </Link>
            </li>
          </Fragment>
        ))}
      </ul>
    </nav>
  );
}
