// The seam between the island and a dock (Review or Git) beside it. It can be
// dragged, nudged with the arrow keys, and reset with a double click, and it
// never squeezes either side below its minimum.

export const ISLAND_MIN = 372;
/** Git changes + diff need room; 600 left the diff column clipped. */
export const DOCK_MIN = 720;
/** Width of the draggable seam between the island and the Git dock. */
export const SEAM_W = 12;
/** Breathing room each side inside the window so shadows and radii are not clipped. */
export const DOCK_EDGE = 24;
/** Below this window width the dock stacks under the island instead. */
export const STACK_BELOW = 1200;
export const NUDGE = 16;
export const NUDGE_BIG = 64;

/** The island's width for a dragged position, kept inside both minimums. */
export function clampIsland(want: number, total: number): number {
  const max = Math.max(ISLAND_MIN, total - DOCK_MIN);
  return Math.round(Math.min(max, Math.max(ISLAND_MIN, want)));
}

/** The width the island starts at, and returns to on a double click. */
export function defaultIsland(total: number): number {
  return clampIsland(Math.round(total * 0.4), total);
}

export function stacked(windowWidth: number): boolean {
  return windowWidth < STACK_BELOW;
}

/** Arrow keys nudge; Shift makes a bigger step; Home and End jump to a minimum. */
export function nudge(key: string, shift: boolean, island: number, total: number): number | null {
  const step = shift ? NUDGE_BIG : NUDGE;
  if (key === "ArrowLeft") return clampIsland(island - step, total);
  if (key === "ArrowRight") return clampIsland(island + step, total);
  if (key === "Home") return clampIsland(0, total);
  if (key === "End") return clampIsland(total, total);
  return null;
}

/** What a saved width becomes when the window is a different size now. */
export function restore(saved: number | null, total: number): number {
  return saved === null ? defaultIsland(total) : clampIsland(saved, total);
}

const SEAM_KEY = "duskie.seam";

/** Remembered island width for a dock-beside layout, or the default. */
export function readSeam(total: number): number {
  let saved: number | null = null;
  try {
    if (typeof localStorage === "undefined") return defaultIsland(total);
    const raw = localStorage.getItem(SEAM_KEY);
    saved = raw ? Number(raw) : null;
  } catch {
    /* ignore */
  }
  return restore(Number.isFinite(saved) ? saved : null, total);
}

/** The panel's width with a dock beside the island, for a screen this wide. */
export function dockTotal(screenWidth: number): number {
  // Reserve seam + side edges so the Tauri window can sit wider than the panels.
  const chrome = SEAM_W + DOCK_EDGE * 2;
  return Math.max(ISLAND_MIN + DOCK_MIN, Math.min(screenWidth - 48 - chrome, 1480));
}

/** Island + seam + dock + side edges - the window width when Git is open beside. */
export function dockWindowWidth(screenWidth: number): number {
  return dockTotal(screenWidth) + SEAM_W + DOCK_EDGE * 2;
}
