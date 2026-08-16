import Image from "next/image";
import type { StockImage } from "@/data/imagery";
import { cn } from "@/lib/utils";

/**
 * A stock photograph used as a section ground.
 *
 * Deliberately unmistakable as decoration: it sits behind a heavy scrim, the
 * credit is visible in the corner, and it never carries a caption. If you find
 * yourself wanting to caption one of these, it has become editorial content
 * and should be a real photograph instead — see the rule in `data/imagery.ts`.
 */
export function AtmosphereBand({
  image,
  children,
  className,
  height = "min-h-[320px]",
}: {
  image: StockImage;
  children?: React.ReactNode;
  className?: string;
  height?: string;
}) {
  return (
    <section className={cn("relative overflow-hidden rounded-2xl", height, className)}>
      <Image
        src={image.url}
        alt={image.alt}
        fill
        sizes="(max-width: 768px) 100vw, 1440px"
        className="object-cover"
      />
      {/* Heavy enough that the picture reads as ground, and that anything set
          over it clears contrast without a second treatment. */}
      <span
        aria-hidden
        className="absolute inset-0 bg-gradient-to-br from-brand-ink-deep/90 via-primary/75 to-brand-ink-deep/85"
      />

      {children && <div className="relative z-10 p-8 sm:p-12">{children}</div>}

      <a
        href={image.creditUrl}
        target="_blank"
        rel="noreferrer noopener"
        className="focus-ring absolute bottom-2 right-3 z-10 text-[10px] uppercase tracking-[0.14em] text-white/55 transition-colors hover:text-white"
      >
        Photo: {image.credit}
      </a>
    </section>
  );
}
