"use client";

import Link from "next/link";

import { BoothCard } from "@/components/BoothCard";
import { ButterflyIcon } from "@/components/ButterflyIcon";
import { PrimaryButton } from "@/components/PrimaryButton";

interface StartScreenProps {
  /** Full event name, shown small above the headline. */
  eventName: string;
  /** Short line under the headline. */
  tagline: string;
  /** Large display text. */
  headline: string;
  onStart: () => void;
  /** When set, offer a link back to the event chooser. */
  backToEventsHref?: string;
}

export function StartScreen({
  eventName,
  tagline,
  headline,
  onStart,
  backToEventsHref,
}: StartScreenProps) {
  return (
    <BoothCard className="animate-rise">
      <div className="flex justify-center">
        <ButterflyIcon
          flapping
          className="h-20 w-20 animate-flutter drop-shadow-[0_0_28px_rgba(192,132,252,0.55)] sm:h-28 sm:w-28 lg:h-32 lg:w-32"
        />
      </div>

      <p className="mt-5 font-body text-[0.7rem] tracking-[0.3em] text-lavender-200/80 uppercase sm:mt-6 sm:text-sm sm:tracking-[0.35em] lg:text-base">
        {eventName}
      </p>

      <h1 className="mt-3 font-display text-3xl leading-tight sm:mt-4 sm:text-5xl lg:text-6xl">
        <span className="text-gold-shimmer">{headline}</span>
        <span className="mt-1.5 block text-xl text-lavender-100 sm:mt-2 sm:text-3xl">
          Photo Booth
        </span>
      </h1>

      <p className="mx-auto mt-5 max-w-xl font-body text-base leading-relaxed text-lavender-200 sm:mt-6 sm:text-lg lg:text-xl">
        {tagline}. Strike a pose, and we&rsquo;ll frame it and send it straight to
        your inbox.
      </p>

      <div className="mt-8 sm:mt-10">
        <PrimaryButton
          onClick={onStart}
          className="min-h-20 w-full px-10 text-xl xs:w-auto sm:min-h-24 sm:px-14 sm:text-2xl lg:text-3xl"
        >
          Tap to Start
        </PrimaryButton>
      </div>

      {backToEventsHref ? (
        <p className="mt-6">
          <Link
            href={backToEventsHref}
            className="font-body text-xs text-lavender-200/60 underline decoration-dotted underline-offset-4 transition hover:text-lavender-100 sm:text-sm"
          >
            Different party?
          </Link>
        </p>
      ) : null}
    </BoothCard>
  );
}
