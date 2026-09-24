import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /**
   * Next blocks cross-origin requests to dev-only assets (including the HMR
   * endpoint) unless the origin is allow-listed. The dev server binds to
   * `localhost`, so browsing the booth on `127.0.0.1` — which is required,
   * since that's the redirect URI registered with Canva — counted as
   * cross-origin. The client bundle then failed to load, React never hydrated,
   * and every button rendered but did nothing.
   *
   * Entries are matched on hostname only: no scheme, no port. `*` stands for
   * exactly one label, so the private ranges below cover whatever address the
   * tablet reaches the booth on (home wifi, venue wifi, or a phone hotspot)
   * without needing another edit on the day.
   *
   * Development only — this has no effect on a production build.
   */
  allowedDevOrigins: [
    "127.0.0.1",
    "10.*.*.*",
    "192.168.*.*",
    "172.*.*.*",
  ],
};

export default nextConfig;
