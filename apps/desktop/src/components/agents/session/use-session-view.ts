"use client";

// A session's draft, scroll position and review state, kept across switches
// and restarts, with the timeline pinned to the bottom while it follows.

import { type UIEvent, useEffect, useLayoutEffect, useRef, useState } from "react";
import { closeReview, flushAgentsView, openReview, type Session, sendToSession, sessionView } from "@/lib/agents";
import { stacked } from "@/lib/seam";
import { stickBottom } from "./format";

export function useSessionView(s: Session, active: boolean) {
  const [text, setLocalText] = useState(s.view?.draft ?? "");
  const textRef = useRef(text);
  const savedScroll = s.view?.scroll ?? 0;
  const savedFollow = s.view?.follow ?? true;
  const scrollState = useRef({
    scroll: savedScroll,
    // Coerce corrupted prefs so reopen does not land at the top of a 200kpx timeline.
    follow: savedFollow === false && savedScroll <= 0 ? true : savedFollow,
  });
  // biome-ignore lint/correctness/useExhaustiveDependencies: restore draft/scroll only when the session switches
  useEffect(() => {
    const draft = s.view?.draft ?? "";
    textRef.current = draft;
    setLocalText(draft);
    const scroll = s.view?.scroll ?? 0;
    const follow = s.view?.follow ?? true;
    scrollState.current = { scroll, follow: follow === false && scroll <= 0 ? true : follow };
  }, [s.id]);
  const setText = (draft: string) => {
    textRef.current = draft;
    setLocalText(draft);
  };
  const flushView = () => {
    const st = scrollState.current;
    const follow = stickBottom(st);
    sessionView(s.id, { draft: textRef.current, scroll: st.scroll, follow });
    flushAgentsView();
  };
  const reviewing = s.view?.reviewing ?? false;
  const reviewStacked = reviewing && stacked(typeof window === "undefined" ? 1920 : window.screen.availWidth);
  const setReviewing = (next: boolean) => {
    sessionView(s.id, { draft: textRef.current, ...scrollState.current });
    if (next) openReview(s.id);
    else closeReview(s.id);
  };
  const scroll = useRef<HTMLDivElement>(null);
  // Restore scroll before paint; ResizeObserver keeps follow pinned while Markdown grows.
  // Skip while warm/hidden, hidden nodes report scrollHeight 0 and would wipe the saved offset.
  // biome-ignore lint/correctness/useExhaustiveDependencies: follow new entry count, not every streamed token array identity
  useLayoutEffect(() => {
    if (!active) return;
    const el = scroll.current;
    if (!el) return;
    const apply = () => {
      el.scrollTop = stickBottom(scrollState.current) ? el.scrollHeight : scrollState.current.scroll;
    };
    apply();
    const ro = new ResizeObserver(() => {
      if (stickBottom(scrollState.current)) el.scrollTop = el.scrollHeight;
    });
    ro.observe(el);
    const id = requestAnimationFrame(apply);
    return () => {
      ro.disconnect();
      cancelAnimationFrame(id);
    };
  }, [s.id, reviewing, s.entries.length, s.plan.length, s.question, s.status, active]);
  // The cleanup intentionally captures the current session identity.
  // biome-ignore lint/correctness/useExhaustiveDependencies: saves on session switch/unmount
  useEffect(() => {
    if (!active) return;
    const onHide = () => flushView();
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", onHide);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", onHide);
      flushView();
    };
  }, [s.id, active]);

  const onScroll = (e: UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    scrollState.current = { scroll: el.scrollTop, follow: el.scrollHeight - el.scrollTop - el.clientHeight < 48 };
  };
  const send = () => {
    const t = text.trim();
    if (!t) return;
    sendToSession(s.id, t);
    setText("");
    sessionView(s.id, { draft: "", ...scrollState.current });
  };
  return { text, setText, scroll, onScroll, flushView, reviewing, reviewStacked, setReviewing, send };
}
