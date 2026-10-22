"use client";
import { useEffect, useState } from "react";
import { terminal } from "@/lib/activities";
import { api } from "@/lib/bridge";
import { useIntent } from "../island-hooks";
import { OPEN_STATES, SHELL_HOVER_IN_MS, SHELL_HOVER_OUT_MS } from "../island-layout";
import type { IslandStore } from "./use-island-store";
import type { IslandWork } from "./use-island-work";

export type IslandHover = ReturnType<typeof useIslandHover>;

export function useIslandHover(c: IslandStore & IslandWork) {
  const { activityWaiting, agentDots, agentWorking, asking, asksYou, chatWorking, chatting, displayedActivity } = c;
  const { dndOn, donePill, focusLeft, fullscreen, hearing, justDone, live, liveActivities, mascot, meetingSoon } = c;
  const { merging, netShown, online, paused, questionId, rawHover, settings, skillWorking, successCard } = c;
  const { suggestion, updateProgress, updateWorking, voiceQuestion, voiceStatus, waiting, working } = c;
  // Closing a panel (Hide, Esc, Done) goes straight to the small orb. The
  // hover card stays off until the cursor leaves and comes back; otherwise
  // shrinking the hit rect clears quiet while useIntent still thinks we are
  // hovering, and "Watching for moments" flashes.
  const [contentHeight, setContentHeight] = useState(0);
  const [prevAsking, setPrevAsking] = useState(asking);
  const [quiet, setQuiet] = useState(false);
  if (prevAsking !== asking) {
    setPrevAsking(asking);
    if (!asking) setQuiet(true);
    // Drop stale panel height on Ask open so the shell grows from compact
    // instead of opening tall and shrinking to the new measure.
    if (asking) setContentHeight(0);
  }
  // Cleared only once the cursor has been away as long as hover intent takes
  // to fall; clearing at once let a stale intent reopen a just-hidden welcome.
  useEffect(() => {
    if (!quiet || rawHover) return;
    const id = setTimeout(() => setQuiet(false), SHELL_HOVER_OUT_MS);
    return () => clearTimeout(id);
  }, [quiet, rawHover]);
  const intent = useIntent(rawHover && !quiet, SHELL_HOVER_IN_MS);

  // Full suggestion card as soon as it arrives - no fresh pill / compact peek.
  const notifyFresh = meetingSoon !== null && !paused;
  // Until onboarding is done, hover shows the steps being waited on, or else
  // brings the welcome back; the idle card ("watching for moments") would
  // just flash on the way.
  const guideOnHover = !!waiting && !waiting.background;
  // Pending actions take priority over resuming onboarding on hover.
  const needsAttention =
    !!suggestion ||
    questionId !== null ||
    merging ||
    updateProgress !== null ||
    mascot === "error" ||
    skillWorking !== null;
  const hovered = intent && !quiet && (settings.onboarded || guideOnHover || needsAttention);
  const resumeWelcome =
    intent &&
    !quiet &&
    !settings.onboarded &&
    !asking &&
    !guideOnHover &&
    !needsAttention &&
    !justDone &&
    mascot !== "success";
  useEffect(() => {
    if (resumeWelcome) void api.askResumeWelcome();
  }, [resumeWelcome]);
  const preparingVoice =
    !settings.onboarded &&
    !asking &&
    !needsAttention &&
    !waiting &&
    !(voiceStatus?.models.some((m) => m.id === "voice" && m.installed) ?? false);
  // A guide stays open while Duskie waits on something you finish elsewhere.
  const guiding = !!waiting && !waiting.minimized && (waiting.steps?.length ?? 0) > 0;
  // Voice / in-flight Ask with Ask closed: Listening / Thinking / Working pill.
  // Stay non-bare so the hit rect stays usable (Idle alone would shrink to a
  // pinprick and lock out).
  const voiceBusy =
    hearing !== null ||
    voiceQuestion !== null ||
    donePill !== null ||
    mascot === "listening" ||
    working !== null ||
    focusLeft !== null;
  const voicePill: {
    text: string;
    thinking: boolean;
    working?: boolean;
    done?: boolean;
    focus?: boolean;
    asks?: boolean;
    waiting?: boolean;
    failed?: boolean;
    dots?: string[];
  } | null = asking
    ? null
    : donePill !== null
      ? { text: donePill, thinking: false, done: true }
      : voiceQuestion !== null
        ? { text: voiceQuestion, thinking: true }
        : hearing !== null || mascot === "listening"
          ? { text: hearing ?? "", thinking: false }
          : live !== null
            ? { text: live.caption || (live.tool ?? ""), thinking: !live.caption }
            : working !== null
              ? {
                  text: working,
                  thinking: !asksYou && !activityWaiting && (!displayedActivity || !terminal(displayedActivity)),
                  working: true,
                  asks: asksYou,
                  waiting: !!activityWaiting,
                  done: displayedActivity?.phase === "completed",
                  failed: displayedActivity?.phase === "failed",
                  dots: agentDots,
                }
              : focusLeft !== null
                ? { text: `Focus · ${focusLeft}`, thinking: false, focus: true }
                : null;
  // Only agents at work: hover lists them (and answers in place) instead of
  // opening Ask.
  const agentsOnly = voiceQuestion === null && hearing === null && chatWorking === null && agentWorking !== null;
  // Full listening style: the island opens while you talk, with a waveform,
  // a timer and your words larger, instead of the slim pill.
  const fullVoice =
    voicePill !== null &&
    !voicePill.working &&
    !voicePill.focus &&
    !voicePill.done &&
    (settings.voice.listeningStyle ?? "compact") === "full";
  // Suggestions stay normal during thinking, do not gate them on !voicePill.
  const askOpens =
    questionId !== null && !dndOn && !fullscreen && !paused && settings.onboarded && agentsOnly && !quiet;
  const expanded =
    asking ||
    askOpens ||
    fullVoice ||
    preparingVoice ||
    // Pause stays a compact pill on hover (sleep mascot at rest), not glance.
    (hovered && !paused && (!voicePill || agentsOnly || updateWorking !== null || liveActivities.length > 0)) ||
    guiding ||
    (OPEN_STATES.has(mascot) && !voicePill && mascot === "suggesting") ||
    successCard ||
    !!suggestion ||
    (netShown && !voicePill) ||
    updateProgress?.phase === "failed" ||
    merging;
  // Paused at rest: bare sleep sphere; hover reveals the compact paused pill.
  const showPausedPill = paused && hovered && !asking && !voicePill;
  // At rest only the sphere shows. The shell keeps its size (so hover and the
  // orb position do not move) but loses its background.
  const bare =
    !expanded &&
    !chatting &&
    !waiting &&
    !voiceBusy &&
    !showPausedPill &&
    online &&
    (mascot === "idle" || mascot === "sleeping");
  const busy = chatting || preparingVoice || voiceBusy || mascot === "noticing" || mascot === "working";

  // Hover while Thinking or Working: open Ask so the island is usable, not a dead pill.
  useEffect(() => {
    if (!intent || quiet || asking || !settings.onboarded || updateWorking !== null || suggestion) return;
    if (voiceQuestion === null && liveActivities.length > 0) return;
    if (voiceQuestion === null && working === null) return;
    if (agentsOnly) return;
    void api.askOpen();
  }, [
    intent,
    quiet,
    asking,
    settings.onboarded,
    voiceQuestion,
    working,
    agentsOnly,
    updateWorking,
    suggestion,
    liveActivities.length,
  ]);
  const out0 = { agentsOnly, bare, busy, contentHeight, expanded, fullVoice, guiding, hovered, notifyFresh };
  const out1 = { preparingVoice, setContentHeight, showPausedPill, voicePill };
  return { ...out0, ...out1 };
}
