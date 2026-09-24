"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";

import { BoothCard } from "@/components/BoothCard";
import { ButterflyIcon } from "@/components/ButterflyIcon";
import { CameraCapture } from "@/components/CameraCapture";
import { PrimaryButton } from "@/components/PrimaryButton";
import { CAPTURE_ASPECT } from "@/lib/camera";
import { MAX_PHOTOS } from "@/config/booth";

const MAX_PHOTO_BYTES = 20 * 1024 * 1024;

interface CaptureScreenProps {
  /** Called with every kept photo once the guest is ready to send. */
  onDone: (photos: File[]) => void;
  /** Go back to the frame picker. */
  onChangeFrame: () => void;
  /** Frame artwork shown over the viewfinder and every review shot. */
  overlaySrc?: string;
  frameLabel?: string;
  /** Error carried over from a failed send. */
  initialError?: string;
}

/** A photo plus the blob URL used to display it. */
interface Shot {
  file: File;
  url: string;
}

/**
 * Step 2: take up to MAX_PHOTOS, with the chosen frame overlaid so the guest can
 * pose inside it.
 *
 * Taking more than one is opt-in: after keeping a shot the guest can send what
 * they have or take another, and the camera simply reappears. Nobody is forced
 * through three rounds to get one photo.
 *
 * The overlay is preview decoration only. The files handed upward are clean
 * camera frames — Canva applies the real frame during autofill.
 */
export function CaptureScreen({
  onDone,
  onChangeFrame,
  overlaySrc,
  frameLabel,
  initialError,
}: CaptureScreenProps) {
  const [kept, setKept] = useState<Shot[]>([]);
  const [review, setReview] = useState<Shot | null>(null);
  const [error, setError] = useState<string | null>(initialError ?? null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Every blob URL this screen creates, so they can all be released on unmount.
  // Tracked in a ref rather than derived from state, so cleanup never depends on
  // which render it runs in.
  const urlsRef = useRef<string[]>([]);
  useEffect(() => {
    const urls = urlsRef.current;
    return () => {
      urls.forEach((url) => URL.revokeObjectURL(url));
      urlsRef.current = [];
    };
  }, []);

  function track(file: File): Shot {
    const url = URL.createObjectURL(file);
    urlsRef.current.push(url);
    return { file, url };
  }

  function acceptFile(file: File) {
    if (!file.type.startsWith("image/")) {
      setError("That file is not a photo. Please try again.");
      return;
    }
    if (file.size > MAX_PHOTO_BYTES) {
      setError("That photo is a little too large. Please take another one.");
      return;
    }
    setError(null);
    setReview(track(file));
  }

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file) acceptFile(file);
  }

  /** Keep the reviewed shot and return to the camera (or the send prompt). */
  function handleKeep() {
    if (!review) return;
    setKept((current) => [...current, review]);
    setReview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  /** Discard the reviewed shot without keeping it. */
  function handleRetake() {
    if (review) {
      URL.revokeObjectURL(review.url);
      urlsRef.current = urlsRef.current.filter((u) => u !== review.url);
    }
    setReview(null);
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function handleRemove(index: number) {
    setKept((current) => {
      const shot = current[index];
      if (shot) {
        URL.revokeObjectURL(shot.url);
        urlsRef.current = urlsRef.current.filter((u) => u !== shot.url);
      }
      return current.filter((_, i) => i !== index);
    });
  }

  const atLimit = kept.length >= MAX_PHOTOS;
  const remaining = MAX_PHOTOS - kept.length;

  const heading = review
    ? "Keep this one?"
    : atLimit
      ? `That's all ${MAX_PHOTOS}!`
      : kept.length === 0
        ? "Smile!"
        : "One more?";

  const subheading = review
    ? "Keep it, or take it again."
    : atLimit
      ? "Send them now, or swap one out."
      : kept.length === 0
        ? `Pose inside the frame, then tap the button. You can take up to ${MAX_PHOTOS}.`
        : `You can add ${remaining} more, or send what you have.`;

  return (
    <BoothCard className="animate-rise" flourish={false}>
      <h1 className="font-display text-2xl sm:text-3xl lg:text-4xl">
        <span className="text-gold-shimmer">{heading}</span>
      </h1>
      <p className="mx-auto mt-2 max-w-lg font-body text-sm text-lavender-200 sm:mt-3 sm:text-base lg:text-lg">
        {subheading}
      </p>

      <div className="mt-5 sm:mt-7">
        {/* Fallback picker, used only when the live camera is unavailable. */}
        <input
          ref={fileInputRef}
          id="booth-photo"
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          className="sr-only"
        />

        {review ? (
          <div className="space-y-5">
            <div
              style={{ aspectRatio: CAPTURE_ASPECT }}
              className="relative mx-auto max-h-[40vh] w-full max-w-[13rem] overflow-hidden rounded-2xl border border-gold-200/40 bg-plum-950 shadow-[0_20px_60px_-20px_rgba(0,0,0,0.8)] xs:max-w-[15rem] sm:max-h-[46vh] sm:max-w-sm sm:rounded-3xl"
            >
              <Image
                src={review.url}
                alt="The photo you just took"
                fill
                unoptimized
                sizes="384px"
                className="object-cover"
              />
              {overlaySrc ? (
                <Image
                  src={overlaySrc}
                  alt=""
                  aria-hidden="true"
                  fill
                  unoptimized
                  sizes="384px"
                  className="pointer-events-none object-fill"
                />
              ) : null}
            </div>

            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-center sm:gap-5">
              <PrimaryButton
                variant="ghost"
                onClick={handleRetake}
                className="min-h-14 px-6 text-base sm:min-h-16 sm:px-8 sm:text-lg"
              >
                Take it again
              </PrimaryButton>
              <PrimaryButton onClick={handleKeep} className="sm:px-12">
                Keep it
              </PrimaryButton>
            </div>
          </div>
        ) : atLimit ? (
          // Limit reached: no viewfinder, just the filmstrip and the send button.
          <div className="grid place-items-center py-6">
            <ButterflyIcon flapping className="h-20 w-20 animate-flutter" />
          </div>
        ) : (
          <CameraCapture
            onCapture={acceptFile}
            overlaySrc={overlaySrc}
            fallback={
              <label
                htmlFor="booth-photo"
                className="flex min-h-56 cursor-pointer flex-col items-center justify-center gap-4 rounded-3xl border-2 border-dashed border-gold-200/45 bg-white/5 p-8 text-center transition hover:border-gold-200/80 hover:bg-white/10 focus-within:border-gold-200"
              >
                <ButterflyIcon flapping className="h-16 w-16 animate-breathe" />
                <span className="font-display text-2xl text-gold-200">
                  Tap to choose your photo
                </span>
                <span className="font-body text-sm text-lavender-200/80">
                  Take a new one or pick a favourite
                </span>
              </label>
            }
          />
        )}
      </div>

      {/* Filmstrip of kept shots. Doubles as the progress indicator. */}
      {kept.length > 0 && !review ? (
        <div className="mt-5 sm:mt-7">
          <p className="font-body text-xs tracking-widest text-lavender-200/70 uppercase sm:text-sm">
            {kept.length} of {MAX_PHOTOS} kept
          </p>
          <ul className="mt-3 flex items-center justify-center gap-2.5 sm:gap-3">
            {kept.map((shot, index) => (
              <li key={shot.url} className="relative">
                <div
                  style={{ aspectRatio: CAPTURE_ASPECT }}
                  className="relative w-16 overflow-hidden rounded-lg border border-gold-200/40 xs:w-20 sm:w-24 sm:rounded-xl"
                >
                  <Image
                    src={shot.url}
                    alt={`Kept photo ${index + 1}`}
                    fill
                    unoptimized
                    sizes="96px"
                    className="object-cover"
                  />
                  {overlaySrc ? (
                    <Image
                      src={overlaySrc}
                      alt=""
                      aria-hidden="true"
                      fill
                      unoptimized
                      sizes="96px"
                      className="pointer-events-none object-fill"
                    />
                  ) : null}
                </div>
                <button
                  type="button"
                  onClick={() => handleRemove(index)}
                  aria-label={`Remove photo ${index + 1}`}
                  className="absolute -top-2 -right-2 grid h-7 w-7 place-items-center rounded-full bg-plum-900 font-body text-xs text-lavender-100 ring-1 ring-gold-200/50 transition hover:bg-violet-700 sm:h-8 sm:w-8 sm:text-sm"
                >
                  &#10005;
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {/* Live region so screen readers announce problems. */}
      <p
        role="status"
        aria-live="polite"
        className={`mt-5 min-h-6 font-body text-base ${
          error ? "text-gold-200" : "text-transparent"
        }`}
      >
        {error ?? "\u00A0"}
      </p>

      {!review ? (
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
          <PrimaryButton
            variant="ghost"
            onClick={onChangeFrame}
            className="min-h-14 px-5 text-sm sm:min-h-16 sm:px-8 sm:text-lg"
          >
            {frameLabel ? `Frame: ${frameLabel}` : "Change frame"}
          </PrimaryButton>
          {kept.length > 0 ? (
            <PrimaryButton
              onClick={() => onDone(kept.map((shot) => shot.file))}
              className="sm:px-12"
            >
              {kept.length > 1 ? `Send these ${kept.length}` : "Send my photo"}
            </PrimaryButton>
          ) : null}
        </div>
      ) : null}
    </BoothCard>
  );
}
