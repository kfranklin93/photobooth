"use client";

import { useEffect, useState } from "react";

import { BoothCard } from "@/components/BoothCard";
import { ButterflyIcon } from "@/components/ButterflyIcon";
import { PrimaryButton } from "@/components/PrimaryButton";

const AUTO_RESET_SECONDS = 10;

interface SuccessScreenProps {
  email: string;
  /** How many photos were sent, so the copy can match. */
  photoCount?: number;
  /** Called when the countdown finishes or the guest taps the button. */
  onReset: () => void;
}

export function SuccessScreen({
  email,
  photoCount = 1,
  onReset,
}: SuccessScreenProps) {
  const [secondsLeft, setSecondsLeft] = useState(AUTO_RESET_SECONDS);

  useEffect(() => {
    const timer = setInterval(() => {
      setSecondsLeft((current) => Math.max(0, current - 1));
    }, 1_000);
    return () => clearInterval(timer);
  }, []);

  // Reset via an effect rather than inside the interval so onReset can change
  // without restarting the countdown.
  useEffect(() => {
    if (secondsLeft === 0) onReset();
  }, [secondsLeft, onReset]);

  return (
    <BoothCard className="animate-rise">
      <div className="flex justify-center gap-2 sm:gap-3">
        <ButterflyIcon
          flapping
          className="h-11 w-11 animate-flutter opacity-80 [animation-delay:-1s] sm:h-16 sm:w-16"
        />
        <ButterflyIcon
          flapping
          className="h-16 w-16 animate-flutter drop-shadow-[0_0_28px_rgba(240,217,140,0.55)] sm:h-24 sm:w-24"
        />
        <ButterflyIcon
          flapping
          className="h-11 w-11 animate-flutter opacity-80 [animation-delay:-2.2s] sm:h-16 sm:w-16"
        />
      </div>

      <h1 className="mt-6 font-display text-3xl leading-tight sm:mt-8 sm:text-4xl lg:text-5xl">
        <span className="text-gold-shimmer">
          {photoCount > 1
            ? "Your photos are on their way!"
            : "Your photo is on its way!"}
        </span>
      </h1>

      <p
        role="status"
        aria-live="polite"
        className="mx-auto mt-5 max-w-xl font-body text-base text-lavender-200 sm:mt-6 sm:text-lg lg:text-xl"
      >
        We just sent {photoCount > 1 ? `all ${photoCount}` : "it"} to{" "}
        <span className="font-semibold break-all text-blush-50">{email}</span>.
        Check your inbox in a moment.
      </p>

      <div className="mt-8 sm:mt-10">
        <PrimaryButton
          variant="violet"
          onClick={onReset}
          className="w-full px-10 xs:w-auto sm:px-12"
        >
          Take another photo
        </PrimaryButton>
      </div>

      <p className="mt-5 font-body text-xs text-lavender-200/70 sm:mt-6 sm:text-sm">
        Returning to the start in {secondsLeft}
        {secondsLeft === 1 ? " second" : " seconds"}
      </p>
    </BoothCard>
  );
}
