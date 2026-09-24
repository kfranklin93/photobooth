import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PhotoBooth } from "@/components/PhotoBooth";
import { findEvent, eventFrames, getLiveEvents } from "@/config/events";
import { toPublicFrames } from "@/config/frames";

/** Pre-render a route per live event. */
export function generateStaticParams() {
  return getLiveEvents().map((event) => ({ event: event.slug }));
}

export async function generateMetadata({
  params,
}: PageProps<"/[event]">): Promise<Metadata> {
  const { event: slug } = await params;
  const event = findEvent(slug);
  if (!event) return { title: "Photo Booth" };

  return {
    title: `${event.name} Photo Booth`,
    description: `Tap, smile, and we'll send your framed keepsake straight to your inbox.`,
  };
}

/**
 * One event's booth. Unknown or unfinished slugs 404 rather than rendering a
 * booth that can't produce a photo.
 */
export default async function EventBoothPage({ params }: PageProps<"/[event]">) {
  const { event: slug } = await params;
  const event = findEvent(slug);

  if (!event) notFound();

  return (
    <PhotoBooth
      event={{
        slug: event.slug,
        name: event.name,
        tagline: event.tagline,
        headline: event.headline,
        palette: event.palette,
      }}
      frames={toPublicFrames(eventFrames(event), event.captureAspect)}
      showBackToEvents={getLiveEvents().length > 1}
    />
  );
}
