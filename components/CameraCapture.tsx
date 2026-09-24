"use client";

import { useEffect, useRef, useState } from "react";

import { LiveFramePreview } from "@/components/LiveFramePreview";
import { PrimaryButton } from "@/components/PrimaryButton";
import { grabFrameFromVideo } from "@/lib/camera";
import { useCamera } from "@/lib/use-camera";

/**
 * Live camera viewfinder with a countdown.
 *
 * Why not `<input type="file" capture>`: iOS Safari ignores the `capture`
 * attribute and always shows its own action sheet (Photo Library / Take Photo /
 * Choose File), so a guest never gets a camera. getUserMedia gives a real
 * in-page viewfinder instead, which is what makes this feel like a photo booth.
 */

interface CameraCaptureProps {
  onCapture: (photo: File) => void;
  /** Rendered when the camera can't be used, so the guest still has a path. */
  fallback: React.ReactNode;
  /**
   * Frame artwork drawn over the live preview so the guest can pose inside it.
   *
   * Preview only — deliberately NOT written into the captured JPEG. Canva
   * applies the real frame during autofill, so burning it in here would give
   * the guest a photo with two frames stacked on top of each other.
   */
  overlaySrc?: string;
}

export function CameraCapture({
  onCapture,
  fallback,
  overlaySrc,
}: CameraCaptureProps) {
  const { state, reason, stream } = useCamera();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [countdown, setCountdown] = useState<number | null>(null);

  // Runs the 3-2-1 countdown, then captures.
  useEffect(() => {
    if (countdown === null) return;

    if (countdown === 0) {
      void (async () => {
        const video = videoRef.current;
        const photo = video ? await grabFrameFromVideo(video) : null;
        setCountdown(null);
        if (photo) onCapture(photo);
      })();
      return;
    }

    const timer = setTimeout(() => setCountdown(countdown - 1), 1_000);
    return () => clearTimeout(timer);
  }, [countdown, onCapture, videoRef]);

  if (state === "unavailable") {
    return (
      <div className="space-y-4">
        {fallback}
        {reason ? (
          <p className="text-center font-body text-sm text-lavender-200/70">
            {reason}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <LiveFramePreview
        stream={stream}
        state={state}
        videoRef={videoRef}
        overlaySrc={overlaySrc}
        className="mx-auto max-h-[40vh] max-w-[13rem] border border-gold-200/40 shadow-[0_20px_60px_-20px_rgba(0,0,0,0.8)] xs:max-w-[15rem] sm:max-h-[46vh] sm:max-w-sm lg:max-w-md"
      >
        {countdown !== null && countdown > 0 ? (
          <div
            role="status"
            aria-live="assertive"
            className="absolute inset-0 grid place-items-center bg-plum-950/45"
          >
            <span className="font-display text-[5rem] leading-none text-gold-200 drop-shadow-[0_0_30px_rgba(240,217,140,0.6)] sm:text-[7rem] lg:text-[8rem]">
              {countdown}
            </span>
          </div>
        ) : null}
      </LiveFramePreview>

      <div className="flex justify-center">
        <PrimaryButton
          onClick={() => setCountdown(3)}
          disabled={state !== "live" || countdown !== null}
          className="min-h-20 w-full px-10 text-xl xs:w-auto sm:min-h-24 sm:px-14 sm:text-2xl"
        >
          {countdown !== null ? "Get ready\u2026" : "Take my photo"}
        </PrimaryButton>
      </div>
    </div>
  );
}
