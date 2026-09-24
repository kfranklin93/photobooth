import { ButterflyIcon } from "@/components/ButterflyIcon";

/**
 * Purely decorative layer: butterflies drifting across the screen plus a field
 * of twinkling gold sparkles.
 *
 * Positions and delays are hard-coded rather than randomised so the server and
 * client render identical markup (no hydration mismatch).
 */

const DRIFTERS = [
  { top: "12%", size: "3.5rem", duration: "22s", delay: "0s", opacity: 0.5 },
  { top: "34%", size: "2.25rem", duration: "31s", delay: "-6s", opacity: 0.35 },
  { top: "58%", size: "4.25rem", duration: "26s", delay: "-14s", opacity: 0.45 },
  { top: "78%", size: "2.75rem", duration: "35s", delay: "-21s", opacity: 0.3 },
] as const;

const HOVERERS = [
  { top: "18%", left: "8%", size: "2.5rem", delay: "0s", opacity: 0.45 },
  { top: "26%", left: "86%", size: "3.25rem", delay: "-2.5s", opacity: 0.4 },
  { top: "68%", left: "12%", size: "3rem", delay: "-4s", opacity: 0.35 },
  { top: "76%", left: "82%", size: "2.25rem", delay: "-1.2s", opacity: 0.45 },
] as const;

const SPARKLES = [
  { top: "9%", left: "22%", size: 8, delay: "0s" },
  { top: "15%", left: "62%", size: 5, delay: "-0.8s" },
  { top: "23%", left: "38%", size: 6, delay: "-1.6s" },
  { top: "31%", left: "78%", size: 9, delay: "-0.4s" },
  { top: "44%", left: "17%", size: 5, delay: "-2.1s" },
  { top: "49%", left: "54%", size: 7, delay: "-1.1s" },
  { top: "57%", left: "88%", size: 5, delay: "-2.6s" },
  { top: "64%", left: "31%", size: 8, delay: "-0.2s" },
  { top: "72%", left: "68%", size: 6, delay: "-1.9s" },
  { top: "83%", left: "44%", size: 7, delay: "-0.6s" },
  { top: "88%", left: "76%", size: 5, delay: "-2.3s" },
  { top: "93%", left: "24%", size: 6, delay: "-1.4s" },
] as const;

export function ButterflyBackdrop() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
    >
      {/* Soft vignette so foreground text keeps its contrast. */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_35%,rgba(15,4,28,0.55)_100%)]" />

      {SPARKLES.map((sparkle, index) => (
        <span
          key={`sparkle-${index}`}
          className="absolute rounded-full bg-gold-200 animate-twinkle"
          style={{
            top: sparkle.top,
            left: sparkle.left,
            width: sparkle.size,
            height: sparkle.size,
            animationDelay: sparkle.delay,
            boxShadow: "0 0 12px 3px rgba(240, 217, 140, 0.55)",
          }}
        />
      ))}

      {HOVERERS.map((butterfly, index) => (
        <div
          key={`hover-${index}`}
          className="absolute animate-flutter"
          style={{
            top: butterfly.top,
            left: butterfly.left,
            animationDelay: butterfly.delay,
            opacity: butterfly.opacity,
          }}
        >
          <ButterflyIcon
            flapping
            className="drop-shadow-[0_0_14px_rgba(192,132,252,0.45)]"
          />
        </div>
      ))}

      {DRIFTERS.map((butterfly, index) => (
        <div
          key={`drift-${index}`}
          className="absolute left-0 animate-drift"
          style={{
            top: butterfly.top,
            width: butterfly.size,
            height: butterfly.size,
            animationDuration: butterfly.duration,
            animationDelay: butterfly.delay,
            opacity: butterfly.opacity,
          }}
        >
          <ButterflyIcon
            flapping
            className="h-full w-full drop-shadow-[0_0_18px_rgba(168,85,247,0.4)]"
          />
        </div>
      ))}
    </div>
  );
}
