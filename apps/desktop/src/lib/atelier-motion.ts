// Shared Motion presets for the opt-in Atelier island theme.
// Ease matches --ease-out-strong in globals.css.

/** Strong ease-out used for UI entrances under Atelier. */
export const ATELIER_EASE = [0.23, 1, 0.32, 1] as const;

/** Event wash: fade/scale in, hold briefly via timed unmount, exit same path. */
export const ATELIER_WASH_MS = 1400;

export const atelierWashTransition = {
  duration: 0.35,
  ease: ATELIER_EASE,
} as const;

export const atelierWashReduced = {
  duration: 0.2,
  ease: ATELIER_EASE,
} as const;

/** Stagger for Ask/settings list enter — under 250ms total for a short list. */
export const atelierStaggerParent = {
  hidden: {},
  show: {
    transition: { staggerChildren: 0.04, delayChildren: 0.02 },
  },
} as const;

export const atelierStaggerChild = {
  hidden: { opacity: 0, transform: "translateY(8px)" },
  show: {
    opacity: 1,
    transform: "translateY(0px)",
    transition: { duration: 0.2, ease: ATELIER_EASE },
  },
} as const;

export const atelierStaggerChildReduced = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { duration: 0.15, ease: ATELIER_EASE },
  },
} as const;
