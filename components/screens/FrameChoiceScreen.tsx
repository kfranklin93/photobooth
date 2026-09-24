"use client";

import Image from "next/image";
import { useState } from "react";

import { BoothCard } from "@/components/BoothCard";
import { LiveFramePreview } from "@/components/LiveFramePreview";
import { PrimaryButton } from "@/components/PrimaryButton";
import { CAPTURE_ASPECT } from "@/lib/camera";
import { useCamera } from "@/lib/use-camera";
import type { PublicFrameOption } from "@/config/frames";

interface FrameChoiceScreenProps {
  frames: PublicFrameOption[];
  /** Pre-selects a frame when the guest comes back to change it. */
  initialFrameId?: string;
  onChoose: (frameId: string) => void;
  onBack: () => void;
}

/**
 * Tile columns. Deliberately count-independent so adding a sixth frame can't
 * silently produce an awkward orphan row: tiles wrap, and the container's
 * max-width keeps them a sensible size. Two very small sets get special cases
 * because 1-2 tiles in a 3-column grid look stranded.
 */
function gridClass(count: number): string {
  if (count === 1) return "grid-cols-1 max-w-[9rem]";
  if (count === 2) return "grid-cols-2 max-w-[19rem]";
  return "grid-cols-3 max-w-xs sm:max-w-sm lg:max-w-[22rem]";
}

/**
 * Step 1: pick a frame, before the photo is taken.
 *
 * Every option shows the live camera behind the frame artwork, so guests choose
 * by seeing themselves in each one rather than guessing from a swatch. A single
 * MediaStream feeds all of them — one `<video>` per tile plus the large preview,
 * all sharing the same `srcObject`.
 *
 * Layout stacks on phones and tablets (preview above tiles) and splits into two
 * columns from `lg` up, where there's width to show a large preview beside the
 * choices instead of pushing the buttons below the fold.
 */
export function FrameChoiceScreen({
  frames,
  initialFrameId,
  onChoose,
  onBack,
}: FrameChoiceScreenProps) {
  const { state, reason, stream } = useCamera();
  const [selected, setSelected] = useState<string>(
    initialFrameId ?? frames[0]?.id ?? "",
  );

  const selectedFrame = frames.find((frame) => frame.id === selected);
  const cameraWorks = state !== "unavailable";

  return (
    <BoothCard wide className="animate-rise" flourish={false}>
      <h1 className="font-display text-2xl sm:text-3xl lg:text-4xl">
        <span className="text-gold-shimmer">Pick your frame</span>
      </h1>
      <p className="mx-auto mt-2 max-w-lg font-body text-sm text-lavender-200 sm:mt-3 sm:text-base lg:text-lg">
        {cameraWorks
          ? "Tap a style to try it on. Your photo comes next."
          : "Choose a style, then we\u2019ll line up your photo inside it."}
      </p>

      <div className="mt-5 sm:mt-7 lg:flex lg:items-center lg:gap-10">
        {/* Large preview of the current choice. */}
        {cameraWorks ? (
          <div className="lg:flex-1">
            <LiveFramePreview
              stream={stream}
              state={state}
              overlaySrc={selectedFrame?.thumbnail}
              className="mx-auto max-h-[34vh] max-w-[13rem] border border-gold-200/40 shadow-[0_20px_60px_-20px_rgba(0,0,0,0.8)] xs:max-w-[15rem] sm:max-h-[38vh] sm:max-w-xs lg:max-h-none lg:max-w-sm"
            />
          </div>
        ) : null}

        <div className="lg:flex-1">
          <fieldset className="mt-5 lg:mt-0">
            <legend className="sr-only">Choose a frame style</legend>

            <div className={`mx-auto grid gap-2.5 sm:gap-3.5 ${gridClass(frames.length)}`}>
              {frames.map((frame) => {
                const isSelected = frame.id === selected;
                return (
                  <label
                    key={frame.id}
                    className={`group relative cursor-pointer rounded-xl border-2 p-1.5 text-center transition sm:rounded-2xl sm:p-2 ${
                      isSelected
                        ? "border-gold-200 bg-white/10 shadow-[0_0_24px_-6px_rgba(240,217,140,0.55)]"
                        : "border-lavender-200/25 bg-white/5 hover:border-gold-200/60"
                    }`}
                  >
                    <input
                      type="radio"
                      name="frame"
                      value={frame.id}
                      checked={isSelected}
                      onChange={() => setSelected(frame.id)}
                      className="sr-only"
                    />

                    {cameraWorks ? (
                      // Same stream as the big preview, so each tile is a live
                      // thumbnail of that frame on the guest.
                      <LiveFramePreview
                        stream={stream}
                        state={state}
                        overlaySrc={frame.thumbnail}
                        compact
                      />
                    ) : (
                      <div
                        style={{ aspectRatio: CAPTURE_ASPECT }}
                        className="relative w-full overflow-hidden rounded-lg bg-gradient-to-br from-violet-700 via-plum-800 to-plum-950 sm:rounded-2xl"
                      >
                        <Image
                          src={frame.thumbnail}
                          alt={`${frame.label} frame`}
                          fill
                          unoptimized
                          sizes="200px"
                          className="object-fill"
                        />
                      </div>
                    )}

                    <span className="mt-1.5 block font-display text-[0.7rem] leading-tight text-gold-200 sm:mt-2 sm:text-sm lg:text-base">
                      {frame.label}
                    </span>

                    {isSelected ? (
                      <span
                        aria-hidden="true"
                        className="absolute -top-1.5 -right-1.5 grid h-5 w-5 place-items-center rounded-full bg-gold-200 font-body text-[0.6rem] font-bold text-plum-950 sm:h-6 sm:w-6 sm:text-xs"
                      >
                        &#10003;
                      </span>
                    ) : null}
                  </label>
                );
              })}
            </div>
          </fieldset>
        </div>
      </div>

      {state === "unavailable" && reason ? (
        <p className="mt-4 font-body text-xs text-lavender-200/70 sm:text-sm">
          {reason}
        </p>
      ) : null}

      <div className="mt-7 flex flex-col-reverse gap-3 sm:mt-8 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <PrimaryButton
          variant="ghost"
          onClick={onBack}
          className="min-h-14 px-6 text-base sm:min-h-16 sm:px-8 sm:text-lg"
        >
          Start over
        </PrimaryButton>
        <PrimaryButton
          onClick={() => onChoose(selected)}
          disabled={!selected}
          className="sm:px-12"
        >
          Use this frame
        </PrimaryButton>
      </div>
    </BoothCard>
  );
}
