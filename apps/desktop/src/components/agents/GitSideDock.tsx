"use client";

// Git panel beside the island shell. Stays mounted while the dock is open
// (off-flow on Ask/Agents) so status/diff stay warm across tabs.

import { motion, useReducedMotion } from "motion/react";
import { useEffect } from "react";
import { setDock, useAgents } from "@/lib/agents";
import { api } from "@/lib/bridge";
import { useCached } from "@/lib/cache";
import { DOCK_MIN, dockTotal, SEAM_W, stacked } from "@/lib/seam";
import type { ReposOverview } from "@/lib/types";
import { gitDockHidden, gitDockIn, gitDockOut, gitDockReduced, gitDockShown } from "@/lib/ui-motion";
import { GitDock } from "./GitDock";
import { Seam } from "./Seam";

export function GitSideDock({ height, visible }: { height: number; visible: boolean }) {
  const reduced = useReducedMotion() ?? false;
  const dock = useAgents((s) => s.dock ?? null);
  const listW = useAgents((s) => s.listW);
  // Repos owns the 60s revalidate; paint from cache here without refetching.
  const { data } = useCached<ReposOverview>("repos", () => api.reposOverview(false), undefined, false);
  const screenW = typeof window === "undefined" ? 1920 : window.screen.availWidth;
  const gitPath =
    !dock || stacked(screenW) || listW == null
      ? null
      : dock === "first"
        ? ((data?.repos.find((r) => r.changed > 0) ?? data?.repos[0])?.path ?? null)
        : dock;

  // Resolve "first" to a concrete path once repos are known.
  useEffect(() => {
    if (dock !== "first" || !gitPath) return;
    setDock(gitPath);
  }, [dock, gitPath]);

  if (!dock || stacked(screenW) || listW == null || !gitPath) return null;

  const total = dockTotal(screenW);
  const repo = data?.repos.find((r) => r.path === gitPath) ?? null;
  const dockW = Math.max(DOCK_MIN, total - listW);
  const targetW = SEAM_W + dockW;
  const setListW = (w: number) => useAgents.setState({ listW: w });

  // Reduced: opacity only. Full: slide from the seam (never animate width).
  const enter = reduced ? { opacity: 0 } : gitDockHidden;
  const shown = reduced ? { opacity: 1 } : gitDockShown;
  const transition = reduced ? gitDockReduced : visible ? gitDockIn : gitDockOut;

  return (
    <motion.div
      className="gd-side"
      style={{
        height,
        width: targetW,
        // Keep warm off-flow when another Ask tab is selected — no layout thrash.
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
      <div className="gd-side-panel" style={{ width: dockW }}>
        <GitDock path={gitPath} repo={repo} repos={data?.repos} onPickRepo={setDock} onClose={() => setDock(null)} />
      </div>
    </motion.div>
  );
}

/** True when Island should shrink the shell and show the side Git panel. */
export function gitDockOpen(): boolean {
  const { tab, dock, listW } = useAgents.getState();
  if (tab !== "repos" || !dock || listW == null) return false;
  const screenW = typeof window === "undefined" ? 1920 : window.screen.availWidth;
  return !stacked(screenW);
}
