"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "gold" | "violet" | "ghost";

interface PrimaryButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  variant?: Variant;
  /** Stretch to the full width of the container. */
  block?: boolean;
}

/**
 * Large, touch-friendly button. The 5rem minimum height comfortably clears the
 * 44x44px minimum target size from WCAG 2.5.5 on a tablet.
 */
const BASE =
  "inline-flex min-h-16 items-center justify-center gap-3 rounded-full px-7 " +
  "font-display text-lg tracking-wide transition duration-200 ease-out " +
  "active:scale-[0.97] disabled:pointer-events-none disabled:opacity-50 " +
  "sm:min-h-20 sm:px-10 sm:text-xl lg:text-2xl";

const VARIANTS: Record<Variant, string> = {
  gold:
    "bg-gradient-to-b from-gold-200 via-gold-300 to-gold-500 text-plum-950 " +
    "shadow-[0_10px_40px_-8px_rgba(240,217,140,0.7)] ring-1 ring-gold-100/70 " +
    "hover:from-gold-100 hover:via-gold-200 hover:to-gold-400",
  violet:
    "bg-gradient-to-b from-orchid-400 via-violet-500 to-violet-700 text-blush-50 " +
    "shadow-[0_10px_40px_-8px_rgba(168,85,247,0.65)] ring-1 ring-lavender-200/40 " +
    "hover:from-orchid-300 hover:via-orchid-400 hover:to-violet-600",
  ghost:
    "bg-white/5 text-lavender-100 ring-1 ring-lavender-200/30 " +
    "hover:bg-white/10 hover:ring-lavender-200/50",
};

export function PrimaryButton({
  children,
  variant = "gold",
  block = false,
  className = "",
  type = "button",
  ...rest
}: PrimaryButtonProps) {
  return (
    <button
      type={type}
      className={`${BASE} ${VARIANTS[variant]} ${block ? "w-full" : ""} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}
