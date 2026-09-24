"use client";

import { useId, useState } from "react";

import { BoothCard } from "@/components/BoothCard";
import { ButterflyIcon } from "@/components/ButterflyIcon";
import { PrimaryButton } from "@/components/PrimaryButton";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

interface EmailScreenProps {
  /** How many photos are being sent, so the copy can match. */
  photoCount: number;
  onSubmit: (email: string) => void;
  onBack: () => void;
  initialError?: string;
}

/** Final step: where should the finished photos go? */
export function EmailScreen({
  photoCount,
  onSubmit,
  onBack,
  initialError,
}: EmailScreenProps) {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(initialError ?? null);

  const emailFieldId = useId();
  const errorId = useId();

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = email.trim();
    if (!EMAIL_PATTERN.test(trimmed)) {
      setError("Please enter an email address we can send your photo to.");
      return;
    }
    setError(null);
    onSubmit(trimmed);
  }

  return (
    <BoothCard className="animate-rise">
      <div className="flex justify-center">
        <ButterflyIcon
          flapping
          className="h-14 w-14 animate-flutter drop-shadow-[0_0_20px_rgba(240,217,140,0.45)] sm:h-16 sm:w-16"
        />
      </div>

      <h1 className="mt-5 font-display text-2xl sm:mt-6 sm:text-3xl lg:text-4xl">
        <span className="text-gold-shimmer">
          {photoCount > 1 ? "Where should we send them?" : "Where should we send it?"}
        </span>
      </h1>
      <p className="mx-auto mt-3 max-w-lg font-body text-base text-lavender-200 sm:text-lg">
        {photoCount > 1
          ? `Pop in your email and all ${photoCount} photos will be waiting for you.`
          : "Pop in your email and your photo will be waiting for you."}
      </p>

      <form onSubmit={handleSubmit} className="mt-8 space-y-6 text-left">
        <div className="space-y-3">
          <label htmlFor={emailFieldId} className="sr-only">
            Email address
          </label>
          <input
            id={emailFieldId}
            name="email"
            type="email"
            required
            autoFocus
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@example.com"
            inputMode="email"
            autoComplete="email"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            aria-describedby={error ? errorId : undefined}
            aria-invalid={error ? true : undefined}
            className="min-h-16 w-full rounded-2xl border border-lavender-200/30 bg-plum-950/60 px-4 text-center font-body text-lg text-blush-50 placeholder:text-lavender-200/45 focus:border-gold-200 focus:outline-none sm:min-h-20 sm:px-6 sm:text-2xl"
          />
        </div>

        <p
          id={errorId}
          role="status"
          aria-live="polite"
          className={`min-h-6 text-center font-body text-base ${
            error ? "text-gold-200" : "text-transparent"
          }`}
        >
          {error ?? "\u00A0"}
        </p>

        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
          <PrimaryButton
            variant="ghost"
            onClick={onBack}
            className="min-h-14 px-6 text-base sm:min-h-16 sm:px-8 sm:text-lg"
          >
            Back
          </PrimaryButton>
          <PrimaryButton type="submit" className="sm:px-12">
            {photoCount > 1 ? `Send my ${photoCount} photos` : "Send my photo"}
          </PrimaryButton>
        </div>
      </form>
    </BoothCard>
  );
}
