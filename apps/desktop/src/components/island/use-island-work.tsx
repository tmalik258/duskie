"use client";

import { useReducedMotion } from "motion/react";
import { useEffect, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import {
  activityLabel,
  INACTIVITY_MS,
  ownsWorking,
  terminal,
  useActivities,
  visibleActivities,
} from "@/lib/activities";
import { cardLater, useAgents } from "@/lib/agents";
import { api } from "@/lib/bridge";
import { useCached } from "@/lib/cache";
import { useNow, useSystemLook } from "@/lib/hooks";
import { useDuskie } from "@/lib/store";
import { type CalendarToday, isPaused } from "@/lib/types";
import { updateBusy } from "@/lib/updates";
import { useGuide } from "../island-guide";
import { useFocusLeft } from "../island-hooks";
import { soonMeeting } from "./helpers";
import type { IslandStore } from "./use-island-store";

export type IslandWork = ReturnType<typeof useIslandWork>;

export function useIslandWork(c: IslandStore) {
  const { agentWorking, asking, chatWorking, mascot, settings, updateActivity, updateNow, updateWorking } = c;
  const { waiting } = c;
  // A question opens the island by itself, unless Do Not Disturb, a
  // fullscreen app or a pause says to stay small; it shrinks back once
  // answered.
  const questionId = useAgents((s) => s.sessions.find((x) => x.question)?.question?.id ?? null);
  const fullscreen = useDuskie((s) => s.fullscreen);
  const [dndOn, setDndOn] = useState(false);
  const [peekId, setPeekId] = useState<string | null>(null);
  useEffect(() => {
    if (!questionId) return;
    let live = true;
    void api
      .dndGet()
      .then((v) => live && setDndOn(v === true))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [questionId]);
  // Skill / action in flight with Ask closed: same slim pill as chat/agents.
  // Combine outside a store selector so closed-over chat/agent labels stay fresh.
  const activityState = useActivities();
  const activityNow = useNow(1000);
  const keepProblems = true;
  const liveActivities = visibleActivities(
    [...activityState.activities, ...activityState.local],
    activityNow,
    keepProblems,
  );
  // A finished open already showed its done pill; holding it as a pill or a
  // bubble too would bring "Opening..." and the spinner back after the tick.
  const doneOpen = (a: (typeof liveActivities)[number]) => a.source === "open" && a.phase === "completed";
  const foreground = liveActivities.filter((a) => !["browser", "file"].includes(a.source) && !doneOpen(a));
  const backgroundAll = liveActivities.filter((a) => ["browser", "file"].includes(a.source));
  const background = backgroundAll.filter((a) => !terminal(a));
  const pausedDownloads = background.filter((a) => a.phase === "awaitingUser").length;
  const waitingDownloads = background.filter(
    (a) => a.phase === "unconfirmed" || activityNow - a.lastProgressAt >= INACTIVITY_MS,
  ).length;
  const skillWorking = foreground[0] ? activityLabel(foreground[0], activityNow) : null;
  const downloadWorking =
    background.length > 1
      ? pausedDownloads > 0
        ? `${background.length} downloads · ${pausedDownloads} paused`
        : waitingDownloads > 0
          ? `${background.length} downloads · ${waitingDownloads} awaiting progress`
          : `${background.length} downloads in progress`
      : backgroundAll[0]
        ? activityLabel(background[0] ?? backgroundAll[0], activityNow)
        : null;
  useEffect(() => {
    if (
      mascot !== "working" ||
      chatWorking ||
      agentWorking ||
      activityState.revision < 0 ||
      [...activityState.activities, ...activityState.local].some(ownsWorking)
    )
      return;
    const timer = setTimeout(() => {
      const current = useActivities.getState();
      if (
        [...current.activities, ...current.local].some(ownsWorking) ||
        useDuskie.getState().chatId ||
        useAgents.getState().sessions.some((s) => s.status === "working" || s.status === "waiting")
      )
        return;
      useDuskie.setState((s) => (s.mascot === "working" ? { mascot: "idle", running: null } : {}));
      void api.activityReconcile().catch(() => {});
    }, 1000);
    return () => clearTimeout(timer);
  }, [mascot, chatWorking, agentWorking, activityState]);
  const agentAsks = useAgents((s) => s.sessions.some((x) => x.status === "waiting"));
  const askingTitle = useAgents((s) => s.sessions.find((x) => x.status === "waiting")?.title ?? null);
  const { data: calendarToday } = useCached<CalendarToday>("calendar-today", api.calendarToday);
  const meetingSoon = soonMeeting(updateNow, calendarToday);
  const cardAgent = useAgents(
    (s) =>
      (
        s.sessions.find((x) => x.status === "waiting" && !cardLater(s.later, x)) ??
        s.sessions.find((x) => x.status === "working" && !cardLater(s.later, x))
      )?.id ?? null,
  );
  const splitAgent = useAgents(
    useShallow((s) => {
      const x = s.sessions.find((y) => y.status === "working");
      if (!x) return null;
      const mark = x.agent
        .split(/\s+/)
        .map((w) => w[0] ?? "")
        .join("")
        .slice(0, 2)
        .toUpperCase();
      return {
        id: x.id,
        agent: x.agent,
        mark,
        done: x.plan.filter((p) => p.status === "completed").length,
        total: x.plan.length,
      };
    }),
  );
  // Focus mode: a compact pill with the focus face and the time left.
  const focusUntil = useDuskie((s) => (s.ask ? null : s.focusUntil));
  const focusLeft = useFocusLeft(focusUntil);
  const askingCount = useAgents((s) => s.sessions.filter((x) => x.status === "waiting").length);
  const working = asking
    ? null
    : ((agentAsks ? agentWorking : null) ??
      updateWorking ??
      skillWorking ??
      chatWorking ??
      agentWorking ??
      // In Focus a download waits in a bubble beside the pill.
      (focusLeft !== null ? null : downloadWorking));
  // Prefer an exact label match. Multi-download and update-without-activity
  // labels are synthetic, so fall back to the owning row when find misses.
  const displayedActivity = working
    ? (liveActivities.find((a) => activityLabel(a, activityNow) === working) ??
      (working === downloadWorking ? (background[0] ?? backgroundAll[0]) : undefined) ??
      (working === updateWorking ? (updateActivity ?? undefined) : undefined))
    : undefined;
  const activityWaiting =
    (working === downloadWorking && background.length > 1 && (pausedDownloads > 0 || waitingDownloads > 0)) ||
    (displayedActivity &&
      !terminal(displayedActivity) &&
      (displayedActivity.phase === "awaitingUser" ||
        displayedActivity.phase === "unconfirmed" ||
        activityNow - displayedActivity.lastProgressAt >= INACTIVITY_MS));
  // An agent waiting on an answer: the mascot looks up curious and the pill
  // shows an amber dot instead of the busy bars.
  const asksYou = agentAsks && working === agentWorking;
  const guide = useGuide(waiting);
  // Voice with Ask closed: a compact pill while listening and thinking; the
  // island opens only when the answer starts.
  const hearing = useDuskie((s) => (s.ask ? null : s.hearing));
  const live = useDuskie((s) => (s.ask ? null : s.live));
  // Karaoke words while speaking, even with Ask open - the compact pill
  // still shows what is being said.
  const spokenCaption = useDuskie((s) => s.spokenCaption);
  const voiceQuestion = useDuskie((s) => (s.ask ? null : s.voiceQuestion));
  // Something finished that needs nothing more: a short done pill.
  // Also covers mascot success without Undo / Open (e.g. "Switched to Claude"
  // after Settings closed, showDone was skipped while Ask was open).
  const donePill = useDuskie((s) => {
    if (s.ask || updateBusy(s.updateProgress)) return null;
    if (s.donePill) return s.donePill;
    if (s.mascot !== "success") return null;
    const r = s.lastResult;
    if (r?.undoId != null || r?.path) return null;
    return r?.message ?? "Done";
  });
  const doneUndo = useDuskie((s) => s.doneUndo);
  // Success that still needs Undo or Open folder: keep the expanded card.
  const successCard = useDuskie((s) => {
    if (s.ask || s.mascot !== "success") return false;
    const r = s.lastResult;
    return !!(r && (r.undoId != null || r.path));
  });
  const reduced = useReducedMotion() ?? false;
  const look = useSystemLook();
  const now = useNow(15_000);
  const paused = isPaused(settings.pause, now);
  const out0 = { activityNow, activityWaiting, askingCount, askingTitle, asksYou, cardAgent, displayedActivity };
  const out1 = { dndOn, doneOpen, donePill, doneUndo, focusLeft, focusUntil, fullscreen, guide, hearing, live };
  const out2 = {
    liveActivities,
    look,
    meetingSoon,
    paused,
    peekId,
    questionId,
    reduced,
    setPeekId,
    skillWorking,
    spokenCaption,
  };
  const out3 = { splitAgent, successCard, voiceQuestion, working };
  return { ...out0, ...out1, ...out2, ...out3 };
}
