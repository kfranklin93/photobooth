"use client";

import { useEffect } from "react";

/**
 * Holds a screen wake lock while mounted so the tablet does not sleep mid-event
 * (which would otherwise abort an in-flight upload).
 *
 * Feature-detected: unsupported browsers and denied permissions are no-ops.
 * The lock is also re-acquired when the page becomes visible again, because the
 * browser releases it automatically whenever the tab is hidden.
 */
export function useWakeLock(enabled = true) {
  useEffect(() => {
    if (!enabled) return;
    if (typeof navigator === "undefined" || !("wakeLock" in navigator)) return;

    let sentinel: WakeLockSentinel | null = null;
    let cancelled = false;

    const acquire = async () => {
      if (document.visibilityState !== "visible") return;
      try {
        const lock = await navigator.wakeLock.request("screen");
        if (cancelled) {
          void lock.release();
          return;
        }
        sentinel = lock;
      } catch {
        // Denied or unavailable. The booth still works, the screen may dim.
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible" && !sentinel) void acquire();
    };

    void acquire();
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      void sentinel?.release();
      sentinel = null;
    };
  }, [enabled]);
}
