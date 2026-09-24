/** Booth-wide behaviour knobs. */

/**
 * How many photos a guest may take in one session before sending.
 *
 * Each photo is a full Canva round trip (upload, autofill, export), so raising
 * this raises the wait on the processing screen. They run concurrently, so the
 * wall-clock cost is closer to the slowest one than the sum, but Canva's
 * per-user export limit (75 per 5 minutes) is the real ceiling at a busy event.
 */
export const MAX_PHOTOS = 3;
