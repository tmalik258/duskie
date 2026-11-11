"use client";

// Part of board: state, firstAsk, lastSteps, lastSay, plain.

import type { Session } from "@/lib/agents";
import { STEP_TAG } from "../session/format";

export function state(s: Session): [string, string] {
  if (s.question) return ["ask", "Needs you"];
  if (s.status === "working" || s.status === "waiting") return ["run", "Working"];
  if (s.status === "ended" || s.status === "failed") return ["off", s.status === "failed" ? "Failed" : "Paused"];
  return ["done", "Done"];
}

/** The last few steps, tagged like the transcript; the running one shimmers. */
/** What it was asked to do, for a tile with nothing newer to show. */
export function firstAsk(s: Session): string {
  const first = s.entries.find((e) => e.kind === "you");
  return first?.kind === "you" ? first.text : "";
}

export function lastSteps(s: Session): { tag: string; text: string; live: boolean }[] {
  const out: { tag: string; text: string; live: boolean }[] = [];
  for (let i = s.entries.length - 1; i >= 0 && out.length < 3; i--) {
    const e = s.entries[i];
    if (e.kind === "step") {
      const live = e.step.state === "running";
      out.unshift({
        tag: live ? "···" : (STEP_TAG[e.step.tool] ?? e.step.tool),
        text: e.step.detail ? `${e.step.label} ${e.step.detail}` : e.step.label,
        live,
      });
    }
  }
  return out;
}

/** The newest thing the agent said, for a finished tile. */
export function lastSay(s: Session): string | null {
  for (let i = s.entries.length - 1; i >= 0; i--) {
    const e = s.entries[i];
    if (e.kind === "text") return e.text.trim();
    if (e.kind === "you") return null;
  }
  return null;
}

/** A reply as plain text for a tile: no **, `, # or [link](url) marks. */
export function plain(md: string): string {
  return md
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/(\*\*|__|`)/g, "")
    .replace(/^\s*(#+|[-*]|\d+\.)\s+/gm, "")
    .replace(/\s+/g, " ")
    .trim();
}
