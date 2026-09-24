/**
 * The events this booth can run.
 *
 * One deployment serves several parties. Each event owns its own frames, copy,
 * and colour palette, and lives at its own URL (`/baby-shower`, `/sleepover`),
 * so a QR code can point straight at the right one and guests never see another
 * party's frames.
 *
 * To add an event: build the Canva designs, name a `guest_photo` frame field in
 * each, export the artwork to `public/frames/`, then add an entry here.
 */

import { isFrameReady, type FrameOption, type PublicFrameOption } from "@/config/frames";

/** Palette keys implemented in app/globals.css under [data-palette]. */
export type EventPalette = "butterfly" | "sleepover";

export interface BoothEvent {
  /** URL segment. Stable — it's what QR codes encode. */
  slug: string;
  /** Full name, used on the landing screen and in email copy. */
  name: string;
  /** Short line under the name on the chooser and landing screen. */
  tagline: string;
  /** Two-word-ish label for the chooser card. */
  shortName: string;
  /** Colour scheme. See [data-palette] in app/globals.css. */
  palette: EventPalette;
  /** Headline shown on the booth's landing screen. */
  headline: string;
  /** Emoji used in the email subject line. */
  emailEmoji: string;
  /**
   * Default photo shape for this event's frames, as width / height. Individual
   * frames can override it with their own `aspect`.
   */
  captureAspect: number;
  frames: FrameOption[];
}

export const EVENTS: BoothEvent[] = [
  {
    slug: "baby-shower",
    name: "Princess Butterflies Baby Shower",
    shortName: "Baby Shower",
    tagline: "Princess Butterflies",
    headline: "Princess Butterflies",
    palette: "butterfly",
    emailEmoji: "\u{1F98B}", // butterfly
    // All five openings are 3:4 portrait.
    captureAspect: 3 / 4,
    frames: [
      {
        id: "frame-one",
        // `label` and `description` are placeholder names — rename them freely,
        // they're what guests see. Leave `id` alone: the kiosk posts it to the API.
        label: "Lavender Wings",
        description: "Soft violet butterflies",
        thumbnail: "/frames/frame-1.png",
        designId: "DAHWFL8hvaw", // Canva title: frame2trnsparnt
      },
      {
        id: "frame-two",
        label: "Golden Flutter",
        description: "Gold foil and shimmer",
        thumbnail: "/frames/frame-2.png",
        designId: "DAHWFJWEFAo", // Canva title: frame3trnsprt
      },
      {
        id: "frame-three",
        label: "Royal Bloom",
        description: "Deep violet and blossoms",
        // Canva flattened this export, so the photo area came out solid white.
        // The window was punched back out locally — see public/frames/README.md.
        thumbnail: "/frames/frame-3.png",
        designId: "DAHWFKgV9i8", // Canva title: frame4trnsprt
      },
      {
        id: "frame-four",
        label: "Midnight Garden",
        description: "Dusk violet with gold",
        thumbnail: "/frames/frame-4.png",
        designId: "DAHWFJHy8Y0", // Canva title: frame5trnsprt
      },
      {
        id: "frame-five",
        label: "Butterfly Crown",
        description: "Regal wings and gold",
        // Source artwork was 2:3 (900x1350), stretched to 3:4 to match the others.
        thumbnail: "/frames/frame-5.png",
        designId: "DAHWFMm3erI", // Canva title: frame1-1
      },
    ],
  },

  {
    slug: "sleepover",
    name: "Ladies Sleepover",
    shortName: "Sleepover",
    tagline: "Pillow talk and polaroids",
    headline: "Ladies Sleepover",
    palette: "sleepover",
    emailEmoji: "\u{1F319}", // crescent moon
    // Fallback only — each frame below declares its own, because the openings
    // measured between 1.10 and 1.37 rather than sharing one ratio.
    captureAspect: 1.2,
    // ------------------------------------------------------------------
    // These use brandTemplateId rather than designId — the sources were
    // published as brand templates. Both modes work; the pipeline picks
    // create_from_brand_template or create_from_design to match.
    //
    // Artwork-to-template pairing was established by comparing each Canva
    // thumbnail against the local PNGs (RMSE ~11-12k for the match versus
    // ~21-24k for every alternative, and a clean one-to-one), not by filename
    // order. `label` follows the Canva titles.
    //
    // `aspect` is measured from each artwork's transparent window, which is
    // landscape even though the canvas is square, and differs per frame.
    // ------------------------------------------------------------------
    frames: [
      {
        id: "sleepover-one",
        label: "Ladies Night",
        description: "Bold and glowing",
        thumbnail: "/frames/sleepover-1.png",
        aspect: 579 / 528, // 1.097
        brandTemplateId: "EAHWIqe7Fhk", // Canva title: Ladies Night
      },
      {
        id: "sleepover-two",
        label: "Cloud Nine",
        description: "Soft and dreamy",
        thumbnail: "/frames/sleepover-2.png",
        aspect: 649 / 568, // 1.143
        brandTemplateId: "EAHWIa6qbKs", // Canva title: clouds-slumber
      },
      {
        id: "sleepover-three",
        label: "Pajama Party",
        description: "Cosy and playful",
        thumbnail: "/frames/sleepover-3.png",
        aspect: 658 / 525, // 1.253
        brandTemplateId: "EAHWIWHQ0Ec", // Canva title: pajama Party photo frames
      },
      {
        id: "sleepover-four",
        label: "Game Night",
        description: "Wide and lively",
        thumbnail: "/frames/sleepover-4.png",
        aspect: 750 / 549, // 1.366
        brandTemplateId: "EAHWIVIJwVE", // Canva title: game night
      },
    ],
  },
];

/** Frames on this event that actually point at a Canva design. */
export function eventFrames(event: BoothEvent): FrameOption[] {
  return event.frames.filter(isFrameReady);
}

/**
 * Events a guest may open: those with at least one usable frame.
 *
 * An event with no frames would render a booth that cannot produce a photo, so
 * it stays hidden until its Canva designs exist.
 */
export function getLiveEvents(): BoothEvent[] {
  return EVENTS.filter((event) => eventFrames(event).length > 0);
}

/** Every configured event, including unfinished ones. For operator routes. */
export function getAllEvents(): BoothEvent[] {
  return EVENTS;
}

/** Looks up a live event by slug. Unfinished events resolve to undefined. */
export function findEvent(slug: string | null | undefined): BoothEvent | undefined {
  if (!slug) return undefined;
  return getLiveEvents().find((event) => event.slug === slug);
}

/** Looks up a frame within one event, so a frame can't be used cross-event. */
export function findEventFrame(
  event: BoothEvent,
  frameId: string | null | undefined,
): FrameOption | undefined {
  const frames = eventFrames(event);
  if (!frameId) {
    // One frame means the kiosk skips the picker, so fall back to it.
    return frames.length === 1 ? frames[0] : undefined;
  }
  return frames.find((frame) => frame.id === frameId);
}

/** What the browser needs to render the chooser. No Canva IDs. */
export interface PublicEventOption {
  slug: string;
  name: string;
  shortName: string;
  tagline: string;
  palette: EventPalette;
  frameCount: number;
}

export function toPublicEvent(event: BoothEvent): PublicEventOption {
  return {
    slug: event.slug,
    name: event.name,
    shortName: event.shortName,
    tagline: event.tagline,
    palette: event.palette,
    frameCount: eventFrames(event).length,
  };
}

export type { FrameOption, PublicFrameOption };
