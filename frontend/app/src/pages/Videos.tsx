"use client";

import { useMemo } from "react";
import { useQueryParams } from "@/hooks/useQueryParams";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Youtube } from "lucide-react";
import { CHANNEL, TOPICS, VIDEOS, type TopicSlug } from "@/data/videos";
import { formatCompact } from "@/lib/format";
import { cn } from "@/lib/utils";
import { stagger, transitions } from "@/lib/motion";
import { Reveal } from "@/components/motion";
import { VideoCard } from "@/components/video/VideoCard";
import { EmptyState } from "@/components/ui/States";
import { Button } from "@/components/ui/Button";

export default function Videos() {
  const { get, setParams } = useQueryParams();
  const topic = get("topic", "all");
  const format = get("format", "all");
  const reduced = useReducedMotion();

  const videos = useMemo(() => {
    let list = VIDEOS;
    if (topic !== "all") list = list.filter((v) => v.topic === (topic as TopicSlug));
    if (format !== "all") list = list.filter((v) => v.format === format);
    return list;
  }, [topic, format]);

  const setFilter = (key: string, value: string | null) => setParams({ [key]: value });

  return (
    <div className="container-site pt-32 sm:pt-40">
      <Reveal variant="fade-up">
        <p className="rule-label">Reports</p>
        <h1 className="font-display mt-3 text-4xl font-semibold tracking-tight text-balance sm:text-6xl">
          Every report
        </h1>
        <p className="mt-4 max-w-xl text-lg leading-relaxed text-muted-foreground">
          {VIDEOS.length} pieces published on {CHANNEL.handle}, from campus systems to cultural
          week. Each one plays here — nothing loads from YouTube until you press play.
        </p>
      </Reveal>

      <Reveal variant="fade-up" delay={80} className="mt-10 border-y border-border py-4">
        <div className="flex flex-wrap items-center gap-2">
          <Chip active={topic === "all"} onClick={() => setFilter("topic", null)}>
            All topics
          </Chip>
          {TOPICS.map((t) => (
            <Chip key={t.slug} active={topic === t.slug} onClick={() => setFilter("topic", t.slug)}>
              {t.name}
            </Chip>
          ))}

          <Chip
            active={format === "short"}
            onClick={() => setFilter("format", format === "short" ? null : "short")}
            pillId="format-pill"
            className="ml-auto"
          >
            Shorts only
          </Chip>
        </div>
      </Reveal>

      <div className="mt-14 min-h-[35vh]">
        {videos.length === 0 ? (
          <EmptyState
            icon={<Youtube className="h-5 w-5" aria-hidden />}
            title="Nothing filed here yet"
            description="No reports match this combination. Try another topic."
            action={
              <Button
                variant="outline"
                size="sm"
                onClick={() => setParams({ topic: null, format: null })}
              >
                Show everything
              </Button>
            }
          />
        ) : (
          <motion.div
            layout={!reduced}
            transition={transitions.layout}
            className="grid grid-cols-1 gap-x-8 gap-y-12 sm:grid-cols-2 lg:grid-cols-3"
          >
            <AnimatePresence mode="popLayout" initial={false}>
              {videos.map((video, i) => (
                <motion.div
                  key={video.id}
                  layout={!reduced}
                  initial={reduced ? false : { opacity: 0, y: 12 }}
                  animate={{
                    opacity: 1,
                    y: 0,
                    transition: {
                      ...transitions.normal,
                      delay: reduced ? 0 : Math.min(i, 6) * stagger.tight,
                    },
                  }}
                  exit={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.98 }}
                  transition={transitions.normal}
                >
                  <VideoCard video={video} />
                </motion.div>
              ))}
            </AnimatePresence>
          </motion.div>
        )}
      </div>

      <Reveal variant="fade-up" className="mt-20 border-t border-border pt-10">
        <div className="flex flex-wrap items-center justify-between gap-6">
          <div>
            <p className="rule-label">The channel</p>
            <p className="font-display mt-2 text-2xl font-semibold tracking-tight">
              {CHANNEL.name}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {CHANNEL.subscribers} subscribers · {CHANNEL.videoCount} videos ·{" "}
              {formatCompact(VIDEOS.reduce((sum, v) => sum + v.views, 0))} total views
            </p>
          </div>
          <Button as="a" href={CHANNEL.url} target="_blank" rel="noreferrer noopener" variant="outline">
            <Youtube className="h-4 w-4" aria-hidden />
            Subscribe on YouTube
          </Button>
        </div>
      </Reveal>
    </div>
  );
}

function Chip({
  active,
  onClick,
  children,
  className,
  pillId = "topic-pill",
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  className?: string;
  pillId?: string;
}) {
  const reduced = useReducedMotion();

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "focus-ring press relative inline-flex h-9 items-center gap-1.5 rounded-full px-4 text-[13px] font-semibold transition-colors duration-normal",
        active ? "text-primary-foreground" : "text-muted-foreground hover:text-primary",
        className,
      )}
    >
      {active && (
        <motion.span
          layoutId={reduced ? undefined : pillId}
          className="absolute inset-0 rounded-full bg-primary"
          transition={transitions.normal}
        />
      )}
      <span className="relative">{children}</span>
    </button>
  );
}
