import { describe, expect, it } from "vitest";
import {
  clampIsland,
  DOCK_EDGE,
  DOCK_MIN,
  defaultIsland,
  dockTotal,
  dockWindowWidth,
  ISLAND_MIN,
  nudge,
  restore,
  SEAM_W,
  stacked,
} from "./seam";

describe("seam", () => {
  it("never leaves the island under its minimum or the dock under its own", () => {
    for (const total of [1280, 1600, 1920]) {
      expect(clampIsland(0, total)).toBe(ISLAND_MIN);
      expect(clampIsland(total, total)).toBe(total - DOCK_MIN);
      expect(clampIsland(500, total)).toBe(500);
    }
  });

  it("holds the island minimum when the window is too small for both", () => {
    expect(clampIsland(900, 900)).toBe(ISLAND_MIN);
  });

  it("starts at about 40 percent, inside the limits", () => {
    expect(defaultIsland(1280)).toBe(512);
    // 1000 is too narrow for island min + dock min; clamp holds the island floor.
    expect(defaultIsland(1000)).toBe(ISLAND_MIN);
    expect(defaultIsland(900)).toBe(ISLAND_MIN);
  });

  it("nudges with the arrows, bigger with Shift, and stops at the ends", () => {
    expect(nudge("ArrowRight", false, 500, 1600)).toBe(516);
    expect(nudge("ArrowLeft", true, 500, 1600)).toBe(436);
    expect(nudge("ArrowLeft", false, ISLAND_MIN, 1600)).toBe(ISLAND_MIN);
    expect(nudge("End", false, 500, 1600)).toBe(1600 - DOCK_MIN);
    expect(nudge("a", false, 500, 1600)).toBeNull();
  });

  it("re-clamps a saved width when the window shrinks", () => {
    expect(restore(900, 1300)).toBe(1300 - DOCK_MIN);
    expect(restore(null, 1280)).toBe(512);
  });

  it("stacks the dock under the island on narrow windows", () => {
    expect(stacked(1199)).toBe(true);
    expect(stacked(1200)).toBe(false);
  });

  it("sizes the Git window wider than the panels so edges are not clipped", () => {
    const screen = 1920;
    const panels = dockTotal(screen);
    const win = dockWindowWidth(screen);
    expect(win).toBe(panels + SEAM_W + DOCK_EDGE * 2);
    expect(win).toBeGreaterThan(panels);
    expect(win).toBeLessThanOrEqual(screen);
  });
});
