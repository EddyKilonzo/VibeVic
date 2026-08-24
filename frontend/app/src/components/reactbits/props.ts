import type { ComponentType, ReactNode } from "react";

/**
 * The prop contracts for the untyped React Bits sources.
 *
 * TypeScript does infer types from the `.jsx` files, and those inferences are
 * not usable: a `frontImage = null` default makes the prop `null | undefined`,
 * so passing the image URL it exists to receive is an error. Several others
 * turn optional props into required ones for the same reason.
 *
 * So `index.tsx` casts each import to the shape below. That is still a cast,
 * but it is a cast to a real contract rather than `any` — the calls in the
 * wrapper are checked against these, so a prop renamed upstream or a number
 * passed where a string belongs fails the build instead of silently rendering
 * a marquee with no text or a counter stuck at zero.
 *
 * These describe the props this app passes, deliberately not every prop the
 * components accept: a prop nobody uses is a prop nobody has checked.
 */

export type CurvedLoop = ComponentType<{
  marqueeText: string;
  speed?: number;
  /** Capped by the caller — past ~140 the text leaves the viewBox. */
  curveAmount?: number;
  direction?: "left" | "right";
  interactive?: boolean;
  className?: string;
}>;

export type ScrollExpand = ComponentType<{
  src: string;
  alt: string;
  title?: string;
  scrollHint?: string;
  mediaType?: "image" | "video";
  /** False under reduced motion, which renders it as a plain figure. */
  enabled?: boolean;
  useWindowScroll?: boolean;
  startWidth?: number;
  startHeight?: number;
  startRadius?: number;
  endRadius?: number;
  className?: string;
  children?: ReactNode;
}>;

export type SpecularButton = ComponentType<{
  onClick?: () => void;
  className?: string;
  size?: "sm" | "md" | "lg";
  radius?: number;
  baseColor?: string;
  textColor?: string;
  lineColor?: string;
  followMouse?: boolean;
  speed?: number;
  intensity?: number;
  children?: ReactNode;
}>;

export type CountUp = ComponentType<{
  to: number;
  from?: number;
  separator?: string;
  duration?: number;
  className?: string;
}>;

export type TiltedCard = ComponentType<{
  imageSrc: string;
  altText: string;
  captionText?: string;
  containerHeight?: string | number;
  containerWidth?: string | number;
  imageHeight?: string | number;
  imageWidth?: string | number;
  rotateAmplitude?: number;
  scaleOnHover?: number;
  showMobileWarning?: boolean;
  showTooltip?: boolean;
  displayOverlayContent?: boolean;
  overlayContent?: ReactNode;
}>;

export type Lanyard = ComponentType<{
  /** [x, y, z] — at fov 20 the z distance is the framing. */
  position?: [number, number, number];
  gravity?: [number, number, number];
  frontImage?: string;
  imageFit?: "cover" | "contain";
  /** The strap texture. Generated, so it stays on palette and tiles cleanly. */
  lanyardImage?: string;
  /** Wider than the library default, or the band is too narrow to read on. */
  lanyardWidth?: number;
  bandText?: string;
  bandTextColor?: string;
  bandColor?: string;
  bandTextRepeat?: number;
  bandTextSize?: number;
  fov?: number;
  transparent?: boolean;
  className?: string;
}>;
