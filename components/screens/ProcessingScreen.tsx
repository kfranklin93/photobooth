"use client";

import { useEffect, useState } from "react";

import { BoothCard } from "@/components/BoothCard";
import { ButterflyIcon } from "@/components/ButterflyIcon";

/**
 * Rotating reassurance copy. The Canva round trip usually takes 20-60s, which
 * is long enough that a single static message starts to feel stuck.
 */
const MESSAGES = [
  "Adding butterfly magic\u2026",
  "Dusting the edges with gold\u2026",
  "Framing your portrait\u2026",
  "Almost ready\u2026",
] as const;

const MESSAGE_INTERVAL_MS = 4_000;

interface ProcessingScreenProps {
  /** How many photos are being rendered, so the copy can match. */
  photoCount?: number;
}

export function ProcessingScreen({ photoCount = 1 }: ProcessingScreenProps) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setIndex((current) => (current + 1) % MESSAGES.length);
    }, MESSAGE_INTERVAL_MS);
    return () => clearInterval(timer);
  }, []);

  return (
    <BoothCard className="animate-rise">
      <div className="flex justify-center">
        <div className="relative grid h-28 w-28 place-items-center sm:h-40 sm:w-40">
          {/* Spinner ring */}
          <span
            aria-hidden="true"
            className="absolute inset-0 animate-spin rounded-full border-4 border-lavender-200/15 border-t-gold-200 border-r-orchid-300 [animation-duration:1.4s]"
          />
          <ButterflyIcon
            flapping
            className="h-14 w-14 animate-breathe drop-shadow-[0_0_24px_rgba(240,217,140,0.5)] sm:h-20 sm:w-20"
          />
        </div>
      </div>

      {/* One live region announcing progress, politely. */}
      <p
        role="status"
        aria-live="polite"
        className="mt-7 font-display text-xl text-gold-200 sm:mt-10 sm:text-2xl lg:text-3xl"
      >
        {MESSAGES[index]}
      </p>

      <p className="mx-auto mt-3 max-w-md font-body text-sm text-lavender-200 sm:mt-4 sm:text-base lg:text-lg">
        {photoCount > 1
          ? `Framing all ${photoCount} photos. Hold tight and keep this screen open.`
          : "Hold tight and keep this screen open. This usually takes under a minute."}
      </p>
    </BoothCard>
  );
}
