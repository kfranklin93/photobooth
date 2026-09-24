"use client";

import { useCallback, useMemo, useRef, useState } from "react";

import { ButterflyBackdrop } from "@/components/ButterflyBackdrop";
import { CaptureScreen } from "@/components/screens/CaptureScreen";
import { EmailScreen } from "@/components/screens/EmailScreen";
import { FrameChoiceScreen } from "@/components/screens/FrameChoiceScreen";
import { ProcessingScreen } from "@/components/screens/ProcessingScreen";
import { StartScreen } from "@/components/screens/StartScreen";
import { SuccessScreen } from "@/components/screens/SuccessScreen";
import { useWakeLock } from "@/lib/use-wake-lock";
import type { PublicFrameOption } from "@/config/frames";

/**
 * Flow order matters: the frame is chosen before the photo so the live
 * viewfinder can show it, letting guests pose inside their frame.
 */
type Step = "idle" | "frame" | "capture" | "email" | "processing" | "success";

/** Give up before the platform's own function timeout bites. */
const REQUEST_TIMEOUT_MS = 4 * 60 * 1000;

interface ProcessPhotoResponse {
  ok: boolean;
  message?: string;
  detail?: string;
}

/** The event's presentation details. No Canva IDs reach the browser. */
export interface BoothEventInfo {
  slug: string;
  name: string;
  tagline: string;
  headline: string;
  palette: string;
}

interface PhotoBoothProps {
  event: BoothEventInfo;
  frames: PublicFrameOption[];
  /** Offer a way back to the chooser, when there's more than one event. */
  showBackToEvents?: boolean;
}

export function PhotoBooth({
  event,
  frames,
  showBackToEvents = false,
}: PhotoBoothProps) {
  const [step, setStep] = useState<Step>("idle");
  const [frameId, setFrameId] = useState<string>("");
  /** Up to MAX_PHOTOS, all sent in a single email. */
  const [photos, setPhotos] = useState<File[]>([]);
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | undefined>(undefined);

  // Keeps the tablet awake for the whole session.
  useWakeLock();

  const abortRef = useRef<AbortController | null>(null);

  const selectedFrame = useMemo(
    () => frames.find((frame) => frame.id === frameId),
    [frames, frameId],
  );

  const reset = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setFrameId("");
    setPhotos([]);
    setEmail("");
    setError(undefined);
    setStep("idle");
  }, []);

  /** Single frame configured? Skip the picker entirely. */
  const handleStart = useCallback(() => {
    setError(undefined);
    if (frames.length === 1) {
      setFrameId(frames[0].id);
      setStep("capture");
      return;
    }
    setStep("frame");
  }, [frames]);

  const handleChooseFrame = useCallback((chosen: string) => {
    setFrameId(chosen);
    setError(undefined);
    setStep("capture");
  }, []);

  const handleChangeFrame = useCallback(() => {
    setError(undefined);
    // With one frame there's nothing to change, so this doubles as a restart.
    setStep(frames.length === 1 ? "idle" : "frame");
  }, [frames.length]);

  const handlePhotosDone = useCallback((taken: File[]) => {
    if (taken.length === 0) return;
    setPhotos(taken);
    setError(undefined);
    setStep("email");
  }, []);

  const handleSubmit = useCallback(
    async (guestEmail: string) => {
      if (photos.length === 0) {
        setStep("capture");
        return;
      }

      setEmail(guestEmail);
      setError(undefined);
      setStep("processing");

      const controller = new AbortController();
      abortRef.current = controller;
      const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

      try {
        const body = new FormData();
        // Repeated `photo` fields; the route reads them with form.getAll().
        photos.forEach((photo, index) => {
          body.append("photo", photo, photo.name || `photo-${index + 1}.jpg`);
        });
        body.append("email", guestEmail);
        body.append("frameId", frameId);
        // Scopes the frame lookup to this event, so a frame id can't resolve
        // against another party's designs.
        body.append("eventSlug", event.slug);

        const response = await fetch("/api/process-photo", {
          method: "POST",
          body,
          signal: controller.signal,
        });

        const payload = (await response
          .json()
          .catch(() => null)) as ProcessPhotoResponse | null;

        if (!response.ok || !payload?.ok) {
          // `detail` is operator-facing; surface it in the console only.
          if (payload?.detail) console.error("[photo-booth]", payload.detail);
          setError(
            payload?.message ??
              "Something went wrong sending your photo. Please try again.",
          );
          setStep("email");
          return;
        }

        setStep("success");
      } catch (caught) {
        const aborted =
          caught instanceof DOMException && caught.name === "AbortError";
        console.error("[photo-booth]", caught);
        setError(
          aborted
            ? "That took longer than expected. Please try once more."
            : "We could not reach the photo booth. Please try again.",
        );
        setStep("email");
      } finally {
        clearTimeout(timeout);
        abortRef.current = null;
      }
    },
    [photos, frameId, event.slug],
  );

  return (
    <main
      data-palette={event.palette}
      className="booth-surface relative flex min-h-dvh flex-col items-center
                 justify-center px-3 py-6 xs:px-4 sm:px-6 sm:py-10 lg:px-8"
    >
      <ButterflyBackdrop />

      {step === "idle" ? (
        <StartScreen
          eventName={event.name}
          tagline={event.tagline}
          headline={event.headline}
          onStart={handleStart}
          backToEventsHref={showBackToEvents ? "/" : undefined}
        />
      ) : null}

      {step === "frame" ? (
        <FrameChoiceScreen
          frames={frames}
          initialFrameId={frameId || undefined}
          onChoose={handleChooseFrame}
          onBack={reset}
        />
      ) : null}

      {step === "capture" ? (
        <CaptureScreen
          onDone={handlePhotosDone}
          onChangeFrame={handleChangeFrame}
          overlaySrc={selectedFrame?.thumbnail}
          frameLabel={frames.length > 1 ? selectedFrame?.label : undefined}
          aspect={selectedFrame?.aspect}
          initialError={error}
        />
      ) : null}

      {step === "email" ? (
        <EmailScreen
          photoCount={photos.length}
          onSubmit={handleSubmit}
          onBack={() => setStep("capture")}
          initialError={error}
        />
      ) : null}

      {step === "processing" ? (
        <ProcessingScreen photoCount={photos.length} />
      ) : null}

      {step === "success" ? (
        <SuccessScreen
          email={email}
          photoCount={photos.length}
          onReset={reset}
        />
      ) : null}
    </main>
  );
}
