"use client";

import Link from "next/link";
import { GraduationCap, Instagram, MapPin, Youtube } from "lucide-react";
import { PROFILE, SOCIAL } from "@/data/content";
import { GALLERY, SHOOTING } from "@/data/portraits";
import { CHANNEL, TOPICS, totalViews } from "@/data/videos";
import {
  CountUp,
  ImageReveal,
  Parallax,
  Reveal,
  Stagger,
  StaggerItem,
  TextReveal,
} from "@/components/motion";
import { Button } from "@/components/ui/Button";

/**
 * Biography.
 *
 * Everything stated here is either verified from the channel or was supplied
 * by Victor directly — the name, the beat, the university, the figures. The
 * page is deliberately short: it is better to say four true things than to
 * pad it with a career narrative nobody confirmed.
 */
export default function About() {
  const stats = [
    { value: CHANNEL.videoCount, label: "Reports published" },
    { value: totalViews(), label: "Total views" },
    { value: CHANNEL.subscribers, label: "Subscribers" },
    { value: TOPICS.length, label: "Beats covered" },
  ];

  return (
    <div className="pt-32 sm:pt-40">
      <div className="container-site">
        <Reveal variant="fade-up">
          <p className="rule-label">About</p>
        </Reveal>

        <TextReveal
          as="h1"
          lines={["Victor Kiplimo,", "journalist."]}
          className="font-display mt-3 text-[2.6rem] font-semibold leading-[1.05] tracking-tight sm:text-6xl lg:text-[4rem]"
          immediate
        />

        {/* Text and image enter from opposite sides — the one place on the
            site where a directional reveal carries meaning. */}
        <div className="mt-16 grid gap-14 lg:grid-cols-[1.1fr_1fr]">
          <Reveal variant="fade-right">
            <div className="space-y-6 text-[1.05rem] leading-[1.8] text-foreground/90">
              <p>
                I'm a journalist based in {PROFILE.base}, and a graduate of{" "}
                <span className="font-semibold text-primary">{PROFILE.education}</span>. I report,
                shoot and edit my own pieces, and publish them on{" "}
                <a
                  href={CHANNEL.url}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="underline-grow font-medium text-primary"
                >
                  {CHANNEL.handle}
                </a>
                .
              </p>
              <p>
                The work so far has centred on the Eldoret National Polytechnic — how the
                institution runs, what changes when a process like procurement moves online, and
                what students carry that never appears in an official statement. Alongside that
                sit cultural pieces and commissioned features.
              </p>
              <p>
                Everything is short-form on purpose. A two-minute report that someone finishes is
                worth more than a ten-minute one they close halfway through.
              </p>
            </div>

            <ul className="mt-9 space-y-3 text-sm">
              <li className="flex items-center gap-3">
                <GraduationCap className="h-4 w-4 shrink-0 text-accent" aria-hidden />
                <span>{PROFILE.education}</span>
              </li>
              <li className="flex items-center gap-3">
                <MapPin className="h-4 w-4 shrink-0 text-accent" aria-hidden />
                <span>{PROFILE.base}</span>
              </li>
              <li className="group flex items-center gap-3">
                <Youtube className="icon-tilt h-4 w-4 shrink-0 text-accent" aria-hidden />
                <a
                  href={SOCIAL.youtube.url}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="underline-grow"
                >
                  {SOCIAL.youtube.handle}
                </a>
              </li>
              <li className="group flex items-center gap-3">
                <Instagram className="icon-tilt h-4 w-4 shrink-0 text-accent" aria-hidden />
                <a
                  href={SOCIAL.instagram.url}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="underline-grow"
                >
                  {SOCIAL.instagram.handle}
                </a>
              </li>
            </ul>

            <div className="mt-10 flex flex-wrap gap-3">
              <Button as={Link} href="/videos">
                Watch the work
              </Button>
              <Button as={Link} href="/contact" variant="outline">
                Get in touch
              </Button>
            </div>
          </Reveal>

          <Reveal variant="fade-left">
            {/* A photograph of him, not a frame from a report. The distinction
                matters on a page that is about the person: a video still here
                would be the work standing in for its author. */}
            <Parallax amount={18}>
              <ImageReveal
                src={SHOOTING.src}
                alt={SHOOTING.alt}
                ratio="3/4"
                immediate
                className="rounded-xl shadow-primary"
                imgClassName="object-cover"
              />
            </Parallax>
            <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
              He reports, shoots and edits every piece himself.
            </p>
          </Reveal>
        </div>

        {/* Stats count once, on arrival, then hold. */}
        <div className="mt-24 grid grid-cols-2 gap-px border-t border-border bg-border sm:grid-cols-4">
          {stats.map((stat, i) => (
            <Reveal key={stat.label} variant="fade-up" delay={i * 70} className="bg-background p-6">
              <p className="font-display text-4xl font-semibold tracking-tight text-primary">
                <CountUp value={stat.value} />
              </p>
              <p className="rule-label mt-2">{stat.label}</p>
            </Reveal>
          ))}
        </div>

        {/* ── Portraits ──────────────────────────────────────────
            Three frames from the same set, on the comb rhythm the rest of the
            site uses: every second plate drops half a step from `lg` up, so the
            row interlocks instead of sitting on one flat baseline. On a phone
            it is a plain column, which is the right answer there. */}
        <section className="mt-24 sm:mt-28">
          <p className="rule-label">Portraits</p>
          <Stagger className="mt-8 grid gap-4 sm:grid-cols-3 sm:gap-5" step="normal">
            {GALLERY.map((portrait, i) => (
              <StaggerItem key={portrait.src} index={i}>
                <figure className={i % 2 === 1 ? "lg:translate-y-8" : ""}>
                  <ImageReveal
                    src={portrait.src}
                    alt={portrait.alt}
                    ratio="3/4"
                    className="rounded-xl shadow-primary"
                    imgClassName="object-cover"
                  />
                  <figcaption className="rule-label mt-3">{portrait.caption}</figcaption>
                </figure>
              </StaggerItem>
            ))}
          </Stagger>
        </section>

        {/* ── Follow ─────────────────────────────────────────────
            The end of a biography is where a reader decides whether to keep
            up with someone, so the two accounts sit here rather than only in
            the footer. */}
        <Reveal
          variant="fade-up"
          className="surface honeycomb honeycomb-strong mt-24 overflow-hidden p-7 sm:p-10 lg:mt-32"
        >
          <div className="flex flex-col gap-7 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="rule-label">Follow the work</p>
              <h2 className="font-display display-3 mt-3 font-semibold text-balance">
                Reports land on YouTube first.
              </h2>
              <p className="mt-3 max-w-[46ch] leading-relaxed text-muted-foreground">
                Instagram is where the stills and the between-shoots material go.
              </p>
            </div>

            <div className="flex shrink-0 flex-wrap gap-3">
              <Button
                as="a"
                href={SOCIAL.youtube.url}
                target="_blank"
                rel="noreferrer noopener"
                className="group"
              >
                <Youtube className="icon-tilt h-4 w-4" aria-hidden />
                {SOCIAL.youtube.handle}
              </Button>
              <Button
                as="a"
                href={SOCIAL.instagram.url}
                target="_blank"
                rel="noreferrer noopener"
                variant="outline"
                className="group"
              >
                <Instagram className="icon-tilt h-4 w-4" aria-hidden />
                {SOCIAL.instagram.handle}
              </Button>
            </div>
          </div>
        </Reveal>
      </div>
    </div>
  );
}
