// Shell geometry: registry size → width/height/radius, Take A mascot placement,
// GROW/SETTLE springs.

import type { IslandStateId } from "@/lib/island-states";
import { stateDef } from "@/lib/island-states";
import { motionFor } from "@/lib/spring";
import type { WashEvent } from "@/lib/wash";
import {
  BOARD_WIDE_WIDTH,
  BOARD_WIDTH,
  GROW,
  SETTLE,
  SHELL_AGENTS,
  SHELL_ASK,
  SHELL_CARD,
  SHELL_COMPACT,
  SHELL_GIT_MIN_H,
  SHELL_GLANCE,
  SHELL_IDLE,
  SHELL_NOTIFY,
  SHELL_OS,
  SHELL_SETTINGS,
  TAKE_A,
  TAKE_A_ASK,
  TAKE_A_CARD,
} from "./island-layout";

export interface ShellGeom {
  width: number;
  height: number;
  radius: number;
  bare: boolean;
  /** Compact Take A perch: shell plate should carve under the mascot. */
  perch: boolean;
  wash: WashEvent;
  announce: string | null;
  mascotX: number;
  mascotY: number;
  /** Always SHELL_OS (48); visual size comes from mascotScale. */
  mascotSize: number;
  /** CSS scale on the creature (Take A / Ask), not canvas resize. */
  mascotScale: number;
  contentPadLeft: number;
}

export function shellGeom(opts: {
  id: IslandStateId;
  contentHeight: number;
  /** Compact pill width from the live label (voice / working / unread). */
  pillWidth?: number;
  askTab: string | null;
  agentsWide: boolean;
  /** Agents multi-session board (2 columns). */
  agentsBoard: boolean;
  /** Board on a tall screen (3 columns). */
  boardWide: boolean;
  /** When the Git dock is beside Ask, the island shell is this wide (repo list). */
  gitListW?: number | null;
  /** Measured Settings height; falls back to 460. */
  settingsHeight?: number;
  reduced: boolean;
  settled: boolean;
}): { geom: ShellGeom; transition: ReturnType<typeof motionFor> } {
  const def = stateDef(opts.id);
  const panel = def.size === "panel";
  const card = def.size === "card";
  const compact = def.size === "compact" || def.size === "pill";
  const bare = opts.id === "idle";

  let width: number = SHELL_IDLE.width;
  let height: number = SHELL_IDLE.height;
  let radius: number = SHELL_IDLE.radius;
  let take: { readonly x: number; readonly y: number; readonly scale: number } = TAKE_A;

  if (opts.id === "settings") {
    width = SHELL_SETTINGS.width;
    height = opts.settingsHeight ?? SHELL_SETTINGS.height;
    radius = SHELL_SETTINGS.radius;
    take = TAKE_A_ASK;
  } else if (opts.id === "agents") {
    // Board always gets room for its tiles - never fall back to Ask width.
    width = opts.boardWide
      ? BOARD_WIDE_WIDTH
      : opts.agentsBoard
        ? BOARD_WIDTH
        : opts.agentsWide
          ? SHELL_AGENTS.one
          : SHELL_AGENTS.width;
    height = Math.max(SHELL_COMPACT.height, opts.contentHeight + 8);
    radius = SHELL_AGENTS.radius;
    take = TAKE_A_ASK;
  } else if (opts.id === "ask") {
    // Repos + side Git: narrow list; otherwise the full Ask width.
    const listW = opts.gitListW;
    const gitBeside = listW != null && opts.askTab === "repos";
    width = gitBeside ? listW : SHELL_ASK.width;
    // Soft floor when Git is beside - hug content above it, avoid a hard snap.
    height = gitBeside
      ? Math.max(SHELL_GIT_MIN_H, opts.contentHeight + 8)
      : Math.max(SHELL_COMPACT.height, opts.contentHeight + 8);
    radius = SHELL_ASK.radius;
    take = TAKE_A_ASK;
  } else if (card || (panel && !bare)) {
    width =
      opts.id === "suggestion" || opts.id === "waiting" || opts.id === "merge-conflict"
        ? SHELL_CARD.width
        : opts.id === "new-message"
          ? SHELL_NOTIFY.width
          : opts.id === "glance" || opts.id === "quiet-glance" || opts.id === "activities"
            ? SHELL_GLANCE.width
            : SHELL_CARD.width;
    // Content already includes top/bottom pad; do not add another strip below.
    height = Math.max(78, opts.contentHeight);
    radius = height > 40 ? 26 : 18;
    take = TAKE_A_CARD;
  } else if (compact) {
    width = Math.max(SHELL_IDLE.width, opts.pillWidth ?? 109);
    height = SHELL_COMPACT.height;
    radius = SHELL_COMPACT.radius;
    take = TAKE_A;
  }

  if (bare) {
    width = SHELL_IDLE.width;
    height = SHELL_IDLE.height;
    radius = SHELL_IDLE.radius;
    take = TAKE_A;
  }

  // Internal size stays --os (48); Take A / Ask only CSS-scale.
  const mascotSize = SHELL_OS;
  const visual = mascotSize * take.scale;
  const perch = !bare && take === TAKE_A;
  const geom: ShellGeom = {
    width,
    height,
    radius,
    bare,
    perch,
    wash: def.wash,
    announce: def.announce,
    mascotX: take.x,
    mascotY: take.y,
    mascotSize,
    mascotScale: take.scale,
    contentPadLeft: panel || card ? take.x + visual + 10 : SHELL_COMPACT.padLeft,
  };

  const transition = motionFor(opts.settled ? SETTLE : GROW, opts.reduced);
  return { geom, transition };
}
