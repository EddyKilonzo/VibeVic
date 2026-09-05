"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { NavLink } from "@/components/nav/NavLink";
import { LogoMark } from "@/components/Logotype";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Bookmark, Search } from "lucide-react";
import { SOCIAL_ACCOUNTS } from "@/data/content";
import { SocialIcon } from "@/components/social/SocialIcon";
import { cn } from "@/lib/utils";
import { bezier, sequence, stagger, seconds, transitions } from "@/lib/motion";
import { useHeaderState } from "@/hooks/useHeaderState";
import { useBookmarks } from "@/context/BookmarksProvider";
import { SearchOverlay } from "@/components/search/SearchOverlay";

const NAV = [
  { href: "/videos", label: "Reports" },
  { href: "/stories", label: "Writing" },
  { href: "/genres", label: "Beats" },
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" },
];

/**
 * The masthead.
 *
 * Three behaviours, each earning its motion:
 *  - at the top it is transparent over the hero; past 24px it takes on a
 *    background and a hairline so body copy stays readable beneath it;
 *  - scrolling down past the fold it lifts away, and any upward scroll brings
 *    it straight back — navigation should be available the instant a reader
 *    reaches for it, without occupying the screen while they read;
 *  - the active-page indicator is a single shared element that slides between
 *    links (Motion's `layoutId`), rather than six independent underlines
 *    fading in and out.
 */
export function PublicHeader() {
  const { scrolled, hidden } = useHeaderState();
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const reduced = useReducedMotion();
  const pathname = usePathname();
  const { count } = useBookmarks();

  // Route changes always close both surfaces. Adjusted during render rather
  // than in an effect so the new page never paints for a frame with the old
  // page's menu still over it.
  const [lastPath, setLastPath] = useState(pathname);
  if (pathname !== lastPath) {
    setLastPath(pathname);
    setMenuOpen(false);
    setSearchOpen(false);
  }

  // ⌘K / Ctrl-K anywhere on the site.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <>
      <motion.header
        initial={reduced ? false : { opacity: 0, y: -12 }}
        animate={{
          opacity: 1,
          y: hidden && !menuOpen ? "-100%" : 0,
          transition: reduced
            ? { duration: 0 }
            : { duration: seconds.normal, ease: bezier.easeOut, delay: sequence.nav },
        }}
        className="fixed inset-x-0 top-0 z-50 px-3 pt-3 sm:px-5 sm:pt-5"
      >
        {/*
          A floating capsule rather than a full-width bar.
          It sits over the inset hero panel, so it needs its own edges to read
          as an object; at the top of the page it is barely tinted and lets the
          gradient through, and past the fold it firms up into frosted glass so
          body copy stays readable underneath. The rounding and the border are
          always present — a bar that grows a shape on scroll looks like it is
          assembling itself.
        */}
        <div
          /* Read by the `body[data-hero="dark"]` rule in index.css, which
             turns the capsule's text white while it floats over a hero. An
             attribute rather than a class so the two states are one switch
             that cannot end up both on at once. */
          data-scrolled={scrolled ? "true" : "false"}
          className={cn(
            "site-header-bar",
            // Not `container-site`: that utility carries its own horizontal
            // padding, and which of the two wins depends on stylesheet order
            // rather than on the class list. The width is spelled out instead.
            "frost mx-auto flex h-[60px] w-full max-w-[1440px] items-center justify-between gap-6 rounded-full px-4 sm:px-5 md:h-[68px]",
            "transition-[background-color,border-color,box-shadow,backdrop-filter] duration-slow ease-editorial",
            "border",
            scrolled
              ? "border-white/70 bg-background/75 shadow-floating backdrop-blur-2xl backdrop-saturate-150"
              : "border-white/50 bg-white/30 shadow-raised backdrop-blur-lg backdrop-saturate-150",
          )}
        >
          {/* The mark, then the name.

              One cell of the honeycomb the whole site is textured with, whose
              descending edges were already a V — see `Logotype`. The name
              stays as text beside it rather than being drawn into the SVG,
              because a byline should be selectable, searchable and read
              correctly aloud, and outlines give all three up for letterforms
              nobody was going to compare. */}
          <Link
            href="/"
            className="focus-ring tap inline-flex shrink-0 items-center gap-2.5 text-primary"
          >
            <LogoMark size={26} className="hidden sm:block" />
            <LogoMark size={22} bare className="sm:hidden" />
            <span className="font-display text-lg font-semibold tracking-tight text-foreground">
              Victor Kiplimo
            </span>
            <span className="ml-1 hidden text-[11px] font-sans font-semibold uppercase tracking-[0.2em] text-muted-foreground sm:inline">
              Journalist
            </span>
          </Link>

          <nav aria-label="Primary" className="hidden lg:block">
            <ul className="flex items-center gap-1">
              {NAV.map((item) => (
                <li key={item.href}>
                  <NavLink
                    href={item.href}
                    className={({ isActive }) =>
                      cn(
                        "focus-ring relative block px-3 py-2 text-sm font-medium transition-colors duration-normal",
                        isActive ? "text-primary" : "text-muted-foreground hover:text-foreground",
                      )
                    }
                  >
                    {({ isActive }) => (
                      <>
                        {item.label}
                        {isActive && (
                          <motion.span
                            layoutId={reduced ? undefined : "nav-indicator"}
                            className="absolute inset-x-3 -bottom-px h-[2px] bg-accent"
                            transition={transitions.normal}
                          />
                        )}
                      </>
                    )}
                  </NavLink>
                </li>
              ))}
            </ul>
          </nav>

          <div className="flex items-center gap-1">
            <Link
              href="/stories?saved=1"
              aria-label={`Saved stories${count ? ` (${count})` : ""}`}
              className="focus-ring relative hidden h-11 w-11 items-center justify-center rounded-md text-muted-foreground transition-colors hover:text-primary sm:flex"
            >
              <Bookmark className="h-[18px] w-[18px]" strokeWidth={1.75} aria-hidden />
              <AnimatePresence>
                {count > 0 && (
                  <motion.span
                    initial={reduced ? false : { scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0, opacity: 0 }}
                    transition={{ type: "spring", stiffness: 520, damping: 20 }}
                    className="absolute right-1.5 top-1.5 flex h-[15px] min-w-[15px] items-center justify-center rounded-full bg-accent px-1 text-[9px] font-bold text-accent-foreground"
                  >
                    {count}
                  </motion.span>
                )}
              </AnimatePresence>
            </Link>

            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              aria-label="Search stories"
              className="focus-ring flex h-11 w-11 items-center justify-center rounded-md text-muted-foreground transition-colors hover:text-primary"
            >
              <Search className="h-[18px] w-[18px]" strokeWidth={1.75} aria-hidden />
            </button>

            <MenuToggle open={menuOpen} onToggle={() => setMenuOpen((v) => !v)} />
          </div>
        </div>
      </motion.header>

      <MobileMenu open={menuOpen} onClose={() => setMenuOpen(false)} savedCount={count} />
      <SearchOverlay open={searchOpen} onClose={() => setSearchOpen(false)} />
    </>
  );
}

/**
 * Hamburger that becomes a close mark.
 *
 * Two bars rotating into an X, rather than a swap between two icons — the
 * continuity is what makes the control feel like one object in two states.
 */
function MenuToggle({ open, onToggle }: { open: boolean; onToggle: () => void }) {
  const reduced = useReducedMotion();
  const bar = "absolute left-1/2 h-[1.5px] w-[19px] -translate-x-1/2 bg-current";
  const spring = reduced ? { duration: 0 } : { type: "spring" as const, stiffness: 420, damping: 32 };

  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      aria-controls="mobile-menu"
      aria-label={open ? "Close menu" : "Open menu"}
      className="focus-ring relative flex h-11 w-11 items-center justify-center rounded-md text-foreground lg:hidden"
    >
      <span className="relative block h-[19px] w-[19px]">
        <motion.span
          className={bar}
          initial={false}
          animate={open ? { top: 9, rotate: 45 } : { top: 5, rotate: 0 }}
          transition={spring}
        />
        <motion.span
          className={bar}
          initial={false}
          animate={open ? { top: 9, rotate: -45 } : { top: 13, rotate: 0 }}
          transition={spring}
        />
      </span>
    </button>
  );
}

/** Full-screen drawer with staggered items. Fast — 320ms, then done. */
function MobileMenu({
  open,
  onClose,
  savedCount,
}: {
  open: boolean;
  onClose: () => void;
  savedCount: number;
}) {
  const reduced = useReducedMotion();

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          id="mobile-menu"
          className="fixed inset-0 z-40 flex flex-col bg-background pt-[68px] lg:hidden"
          initial={reduced ? { opacity: 0 } : { opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reduced ? { opacity: 0 } : { opacity: 0, y: -8 }}
          transition={transitions.normal}
        >
          <nav
            aria-label="Mobile"
            // Lenis owns the wheel on the document; without this the sheet
            // cannot be scrolled past its first screen on a short viewport.
            data-lenis-prevent
            className="container-site flex-1 overflow-y-auto py-8"
          >
            <ul>
              {NAV.map((item, i) => (
                <motion.li
                  key={item.href}
                  initial={reduced ? false : { opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{
                    ...transitions.normal,
                    delay: reduced ? 0 : 0.04 + i * stagger.tight,
                  }}
                >
                  <NavLink
                    href={item.href}
                    onClick={onClose}
                    className={({ isActive }) =>
                      cn(
                        "focus-ring press font-display flex min-h-[56px] items-center border-b border-border text-2xl font-semibold tracking-tight transition-colors",
                        isActive ? "text-primary" : "text-foreground",
                      )
                    }
                  >
                    {item.label}
                  </NavLink>
                </motion.li>
              ))}
              <motion.li
                initial={reduced ? false : { opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  ...transitions.normal,
                  delay: reduced ? 0 : 0.04 + NAV.length * stagger.tight,
                }}
              >
                <Link
                  href="/stories?saved=1"
                  onClick={onClose}
                  className="focus-ring press flex min-h-[56px] items-center gap-3 text-sm font-semibold text-muted-foreground"
                >
                  <Bookmark className="h-4 w-4" aria-hidden />
                  Saved stories
                  {savedCount > 0 && (
                    <span className="rounded-full bg-secondary px-2 py-0.5 text-[11px] text-primary">
                      {savedCount}
                    </span>
                  )}
                </Link>
              </motion.li>
            </ul>

            {/* The accounts, at the foot of the drawer. On a phone this is the
                one screen where every route is already visible, so it is the
                natural place to offer the two off-site ones too. */}
            <motion.div
              initial={reduced ? false : { opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                ...transitions.normal,
                delay: reduced ? 0 : 0.04 + (NAV.length + 1) * stagger.tight,
              }}
              className="mt-8 flex flex-wrap gap-2 border-t border-border pt-8"
            >
              {SOCIAL_ACCOUNTS.map((account) => (
                <a
                  key={account.label}
                  href={account.url}
                  target="_blank"
                  rel="noreferrer noopener"
                  onClick={onClose}
                  className="surface-compact focus-ring tap group inline-flex items-center gap-2 rounded-full px-4 text-xs font-semibold text-muted-foreground transition-colors hover:border-accent/50 hover:text-primary"
                >
                  <SocialIcon id={account.id} className="icon-tilt h-4 w-4 text-accent" />
                  {account.label}
                </a>
              ))}
            </motion.div>
          </nav>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default PublicHeader;
