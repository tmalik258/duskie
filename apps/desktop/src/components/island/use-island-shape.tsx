"use client";

import { animate } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { activityLabel, downloadProgress } from "@/lib/activities";
import { wideScreen } from "@/lib/agents";
import { api } from "@/lib/bridge";
import { PANEL_PAD } from "@/lib/island-size";
import { resolveIslandState } from "@/lib/resolve-island-state";
import { DOCK_MIN, dockTotal, SEAM_W } from "@/lib/seam";
import { stopLive, useDuskie } from "@/lib/store";
import { useBlockBrowserKeys, useSuggestionKeys } from "../island-hooks";
import { SHELL_SETTINGS, TOP } from "../island-layout";
import type { PillModel } from "../island-pill/pill-kind";
import { shellGeom } from "../use-island-shell";
import { clockTime, pauseDim, shortError } from "./helpers";
import type { IslandFace } from "./use-island-face";
import type { IslandHover } from "./use-island-hover";
import type { IslandStore } from "./use-island-store";
import type { IslandWork } from "./use-island-work";

export type IslandShape = ReturnType<typeof useIslandShape>;

export function useIslandShape(c: IslandStore & IslandWork & IslandHover & IslandFace) {
  const { activityNow, agentCurrent, agentsLayout, agentsOnly, askTab, asking, askingCount, askingTitle } = c;
  const { asksYou, bare, bump, busy, cardAgent, contentHeight, displayedActivity, dockBeside, donePill } = c;
  const { doneUndo, expanded, focusLeft, focusUntil, fullVoice, gitListW, guiding, hearing, hovered, later } = c;
  const { live, liveActivities, mascot, meetingSoon, merging, netShown, notifyFresh, online, paused, pillWidth } = c;
  const { questionId, reduced, screenW, setNetOpen, settings, settled, showPausedPill, suggestion } = c;
  const { updateProgress, updateWorking, view, voicePill, voiceQuestion, waiting, working } = c;

  const lastError = useDuskie((s) => (s.lastResult && !s.lastResult.ok ? s.lastResult.message : null));
  const pillModel: PillModel | null =
    !expanded && !asking
      ? hearing !== null || mascot === "listening"
        ? { kind: "listening", label: hearing?.trim() ? hearing : "", dim: hearing?.trim() ? undefined : "Listening" }
        : live !== null
          ? {
              kind: "caption",
              label: live.caption || (live.tool ?? "Thinking"),
              chip: live.caption && live.tool ? live.tool : undefined,
              onChip: stopLive,
            }
          : mascot === "error"
            ? { kind: "error", label: shortError(lastError) }
            : donePill !== null
              ? { kind: "done", label: donePill, ...(doneUndo ? { chip: "Undo", onChip: doneUndo } : {}) }
              : asksYou && askingTitle && voiceQuestion === null
                ? {
                    kind: "waiting",
                    label: askingTitle,
                    dim: "waiting for you",
                    count: askingCount,
                    onOpen: () => void api.askOpen(),
                  }
                : working !== null || voiceQuestion !== null
                  ? {
                      kind: "working",
                      label: displayedActivity
                        ? activityLabel(displayedActivity, activityNow, { elapsed: false }).replace(/(\.\.\.|…)$/, "")
                        : (voiceQuestion ?? working ?? "").replace(/(\.\.\.|…)$/, ""),
                      // The edge ring fills with real progress; a known time
                      // left turns the timer into a countdown.
                      ...(() => {
                        const p = displayedActivity ? downloadProgress(displayedActivity) : null;
                        return {
                          startedAt: p?.left == null ? displayedActivity?.startedAt : undefined,
                          endsAt: p?.left == null ? undefined : activityNow + p.left * 1000,
                          progress: p?.pct == null ? undefined : p.pct / 100,
                        };
                      })(),
                    }
                  : focusLeft !== null
                    ? {
                        kind: "focus",
                        label: "Focus",
                        dim: focusUntil ? `until ${clockTime(focusUntil)}` : undefined,
                        left: focusLeft,
                      }
                    : meetingSoon && !paused
                      ? {
                          kind: "notify",
                          label: meetingSoon.title,
                          dim: meetingSoon.mins < 1 ? "starting now" : `starts in ${meetingSoon.mins} minutes`,
                          chip: meetingSoon.join ? "Join the call" : undefined,
                          onChip: () => meetingSoon.join && void api.openReference("page", meetingSoon.join),
                        }
                      : later > 0 && !paused
                        ? {
                            kind: "waiting",
                            label: later === 1 ? "1 suggestion" : `${later} suggestions`,
                            dim: "held while you were busy",
                            count: later,
                          }
                        : showPausedPill
                          ? {
                              kind: "paused",
                              label: "Paused",
                              dim: pauseDim(settings.pause),
                              onCancel: () => void api.sensorsResume(),
                            }
                          : !online
                            ? {
                                kind: "offline",
                                label: "Offline",
                                dim: "catching up when back",
                                onOpen: () => setNetOpen(true),
                              }
                            : mascot === "noticing"
                              ? { kind: "noticing", label: "Taking a look" }
                              : null
      : null;
  const [pillMeasured, setPillMeasured] = useState(0);

  const registryId = resolveIslandState({
    asking,
    askTab: view === "settings" ? "settings" : asking ? askTab : null,
    settingsView: view === "settings",
    welcome: view === "welcome",
    guiding,
    expanded,
    bare,
    fullVoice,
    voicePill: voicePill !== null,
    suggestion: !!suggestion,
    suggestPeek: false,
    waitingForYou: !!waiting && !waiting.minimized && !guiding,
    merging,
    updateCard: updateProgress?.phase === "failed" || (hovered && updateWorking !== null),
    offline: !online,
    netCard: netShown && !voicePill,
    notifyCard: hovered && meetingSoon !== null && !paused,
    agentCard: hovered && agentsOnly && cardAgent !== null,
    focus: focusLeft !== null,
    paused: showPausedPill,
    notifyFresh: !!notifyFresh && !busy && !expanded,
    unread: later,
    activitiesOpen: expanded && liveActivities.length > 0 && !suggestion,
    mascot,
    quietGlance:
      expanded &&
      !suggestion &&
      !merging &&
      questionId === null &&
      liveActivities.length === 0 &&
      (mascot === "idle" || mascot === "sleeping"),
  });
  const layout = shellGeom({
    id: registryId,
    contentHeight,
    pillWidth: pillModel && pillMeasured ? pillMeasured : pillWidth,
    askTab,
    agentsWide: agentCurrent !== null,
    agentsBoard: agentsLayout === "board",
    boardWide: agentsLayout === "board" && wideScreen(),
    gitListW: dockBeside ? gitListW : null,
    // Fixed shell size - IslandSettings uses the same height so inner panes can scroll.
    settingsHeight: view === "settings" ? SHELL_SETTINGS.height + 18 : undefined,
    reduced,
    settled: settled || (!expanded && !asking),
  });
  const width = layout.geom.width;
  const height = layout.geom.height;
  const radius = layout.geom.radius;
  const transition = layout.transition;
  const sideDockW = dockBeside && gitListW != null ? Math.max(DOCK_MIN, dockTotal(screenW) - gitListW) : 0;
  const dockPairW = dockBeside ? width + SEAM_W + sideDockW : width;
  // Dock fills the island window below the top gap; shell stays content-sized.
  const sideDockH = typeof window === "undefined" ? height : Math.max(height, window.innerHeight - TOP - PANEL_PAD);

  const overlayHit = useDuskie((s) => s.overlayHit);
  // Report the target shape as the interactive area; outside it the window
  // stays click-through. A floating menu expands the rect so it stays usable.
  // Debounced: during spring animations width/height change every frame, so
  // we wait one frame before sending across the IPC boundary.
  const hitRectTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => {
    clearTimeout(hitRectTimer.current);
    hitRectTimer.current = setTimeout(() => {
      const hitH = dockBeside ? sideDockH : height;
      const base = { x: (window.innerWidth - dockPairW) / 2, y: TOP, width: dockPairW, height: hitH };
      const rect = overlayHit
        ? {
            x: Math.min(base.x, overlayHit.x),
            y: Math.min(base.y, overlayHit.y),
            width: Math.max(base.x + base.width, overlayHit.x + overlayHit.width) - Math.min(base.x, overlayHit.x),
            height: Math.max(base.y + base.height, overlayHit.y + overlayHit.height) - Math.min(base.y, overlayHit.y),
          }
        : base;
      void api.islandSetHitRect(rect);
    }, 16);
    return () => clearTimeout(hitRectTimer.current);
  }, [dockPairW, height, dockBeside, sideDockH, overlayHit]);

  // A small squish when something gets the mascot's attention while compact.
  useEffect(() => {
    if (mascot !== "noticing" || reduced) return;
    void animate(bump, [1, 1.06, 1], { duration: 0.42, ease: [0.23, 1, 0.32, 1] });
  }, [mascot, reduced, bump]);

  // Number keys must not pick a suggestion while the user is typing.
  useSuggestionKeys(asking ? null : suggestion);
  // WebView chrome: Ctrl+J is Downloads, not a Duskie feature.
  useBlockBrowserKeys();
  return { height, layout, pillModel, radius, registryId, setPillMeasured, sideDockH, transition, width };
}
