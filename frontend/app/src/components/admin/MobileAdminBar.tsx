"use client";

import { Fragment } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Activity, BarChart3, FileText, LayoutDashboard, Lightbulb, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { newsroomPath, newsroomSuffix } from "@/lib/newsroom-path";
import { useCan } from "./SessionContext";

/**
 * Four slots, and the third one depends on who is signed in.
 *
 * The bar's shape is not negotiable — two destinations, the compose button,
 * two more — so a role that cannot open the ideas notebook does not get a
 * gap there, it gets the screen that is actually theirs. Diagnostics is the
 * dev's most-reached-for page in the same way ideas is the writer's, so the
 * swap keeps the bar useful rather than merely correct.
 *
 * Compose stays for both. A DEV holds `stories:write` and reproduces editor
 * bugs by writing in the editor; what they cannot do is publish, and that
 * button is not here.
 */
function itemsFor(notebook: boolean) {
  return [
    { href: newsroomPath(), label: "Home", icon: LayoutDashboard, end: true },
    { href: newsroomPath("/stories"), label: "Stories", icon: FileText },
    // The centre slot is the compose action, inserted between these.
    notebook
      ? { href: newsroomPath("/ideas"), label: "Ideas", icon: Lightbulb }
      : { href: newsroomPath("/diagnostics"), label: "Health", icon: Activity },
    { href: newsroomPath("/analytics"), label: "Data", icon: BarChart3 },
  ];
}

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
  /*
   * Compared as suffixes, because the two sides are not guaranteed to be
   * spelled the same: the browser holds the public mount while the server
   * rendered the rewritten path, and which one `usePathname` reports during
   * hydration is a router detail rather than a promise.
   */
  const pathname = newsroomSuffix(usePathname() ?? newsroomPath());
  const items = itemsFor(useCan("newsroom:ideas"));

  const isActive = (href: string, end?: boolean) =>
    end
      ? pathname === newsroomSuffix(href)
      : pathname === newsroomSuffix(href) || pathname.startsWith(`${newsroomSuffix(href)}/`);

  return (
    <nav
      aria-label="Workspace"
      className={cn(
        "glass-strong frost fixed inset-x-0 bottom-0 z-40 lg:hidden",
        "border-t border-border/60 pb-[env(safe-area-inset-bottom)]",
      )}
    >
      <ul className="mx-auto flex max-w-[560px] items-stretch justify-around px-2">
        {items.map((item, i) => (
          // The compose button is spliced into the middle of the list rather
          // than floated over it, so it takes part in the same layout and
          // cannot end up covering a destination on a narrow screen.
          <Fragment key={item.href}>
            {i === 2 && (
              <li className="flex items-center px-1">
                <Link
                  href={newsroomPath("/stories/new")}
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
                <item.icon className="h-5 w-5" aria-hidden />
                {item.label}
              </Link>
            </li>
          </Fragment>
        ))}
      </ul>
    </nav>
  );
}
