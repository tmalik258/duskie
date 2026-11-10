"use client";

import { useMotionValue } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/bridge";
import { connect, useDuskie, watchWaiting } from "@/lib/store";
import { COMPACT } from "../island-layout";
import { voiceShellWidth } from "../island-voice/tail";
import type { IslandHover } from "./use-island-hover";
import type { IslandStore } from "./use-island-store";
import type { IslandWork } from "./use-island-work";

export type IslandFace = ReturnType<typeof useIslandFace>;

export function useIslandFace(c: IslandStore & IslandWork & IslandHover) {
  const { agentCurrent, agentsLayout, agentsOnly, askTab, asking, asksYou, busy, dockBeside, expanded } = c;
  const { focusLeft, hearing, mascot, online, paused, questionId, setContentHeight, suggestion, updateProgress } = c;
  const { view, voicePill, voiceQuestion, waiting } = c;

  const bump = useMotionValue(1);
  // A mood (thanks, Claude finished) shows for a moment; offline and at
  // rest, the mascot looks a little lost.
  const mood = useDuskie((s) => s.mood);
  const speaking = useDuskie((s) => s.speaking);
  const face =
    mood?.id ??
    (asksYou && !voiceQuestion && hearing === null ? "curious" : null) ??
    (focusLeft !== null && !voiceQuestion && hearing === null && mascot !== "listening" ? "focus" : null) ??
    (paused && !voiceQuestion && hearing === null ? "sleep" : null) ??
    (speaking && mascot !== "listening"
      ? "speak"
      : !online && (mascot === "idle" || mascot === "sleeping")
        ? "oops"
        : null);
  const contentEl = useRef<HTMLDivElement | null>(null);

  useEffect(() => connect({ sounds: true }), []);
  // The window stays hidden until this page has drawn, so it never flashes
  // an empty black frame at startup. Two frames: the first one is painted.
  useEffect(() => {
    let raf = requestAnimationFrame(() => {
      raf = requestAnimationFrame(() => void api.islandReady().catch(() => {}));
    });
    return () => cancelAnimationFrame(raf);
  }, []);
  useEffect(() => watchWaiting(), []);

  // Measure expanded content so the capsule grows exactly to fit it. A
  // callback ref, because the content node mounts and unmounts with expansion.
  const observer = useRef<ResizeObserver | null>(null);
  const contentRef = useCallback(
    (el: HTMLDivElement | null) => {
      // Keep the last height while the node is gone (AnimatePresence swaps);
      // zeroing here collapses Settings/Welcome mid-transition. The outgoing
      // panel's null comes after the new panel attached, so it must not
      // disconnect the new panel's observer.
      if (!el) return;
      observer.current?.disconnect();
      contentEl.current = el;
      const measure = () => setContentHeight(el.offsetHeight);
      measure();
      observer.current = new ResizeObserver(measure);
      observer.current.observe(el);
    },
    [setContentHeight],
  );

  // Remeasure after paint when Ask content swaps (New, stream, view change),
  // so a stale tall height does not stick after the chat clears.
  const turnsLen = useDuskie((s) => s.turns.length);
  const chatId = useDuskie((s) => s.chatId);
  // biome-ignore lint/correctness/useExhaustiveDependencies: triggers only, remeasure when Agents body changes size
  useEffect(() => {
    if (!asking) return;
    let id2 = 0;
    const id1 = requestAnimationFrame(() => {
      id2 = requestAnimationFrame(() => {
        const el = contentEl.current;
        if (el) setContentHeight(el.offsetHeight);
      });
    });
    return () => {
      cancelAnimationFrame(id1);
      cancelAnimationFrame(id2);
    };
  }, [asking, view, turnsLen, chatId, askTab, agentCurrent, agentsLayout]);

  const showGuide =
    !!waiting &&
    !waiting.background &&
    !suggestion &&
    questionId === null &&
    !updateProgress &&
    (mascot === "idle" || mascot === "sleeping");
  const pillWidth = voicePill
    ? voiceShellWidth(voicePill.text, voicePill.thinking, {
        status: !!(
          voicePill.working ||
          voicePill.done ||
          voicePill.waiting ||
          voicePill.failed ||
          voicePill.focus ||
          voicePill.asks
        ),
        cancel: agentsOnly || !!voicePill.focus,
        indicator: !!(
          voicePill.working ||
          voicePill.thinking ||
          voicePill.done ||
          voicePill.waiting ||
          voicePill.failed ||
          voicePill.asks ||
          (voicePill.dots && voicePill.dots.length > 0)
        ),
      })
    : waiting
      ? COMPACT.waitWidth
      : busy
        ? COMPACT.busyWidth
        : !online
          ? COMPACT.offlineWidth
          : COMPACT.width;
  // The bounce is for opening only; once open, size changes are calm.
  const [settled, setSettled] = useState(false);
  useEffect(() => {
    if (!expanded && !asking) {
      setSettled(false);
      return;
    }
    setSettled(false);
    const id = setTimeout(() => setSettled(true), 600);
    return () => clearTimeout(id);
  }, [expanded, asking]);
  // Dock open/close is a fresh shell morph - reset to GROW (not SETTLE).
  useEffect(() => {
    if (!asking) return;
    setSettled(false);
    // Hold GROW a beat longer while the dock slides in from the seam.
    const id = setTimeout(() => setSettled(true), dockBeside ? 700 : 500);
    return () => clearTimeout(id);
  }, [dockBeside, asking]);
  return { bump, contentRef, face, pillWidth, settled, showGuide };
}
