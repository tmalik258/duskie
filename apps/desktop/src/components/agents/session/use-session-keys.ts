"use client";

// A session's Alt shortcuts: review, terminal and editor when done, /compact
// when offered, and Allow / Allow this session / Deny while a question waits.

import { useEffect } from "react";
import { answerQuestion, type Session, sendToSession } from "@/lib/agents";
import { api } from "@/lib/bridge";

export function useSessionKeys(
  s: Session,
  {
    done,
    editor,
    offerCompact,
    onReview,
  }: { done: boolean; editor: string | null; offerCompact: boolean; onReview: () => void },
) {
  // Alt 1 reviews, Alt 2 (or Alt T) carries on in a terminal.
  // biome-ignore lint/correctness/useExhaustiveDependencies: onReview is recreated each render; s.id covers the session
  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (!e.altKey || e.ctrlKey || e.metaKey) return;
      const k = e.key.toLowerCase();
      if (k === "t" || (k === "2" && done)) {
        e.preventDefault();
        void api.agentTerminal(s.id);
      } else if (k === "1" && done && s.reviewable && s.changes !== 0) {
        e.preventDefault();
        onReview();
      } else if (k === "3" && done && editor) {
        e.preventDefault();
        void api.agentOpenEditor(s.id);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [s.id, done, s.reviewable, s.changes, editor]);

  // Half the context used: offer /compact (Alt K), Claude Code only.
  useEffect(() => {
    if (!offerCompact) return;
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (!e.altKey || e.ctrlKey || e.metaKey || e.key.toLowerCase() !== "k") return;
      e.preventDefault();
      sendToSession(s.id, "/compact");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [s.id, offerCompact]);

  // Alt A, Y, N answer a question while one waits.
  useEffect(() => {
    if (!s.question) return;
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || !e.altKey) return;
      const k = e.key.toLowerCase();
      const answer = k === "a" ? "allow" : k === "y" ? "always" : k === "n" ? "deny" : null;
      if (!answer) return;
      e.preventDefault();
      answerQuestion(s.id, answer);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [s.id, s.question]);
}
