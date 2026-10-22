"use client";

// Review panel beside the island shell while an Agents session is reviewing.
// Mirrors GitSideDock: Seam + panel, warm layout via shared listW.

import { motion, useReducedMotion } from "motion/react";
import { closeReview, reviewingSessionId, useAgents } from "@/lib/agents";
import { DOCK_MIN, dockTotal, SEAM_W, stacked } from "@/lib/seam";
import { gitDockHidden, gitDockIn, gitDockOut, gitDockReduced, gitDockShown } from "@/lib/ui-motion";
import { Review } from "./review";
import { Seam } from "./seam";

export function ReviewSideDock({ height, visible }: { height: number; visible: boolean }) {
  const reduced = useReducedMotion() ?? false;
  const listW = useAgents((s) => s.listW);
  const session = useAgents((s) => s.sessions.find((x) => x.view?.reviewing) ?? null);
  const screenW = typeof window === "undefined" ? 1920 : window.screen.availWidth;

  if (!session || stacked(screenW) || listW == null) return null;

  const total = dockTotal(screenW);
  const dockW = Math.max(DOCK_MIN, total - listW);
  const targetW = SEAM_W + dockW;
  const setListW = (w: number) => useAgents.setState({ listW: w });

  const enter = reduced ? { opacity: 0 } : gitDockHidden;
  const shown = reduced ? { opacity: 1 } : gitDockShown;
  const transition = reduced ? gitDockReduced : visible ? gitDockIn : gitDockOut;

  return (
    <motion.div
      className="gd-side"
      style={{
        height,
        width: targetW,
        ...(!visible
          ? { position: "absolute" as const, visibility: "hidden" as const, pointerEvents: "none" as const }
          : {}),
      }}
      initial={enter}
      animate={visible ? shown : enter}
      exit={enter}
      transition={transition}
      aria-hidden={!visible}
    >
      <Seam value={listW} total={total} onChange={setListW} />
      <div className="gd-side-panel ak-rv-dock" style={{ width: dockW }}>
        <Review session={session} maxHeight={height - 16} onDone={() => closeReview(session.id)} />
      </div>
    </motion.div>
  );
}

/** True when Island should shrink the shell and show the side Review panel. */
export function reviewDockOpen(): boolean {
  if (!reviewingSessionId()) return false;
  const { tab, listW } = useAgents.getState();
  if (tab !== "agents" || listW == null) return false;
  const screenW = typeof window === "undefined" ? 1920 : window.screen.availWidth;
  return !stacked(screenW);
}
