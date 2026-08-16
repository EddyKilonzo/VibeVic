"use client";

import Link from "next/link";
import { Youtube } from "lucide-react";
import { PROFILE } from "@/data/content";
import { CHANNEL, TOPICS } from "@/data/videos";
import { Reveal, Stagger, StaggerItem } from "@/components/motion";

const COLUMNS = [
  {
    title: "Work",
    links: [
      { href: "/videos", label: "All reports" },
      { href: "/stories", label: "Written work" },
      { href: "/genres", label: "Beats" },
      { href: "/publications", label: "Platforms" },
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
        <div className="grid gap-12 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <Reveal variant="fade-up" distance="sm">
            <p className="font-display text-2xl font-semibold tracking-tight">{PROFILE.name}</p>
            <p className="mt-3 max-w-xs text-sm leading-relaxed text-muted-foreground">
              Journalist reporting from {PROFILE.base}. Campus systems, Kenyan culture and student
              life — published as video, and written up here.
            </p>
            <a
              href={CHANNEL.url}
              target="_blank"
              rel="noreferrer noopener"
              className="focus-ring mt-5 inline-flex items-center gap-2 text-sm font-semibold text-primary"
            >
              <Youtube className="h-4 w-4" aria-hidden />
              <span className="underline-grow">{CHANNEL.handle}</span>
            </a>
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

          <Reveal variant="fade-up" distance="sm" delay={200}>
            <p className="rule-label">Subjects</p>
            <Stagger as="ul" step="tight" className="mt-4 space-y-2.5">
              {TOPICS.map((topic, i) => (
                <StaggerItem key={topic.slug} index={i}>
                  <Reveal variant="fade" as="li">
                    <Link
                      href={`/videos?topic=${topic.slug}`}
                      className="focus-ring underline-grow tap inline-flex items-center text-sm text-muted-foreground transition-colors hover:text-primary"
                    >
                      {topic.name}
                    </Link>
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
        </div>
      </div>
    </footer>
  );
}

export default PublicFooter;
