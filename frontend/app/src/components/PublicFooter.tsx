"use client";

import Link from "next/link";
import { PROFILE, SOCIAL_ACCOUNTS, TOP_BEATS, childBeats } from "@/data/content";
import { PORTRAIT } from "@/data/portraits";
import { PortraitFrame } from "@/components/media/PortraitFrame";
import { SocialIcon } from "@/components/social/SocialIcon";
import { Reveal, Stagger, StaggerItem } from "@/components/motion";

const COLUMNS = [
  {
    title: "Work",
    links: [
      { href: "/videos", label: "All reports" },
      { href: "/stories", label: "Written work" },
      { href: "/genres", label: "Beats" },
      { href: "/awards", label: "Recognition" },
    ],
  },
  {
    title: "More",
    links: [
      { href: "/about", label: "About" },
      { href: "/contact", label: "Contact" },
      { href: "/search", label: "Search" },
      { href: "/stories?saved=1", label: "Saved" },
    ],
  },
];

export function PublicFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="mt-28 border-t border-border bg-secondary/40">
      <div className="container-site py-16">
        {/* Two columns on a phone rather than one. A single column left the
            whole right half of the screen empty and pushed the link lists
            into a tall stack the reader has to scroll past; paired, they read
            at a glance. The identity block and the subject list both span the
            full width — one because it carries a portrait and a paragraph,
            the other because seven subject names sit better as two columns
            than as one long list beside nothing.

            Subjects link into `/genres`, not into a filtered video feed —
            three of the seven have no video at all, so a `?topic=` link would
            have landed the reader on an empty archive. */}
        <div className="grid grid-cols-2 gap-x-6 gap-y-10 sm:gap-x-8 md:grid-cols-[1.4fr_1fr_1fr_1fr] md:gap-12">
          <Reveal variant="fade-up" distance="sm" className="col-span-2 md:col-span-1">
            <div className="flex items-center gap-4">
              {/* Small, and next to his name — a byline portrait, which is the
                  one thing a face is for in a footer. */}
              <PortraitFrame
                portrait={PORTRAIT}
                size={56}
                className="h-14 w-14 shrink-0 rounded-full shadow-lifted ring-1 ring-border"
              />
              <p className="font-display text-2xl font-semibold tracking-tight">{PROFILE.name}</p>
            </div>
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-muted-foreground">
              Journalist reporting from {PROFILE.base}. Campus systems, Kenyan culture and student
              life — published as video, and written up here.
            </p>

            {/* Two columns rather than one. Six accounts, each with a handle
                and a line of explanation, made a stack about four hundred
                pixels tall down the left of the footer — taller than the two
                link columns beside it, so the footer ended on a long tail of
                social links with white space either side of it. Paired, the
                block finishes level with the rest.

                The note drops away below `sm`: on a phone the grid is already
                two narrow columns, and a second line of small grey text under
                each handle turns it into a wall. */}
            <ul className="mt-6 grid grid-cols-2 gap-x-4 gap-y-3">
              {SOCIAL_ACCOUNTS.map((account) => (
                <li key={account.id} className="min-w-0">
                  <a
                    href={account.url}
                    target="_blank"
                    rel="noreferrer noopener"
                    title={account.note}
                    className="focus-ring group flex items-start gap-2.5 text-sm"
                  >
                    <SocialIcon
                      id={account.id}
                      className="icon-tilt mt-0.5 h-4 w-4 shrink-0 text-primary"
                    />
                    <span className="min-w-0">
                      <span className="underline-grow block truncate font-semibold text-primary">
                        {account.handle}
                      </span>
                      <span className="mt-0.5 hidden text-xs leading-snug text-muted-foreground sm:block">
                        {account.note}
                      </span>
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          </Reveal>

          {COLUMNS.map((column, ci) => (
            <Reveal key={column.title} variant="fade-up" distance="sm" delay={80 + ci * 60}>
              <p className="rule-label">{column.title}</p>
              <ul className="mt-4 space-y-2.5">
                {column.links.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className="focus-ring underline-grow tap inline-flex items-center text-sm text-muted-foreground transition-colors hover:text-primary"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </Reveal>
          ))}

          <Reveal
            variant="fade-up"
            distance="sm"
            delay={200}
            className="col-span-2 md:col-span-1"
          >
            <p className="rule-label">Subjects</p>
            <Stagger
              as="ul"
              step="tight"
              className="mt-4 grid grid-cols-2 gap-x-6 gap-y-4 md:grid-cols-1"
            >
              {/* Parent, then the subjects under it — the same tree the beats
                  page renders, which is what makes a footer worth reading
                  rather than a second copy of the nav. The children are set
                  smaller and quieter so the six stay scannable. */}
              {TOP_BEATS.map((topic, i) => (
                <StaggerItem key={topic.slug} index={i}>
                  <Reveal variant="fade" as="li">
                    <Link
                      href={`/beats/${topic.slug}`}
                      className="focus-ring underline-grow tap inline-flex items-center text-sm font-semibold text-foreground transition-colors hover:text-primary"
                    >
                      {topic.name}
                    </Link>
                    {childBeats(topic.slug).length > 0 && (
                      <span className="mt-1 flex flex-wrap gap-x-2 gap-y-0.5">
                        {childBeats(topic.slug).map((child) => (
                          <Link
                            key={child.slug}
                            href={`/beats/${child.slug}`}
                            className="focus-ring tap text-xs text-muted-foreground transition-colors hover:text-primary"
                          >
                            {child.name}
                          </Link>
                        ))}
                      </span>
                    )}
                  </Reveal>
                </StaggerItem>
              ))}
            </Stagger>
          </Reveal>
        </div>

        <div className="mt-14 flex flex-col gap-3 border-t border-border pt-6 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {year} {PROFILE.name}. All rights reserved.
          </p>
          <p>
            Tips and corrections:{" "}
            <a href={`mailto:${PROFILE.email}`} className="underline-grow text-primary">
              {PROFILE.email}
            </a>
          </p>
          {/* The newsroom, named for what it is to the person who uses it
              rather than for the route it sits on. Down here with the
              copyright rather than up in "More" because it is not reading —
              every other link in this footer leads somewhere a visitor can
              go, and this one leads to a passphrase.

              Listing it at all is safe: the lock is the middleware, which
              never serves an admin route without the cookie, so a hidden
              link was only ever hiding the door and not closing it. */}
          <Link
            href="/admin"
            className="focus-ring underline-grow tap inline-flex items-center transition-colors hover:text-primary"
          >
            Journal
          </Link>
        </div>
      </div>
    </footer>
  );
}

export default PublicFooter;
