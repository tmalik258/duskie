"use client";
import { useEffect, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { activityLabel, latestActivity, useActivities } from "@/lib/activities";
import { listenToAgents, useAgents } from "@/lib/agents";
import { useNow } from "@/lib/hooks";
import { stacked } from "@/lib/seam";
import { useDuskie } from "@/lib/store";
import { updateBusy, updateLabel } from "@/lib/updates";

export type IslandStore = ReturnType<typeof useIslandStore>;

export function useIslandStore() {
  const { mascot, settings, suggestion, hovered: rawHover, visible, ready } = useDuskie();
  const asking = useDuskie((s) => s.ask !== null);
  const askTab = useAgents((s) => s.tab);
  const agentsLayout = useAgents((s) => s.layout);
  const agentCurrent = useAgents((s) => s.current);
  const gitListW = useAgents((s) => s.listW);
  const gitDock = useAgents((s) => s.dock);
  const reviewOpen = useAgents((s) => s.sessions.some((x) => x.view?.reviewing));
  const screenW = typeof window === "undefined" ? 1920 : window.screen.availWidth;
  // Keep the dock mounted while open (warm cache/state); only lay it beside on Repos.
  const gitDockLive = asking && !!gitDock && gitListW != null && !stacked(screenW);
  const gitBeside = gitDockLive && askTab === "repos";
  const reviewDockLive = asking && reviewOpen && gitListW != null && !stacked(screenW);
  const reviewBeside = reviewDockLive && askTab === "agents";
  const dockBeside = gitBeside || reviewBeside;
  useEffect(listenToAgents, []);
  const view = useDuskie((s) => s.ask?.view);
  // The Ask panel itself (not Settings or the welcome shown in its place).
  const askPanel = asking && view !== "welcome";
  const chatting = useDuskie((s) => s.chatId !== null);
  const voiceStatus = useDuskie((s) => s.voiceStatus);
  const online = useDuskie((s) => s.online);
  const laterCount = useDuskie((s) => s.later);
  // A newly held suggestion shows as a short notice, then the island rests.
  const storeReady = useDuskie((s) => s.ready);
  const [laterSeen, setLaterSeen] = useState<number | null>(null);
  const [laterFresh, setLaterFresh] = useState(false);
  if (storeReady && laterSeen === null) setLaterSeen(laterCount);
  else if (laterSeen !== null && laterCount !== laterSeen) {
    setLaterSeen(laterCount);
    setLaterFresh(laterCount > laterSeen);
  }
  useEffect(() => {
    if (!laterFresh) return;
    const t = setTimeout(() => setLaterFresh(false), 8000);
    return () => clearTimeout(t);
  }, [laterFresh]);
  const later = laterFresh ? laterCount : 0;
  // Design: losing the connection only changes the pill; the card opens on a click.
  const [netOpen, setNetOpen] = useState(false);
  if (netOpen && online) setNetOpen(false);
  const netShown = netOpen;
  const merging = useDuskie((s) => s.merge !== null);
  const updateProgress = useDuskie((s) => s.updateProgress);
  const updateActivity = useActivities((s) => latestActivity(s.activities, "update"));
  const updateSuppressed = updateActivity?.dismissed;
  const updateNow = useNow(1000);
  const updateWorking =
    updateProgress && !updateSuppressed && updateBusy(updateProgress)
      ? updateActivity
        ? activityLabel(updateActivity, updateNow)
        : updateLabel(updateProgress)
      : null;
  const waiting = useDuskie((s) => (s.ask ? null : s.waiting));
  const justDone = useDuskie((s) => s.justDone);
  // A task still running after Ask closed: its current step, small.
  const chatWorking = useDuskie((s) => {
    const last = s.turns[s.turns.length - 1];
    if (!s.chatId || !last?.streaming) return null;
    return last.tool ? `${last.tool}...` : "Working...";
  });
  // Agents keep working with Ask closed: a small pill says so, and says
  // when one needs an answer. Hovering it lists them.
  const agentWorking = useAgents((s) => {
    const waiting = s.sessions.find((x) => x.status === "waiting");
    if (waiting) return `${waiting.agent} needs you`;
    const live = s.sessions.filter((x) => x.status === "working" || x.status === "waiting");
    const busy = live.filter((x) => x.status === "working");
    if (live.length > 1)
      return busy.length === live.length
        ? `${live.length} agents working`
        : `${live.length} agents · ${busy.length} working`;
    return busy[0] ? `${busy[0].agent}: ${busy[0].project}` : null;
  });
  // One ring arc per running agent in the compact pill.
  const agentDots = useAgents(
    useShallow((s) => s.sessions.filter((x) => x.status === "working" || x.status === "waiting").map((x) => x.status)),
  );
  const out0 = { agentCurrent, agentDots, agentWorking, agentsLayout, askPanel, askTab, asking, chatWorking };
  const out1 = { chatting, dockBeside, gitBeside, gitDockLive, gitListW, justDone, later, mascot, merging };
  const out2 = { netShown, online, rawHover, ready, reviewBeside, reviewDockLive, screenW, setNetOpen, settings };
  const out3 = { suggestion, updateActivity, updateNow, updateProgress, updateWorking, view, visible, voiceStatus };
  const out4 = { waiting };
  return { ...out0, ...out1, ...out2, ...out3, ...out4 };
}
