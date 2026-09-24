import { PhotoBooth } from "@/components/PhotoBooth";
import { getFrames, toPublicFrames } from "@/config/frames";
import { env } from "@/lib/env";

/**
 * Kiosk entry point. Server component so the event name and the frame
 * catalogue come from the server, and Canva IDs stay out of the browser bundle.
 */
export default function Page() {
  return (
    <PhotoBooth
      eventName={env.eventName}
      frames={toPublicFrames(getFrames())}
    />
  );
}
