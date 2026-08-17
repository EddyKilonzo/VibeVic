"use client";

import Link from "next/link";
import { ArrowUpRight, GraduationCap, MapPin } from "lucide-react";
import { PROFILE, SOCIAL_ACCOUNTS } from "@/data/content";
import { AGAINST_WALL, GALLERY, SHOOTING } from "@/data/portraits";
import { SocialIcon } from "@/components/social/SocialIcon";
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
    <div>
      {/* ── Hero ───────────────────────────────────────────────────
          The portrait is beside the title, not behind it, and at its own 3:4.
          Full bleed it was a 1080×1440 picture cropped into a band four
          hundred pixels tall — a horizontal sliver of a coat, with the man it
          is a photograph of outside the frame. A hero image that has to be
          cropped past recognition is not doing a hero's job.

          The ground is the comb at its loud weight, matching the article
          hero. Nothing here is body copy, which is the condition for using
          it. */}
      <header className="honeycomb honeycomb-intense honeycomb-fade relative isolate overflow-hidden border-b border-border pb-12 pt-28 sm:pb-16 sm:pt-36">
        <div className="container-site relative">
          <div className="grid items-center gap-10 sm:grid-cols-[minmax(0,1fr)_minmax(0,240px)] sm:gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,300px)] lg:gap-16">
            <div>
              <p className="rule-label">About</p>
              <TextReveal
                as="h1"
                lines={["Victor Kiplimo,", "journalist."]}
                className="font-display mt-4 text-[2.4rem] font-semibold leading-[1.05] tracking-tight sm:text-5xl lg:text-[3.6rem]"
                immediate
              />
              <p className="mt-5 max-w-[46ch] text-lg leading-relaxed text-muted-foreground">
                Reporting from {PROFILE.base} — campus systems, Kenyan culture and student life.
              </p>
            </div>

            <Reveal variant="fade-scale" delay={140}>
              <ImageReveal
                src={AGAINST_WALL.src}
                alt={AGAINST_WALL.alt}
                ratio="3/4"
                priority
                immediate
                className="mx-auto max-w-[260px] rounded-2xl shadow-primary sm:max-w-none"
                imgClassName="object-cover object-top"
              />
            </Reveal>
          </div>
        </div>
      </header>

      <div className="container-site pt-16 sm:pt-20">
        {/* Text and image enter from opposite sides — the one place on the
            site where a directional reveal carries meaning. */}
        <div className="grid gap-14 lg:grid-cols-[1.1fr_1fr]">
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
              {SOCIAL_ACCOUNTS.map((account) => (
                <li key={account.id} className="group flex items-center gap-3">
                  <SocialIcon id={account.id} className="icon-tilt h-4 w-4 shrink-0 text-accent" />
                  <a
                    href={account.url}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="underline-grow"
                  >
                    {account.handle}
                  </a>
                  <span className="text-muted-foreground">· {account.label}</span>
                </li>
              ))}
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
          <Stagger className="mt-8 grid gap-4 sm:grid-cols-2 sm:gap-5" step="normal">
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
            up with someone, so the accounts sit here rather than only in the
            footer — one card each, saying what is on it, because three logos
            in a row do not tell anybody which one they want. */}
        <section className="mt-24 lg:mt-32">
          <p className="rule-label">Follow the work</p>
          <h2 className="font-display display-3 mt-3 font-semibold text-balance">
            Three places, three different things.
          </h2>

          <div className="mt-8 grid gap-4 sm:grid-cols-3 sm:gap-5">
            {SOCIAL_ACCOUNTS.map((account, i) => (
              <Reveal
                key={account.id}
                variant="fade-up"
                delay={i * 70}
                className="surface honeycomb honeycomb-strong overflow-hidden"
              >
                <a
                  href={account.url}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="focus-ring group flex h-full flex-col p-6 sm:p-7"
                >
                  <span className="grid h-11 w-11 place-items-center rounded-lg bg-primary text-primary-foreground shadow-raised">
                    <SocialIcon id={account.id} className="icon-tilt h-5 w-5" />
                  </span>
                  <p className="font-display mt-5 text-xl font-semibold tracking-tight transition-transform duration-normal ease-entrance group-hover:translate-x-[3px] motion-reduce:transform-none">
                    {account.label}
                  </p>
                  <p className="mt-2 flex-1 text-sm leading-relaxed text-muted-foreground">
                    {account.note}
                  </p>
                  <span className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-primary">
                    {account.handle}
                    <ArrowUpRight
                      className="nudge-x h-4 w-4 transition-colors group-hover:text-accent"
                      aria-hidden
                    />
                  </span>
                </a>
              </Reveal>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
