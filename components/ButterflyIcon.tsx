/**
 * Butterfly motif used throughout the booth. Decorative by default, so it is
 * hidden from assistive tech unless a `title` is supplied.
 */

interface ButterflyIconProps {
  className?: string;
  /** Accessible name. Omit to mark the icon as decorative. */
  title?: string;
  /** Animate the wings. */
  flapping?: boolean;
}

export function ButterflyIcon({
  className,
  title,
  flapping = false,
}: ButterflyIconProps) {
  return (
    <svg
      viewBox="0 0 64 64"
      className={className}
      role={title ? "img" : "presentation"}
      aria-hidden={title ? undefined : true}
      aria-label={title}
      fill="none"
    >
      {title ? <title>{title}</title> : null}
      <defs>
        <linearGradient id="bf-wing-upper" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#f0d98c" />
          <stop offset="55%" stopColor="#c084fc" />
          <stop offset="100%" stopColor="#6d28d9" />
        </linearGradient>
        <linearGradient id="bf-wing-lower" x1="0" y1="1" x2="1" y2="0">
          <stop offset="0%" stopColor="#4c1d95" />
          <stop offset="60%" stopColor="#a855f7" />
          <stop offset="100%" stopColor="#f9ecc2" />
        </linearGradient>
      </defs>

      <g className={flapping ? "origin-center animate-wing" : "origin-center"}>
        {/* Upper wings */}
        <path
          d="M31 30C26 15 17 7 11 9c-6 2-6 13-1 19 4 5 12 6 21 2Z"
          fill="url(#bf-wing-upper)"
          stroke="#f0d98c"
          strokeWidth="1.1"
        />
        <path
          d="M33 30c5-15 14-23 20-21 6 2 6 13 1 19-4 5-12 6-21 2Z"
          fill="url(#bf-wing-upper)"
          stroke="#f0d98c"
          strokeWidth="1.1"
        />
        {/* Lower wings */}
        <path
          d="M31 32c-3 12-9 21-16 21-5 0-8-5-6-11 2-6 10-11 22-10Z"
          fill="url(#bf-wing-lower)"
          stroke="#e4c96f"
          strokeWidth="1.1"
        />
        <path
          d="M33 32c3 12 9 21 16 21 5 0 8-5 6-11-2-6-10-11-22-10Z"
          fill="url(#bf-wing-lower)"
          stroke="#e4c96f"
          strokeWidth="1.1"
        />
        {/* Wing spots */}
        <circle cx="18" cy="19" r="2.4" fill="#f9ecc2" opacity="0.85" />
        <circle cx="46" cy="19" r="2.4" fill="#f9ecc2" opacity="0.85" />
        <circle cx="21" cy="41" r="1.7" fill="#f9ecc2" opacity="0.7" />
        <circle cx="43" cy="41" r="1.7" fill="#f9ecc2" opacity="0.7" />
      </g>

      {/* Body and antennae */}
      <path
        d="M32 16c1.7 0 2.6 1.6 2.6 5.5V44c0 4-1 6-2.6 6s-2.6-2-2.6-6V21.5C29.4 17.6 30.3 16 32 16Z"
        fill="#f0d98c"
      />
      <path
        d="M31 16c-2-3-5-4.6-8-4.4M33 16c2-3 5-4.6 8-4.4"
        stroke="#f0d98c"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <circle cx="23" cy="11" r="1.5" fill="#f9ecc2" />
      <circle cx="41" cy="11" r="1.5" fill="#f9ecc2" />
    </svg>
  );
}
