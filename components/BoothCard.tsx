import type { ReactNode } from "react";

import { ButterflyIcon } from "@/components/ButterflyIcon";

interface BoothCardProps {
  children: ReactNode;
  className?: string;
  /** Show the small gold butterfly flourish at the bottom of the card. */
  flourish?: boolean;
  /** Widen the card on large screens. Used by the frame picker. */
  wide?: boolean;
}

/**
 * Frosted, gold-edged panel that holds each step of the booth flow.
 *
 * Scales across three targets: a phone held in portrait, the iPad the booth
 * actually runs on, and a desktop browser. Radii, padding, and the inner
 * hairline all step up together so the framing keeps its proportions rather
 * than looking like a phone layout stretched wide.
 */
export function BoothCard({
  children,
  className = "",
  flourish = true,
  wide = false,
}: BoothCardProps) {
  return (
    <div
      className={
        "relative w-full rounded-3xl border border-gold-200/35 bg-plum-900/45 " +
        "px-4 py-7 text-center shadow-[0_30px_90px_-30px_rgba(0,0,0,0.8)] " +
        "backdrop-blur-md " +
        "xs:px-6 sm:rounded-[2.25rem] sm:px-8 sm:py-10 " +
        "lg:rounded-[2.5rem] lg:px-12 lg:py-12 " +
        (wide ? "max-w-md sm:max-w-2xl lg:max-w-4xl " : "max-w-md sm:max-w-xl lg:max-w-2xl ") +
        className
      }
    >
      {/* Inner hairline for a layered, framed look. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-2 rounded-[1.4rem] border border-gold-200/15 sm:inset-3 sm:rounded-[1.9rem] lg:rounded-[2rem]"
      />

      <div className="relative">{children}</div>

      {flourish ? (
        <div
          aria-hidden="true"
          className="mt-6 flex items-center justify-center gap-3 text-gold-300/70 sm:mt-8 sm:gap-4"
        >
          <span className="h-px w-10 bg-gradient-to-r from-transparent to-gold-300/60 sm:w-16" />
          <ButterflyIcon className="h-5 w-5 sm:h-6 sm:w-6" />
          <span className="h-px w-10 bg-gradient-to-l from-transparent to-gold-300/60 sm:w-16" />
        </div>
      ) : null}
    </div>
  );
}
