import { redirect } from "next/navigation";

import { EventChooser } from "@/components/EventChooser";
import { getLiveEvents, toPublicEvent } from "@/config/events";

/**
 * Event chooser.
 *
 * With one live event there is nothing to choose, so go straight to its booth —
 * a guest at a single party should never see a menu of one. With several, show
 * the picker. QR codes can skip this entirely by pointing at `/<slug>`.
 */
export default function Page() {
  const events = getLiveEvents();

  if (events.length === 1) {
    redirect(`/${events[0].slug}`);
  }

  return <EventChooser events={events.map(toPublicEvent)} />;
}
