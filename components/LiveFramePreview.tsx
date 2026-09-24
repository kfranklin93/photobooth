"use client";

import Image from "next/image";
import { useEffect, useRef, type RefObject } from "react";

import { ButterflyIcon } from "@/components/ButterflyIcon";
import { DEFAULT_CAPTURE_ASPECT, MIRROR } from "@/lib/camera";
import type { CameraState } from "@/lib/use-camera";

interface LiveFramePreviewProps {
  /** Shared feed from useCamera. Attached to this preview's own <video>. */
  stream: MediaStream | null;
  state: CameraState;
  /** Frame artwork drawn over the live feed. */
  overlaySrc?: string;
  /**
   * Optional ref onto the underlying <video>, for callers that need to grab a
   * frame from it.
   */
  videoRef?: RefObject<HTMLVideoElement | null>;
  /** Rendered over the feed, e.g. the countdown digit. */
  children?: React.ReactNode;
  className?: string;
  /** Smaller variant used inside the frame picker's option tiles. */
  compact?: boolean;
  /**
   * Shape of this preview, as width / height — the chosen frame's opening.
   * Frames differ, so the viewfinder follows whichever one is selected.
   */
  aspect?: number;
}

/**
 * The live camera feed with frame artwork on top.
 *
 * Shared by the frame picker and the capture screen so both show an identical
 * composition — the guest sees exactly the framing they'll get.
 *
 * Several of these can render at once from one MediaStream; each attaches the
 * stream to its own <video>, which browsers support.
 *
 * The overlay is decoration only and is never written into the captured file;
 * Canva applies the real frame during autofill.
 */
export function LiveFramePreview({
  stream,
  state,
  overlaySrc,
  videoRef,
  children,
  className = "",
  compact = false,
  aspect = DEFAULT_CAPTURE_ASPECT,
}: LiveFramePreviewProps) {
  const internalRef = useRef<HTMLVideoElement>(null);
  const ref = videoRef ?? internalRef;

  useEffect(() => {
    const video = ref.current;
    if (!video || !stream) return;
    video.srcObject = stream;
    // iOS needs an explicit play() after assigning srcObject.
    void video.play().catch(() => undefined);
    return () => {
      video.srcObject = null;
    };
  }, [stream, ref]);

  return (
    <div
      style={{ aspectRatio: aspect }}
      className={
        "relative w-full overflow-hidden bg-plum-950 " +
        (compact ? "rounded-2xl " : "rounded-3xl ") +
        className
      }
    >
      <video
        ref={ref}
        playsInline
        muted
        autoPlay
        aria-label="Live camera preview"
        className="h-full w-full object-cover"
        style={MIRROR ? { transform: "scaleX(-1)" } : undefined}
      />

      {overlaySrc ? (
        <Image
          src={overlaySrc}
          alt=""
          aria-hidden="true"
          fill
          unoptimized
          priority
          sizes={compact ? "200px" : "448px"}
          // `fill` (not `contain`) so the frame stretches edge to edge. The
          // artwork and the viewfinder are both 3:4, so nothing distorts — this
          // just removes the letterboxing `contain` leaves around the artwork.
          className="pointer-events-none object-fill"
        />
      ) : null}

      {state !== "live" ? (
        <div className="absolute inset-0 grid place-items-center bg-plum-950/80">
          <div className="flex flex-col items-center gap-3">
            <ButterflyIcon
              flapping
              className={
                compact ? "h-8 w-8 animate-breathe" : "h-12 w-12 animate-breathe"
              }
            />
            {!compact ? (
              <p className="font-body text-sm text-lavender-200">
                Waking up the camera&hellip;
              </p>
            ) : null}
          </div>
        </div>
      ) : null}

      {children}
    </div>
  );
}
