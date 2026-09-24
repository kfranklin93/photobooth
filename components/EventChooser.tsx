import Link from "next/link";

import { BoothCard } from "@/components/BoothCard";
import { ButterflyBackdrop } from "@/components/ButterflyBackdrop";
import { ButterflyIcon } from "@/components/ButterflyIcon";
import type { PublicEventOption } from "@/config/events";

interface EventChooserProps {
  events: PublicEventOption[];
}

/**
 * Landing page when more than one event is live.
 *
 * Server-rendered and link-based rather than a client state machine: each card
 * is a real navigation to `/<slug>`, so the host can bookmark or QR-code an
 * event directly and skip this screen.
 *
 * Each card previews its own palette via data-palette, so the choice reads
 * visually rather than only as text.
 */
export function EventChooser({ events }: EventChooserProps) {
  return (
    <main className="booth-surface relative flex min-h-dvh flex-col items-center justify-center px-3 py-6 xs:px-4 sm:px-6 sm:py-10 lg:px-8">
      <ButterflyBackdrop />

      <BoothCard wide className="animate-rise">
        <div className="flex justify-center">
          <ButterflyIcon
            flapping
            className="h-16 w-16 animate-flutter drop-shadow-[0_0_28px_rgba(192,132,252,0.55)] sm:h-20 sm:w-20"
          />
        </div>

        <h1 className="mt-5 font-display text-2xl leading-tight sm:mt-6 sm:text-4xl lg:text-5xl">
          <span className="text-gold-shimmer">Choose your party</span>
        </h1>
        <p className="mx-auto mt-3 max-w-lg font-body text-sm text-lavender-200 sm:text-base lg:text-lg">
          Pick the celebration you&rsquo;re here for.
        </p>

        <ul
          className={`mx-auto mt-7 grid gap-4 sm:mt-9 sm:gap-5 ${
            events.length === 2
              ? "max-w-2xl grid-cols-1 sm:grid-cols-2"
              : "max-w-3xl grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
          }`}
        >
          {events.map((event) => (
            <li key={event.slug}>
              <Link
                href={`/${event.slug}`}
                data-palette={event.palette}
                className="booth-surface group flex min-h-40 flex-col items-center justify-center gap-2 rounded-3xl border-2 border-gold-200/35 p-6 text-center transition hover:border-gold-200 hover:shadow-[0_0_34px_-8px_rgba(240,217,140,0.5)] focus-visible:border-gold-200 sm:min-h-48"
              >
                <ButterflyIcon className="h-9 w-9 opacity-80 transition group-hover:opacity-100 sm:h-11 sm:w-11" />
                <span className="mt-1 font-display text-xl text-gold-200 sm:text-2xl">
                  {event.shortName}
                </span>
                <span className="font-body text-xs text-lavender-200/80 sm:text-sm">
                  {event.tagline}
                </span>
                <span className="mt-2 font-body text-[0.7rem] tracking-widest text-lavender-200/55 uppercase">
                  {event.frameCount} {event.frameCount === 1 ? "frame" : "frames"}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </BoothCard>
    </main>
  );
}
