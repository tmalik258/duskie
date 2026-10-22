"use client";

// Part of island-agents: AWAY_MS, SEEN_KEY, readSeen, useSeen, markSeen, openSession, ago, clock, useKeys, liveSessions, agentRow, useAway, AwaySection, AwayCard.

import { useEffect } from "react";
import { create } from "zustand";
import { type Session, useAgents } from "@/lib/agents";
import { api } from "@/lib/bridge";
import { useCached } from "@/lib/cache";
import { useNow } from "@/lib/hooks";
import { agoText, clockText } from "@/lib/time-text";
import type { InboxStatus } from "@/lib/types";
import { CardChips, CardHead, CardList, type CardRow } from "../island-card";

/** Away this long before the island shows what happened meanwhile. */
const AWAY_MS = 3 * 60_000;

const SEEN_KEY = "sidekick.seenAt";

function readSeen(): number {
  try {
    return Number(localStorage.getItem(SEEN_KEY)) || Date.now();
  } catch {
    return Date.now();
  }
}

/** When the user last looked at what Duskie had for them. */
export const useSeen = create<{ at: number }>(() => ({ at: typeof window === "undefined" ? 0 : readSeen() }));

export function markSeen() {
  const at = Date.now();
  useSeen.setState({ at });
  try {
    localStorage.setItem(SEEN_KEY, String(at));
  } catch {
    // Not kept: the card may show again after a restart.
  }
}

/** Opens Ask on the Agents tab at one session. */
export function openSession(id: string) {
  useAgents.setState({ tab: "agents", current: id });
  void api.askOpen();
}

const ago = (ms: number, now: number) => agoText(ms, { atLeastOne: true }, now);

const clock = clockText;

/** Keys for the chips under a card: Enter and Alt + a letter or digit. */
export function useKeys(keys: Record<string, (() => void) | undefined>) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const k = e.key === "Enter" ? "Enter" : e.altKey ? `Alt ${e.key.toUpperCase()}` : null;
      const run = k ? keys[k] : undefined;
      if (!run) return;
      e.preventDefault();
      run();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });
}

export function liveSessions(sessions: Session[]) {
  return sessions.filter((s) => s.status === "working" || s.status === "waiting");
}

export function agentRow(s: Session, now: number): CardRow {
  const last = [...s.entries].reverse().find((e) => e.kind === "step");
  const step = last?.kind === "step" ? last.step.label : "Working";
  return {
    key: s.id,
    dot: s.question ? ("wait" as const) : undefined,
    title: s.title,
    detail: s.question ? `Wants to ${s.question.label.toLowerCase()}` : `${s.agent} \u00b7 ${step}`,
    right: s.question ? "Waiting" : clock(now - s.turnAt),
    onClick: () => openSession(s.id),
  };
}

/** What finished or started waiting since the user last looked. */
export function useAway(): {
  rows: CardRow[];
  reviewId: string | null;
  waitingId: string | null;
  agent: string | null;
} {
  const seen = useSeen((s) => s.at);
  const sessions = useAgents((s) => s.sessions);
  const { data: inbox } = useCached<InboxStatus>("inbox-status", api.notificationsStatus);
  const now = useNow(60_000);
  const rows: CardRow[] = [];
  let reviewId: string | null = null;
  let waitingId: string | null = null;
  let agent: string | null = null;
  if (now - seen < AWAY_MS) return { rows, reviewId, waitingId, agent };
  for (const s of sessions) {
    const endedAt = s.tookMs !== null ? s.turnAt + s.tookMs : null;
    if (s.question) {
      waitingId ??= s.id;
      agent ??= s.agent;
      rows.push({
        key: s.id,
        dot: "wait",
        title: `${s.agent} is waiting`,
        detail: `${s.title} · wants to ${s.question.label.toLowerCase()}`,
        right: ago(s.turnAt, now),
        onClick: () => openSession(s.id),
      });
    } else if (endedAt && endedAt > seen && (s.status === "idle" || s.status === "ended")) {
      if (s.reviewable && s.changes > 0) reviewId ??= s.id;
      rows.push({
        key: s.id,
        dot: "done",
        title: `${s.agent} finished`,
        detail: `${s.title}${s.changes ? ` · ${s.changes} ${s.changes === 1 ? "change" : "changes"} to review` : ""}`,
        right: ago(endedAt, now),
        onClick: () => openSession(s.id),
      });
    }
  }
  for (const n of inbox?.items ?? []) {
    const at = Date.parse(n.ts);
    if (rows.length >= 5 || !(at > seen) || (n.level !== "now" && n.level !== "soon")) continue;
    rows.push({ key: `n${n.id}`, title: n.title || n.app, detail: n.app, right: ago(at, now) });
  }
  return { rows, reviewId, waitingId, agent };
}

/** "While you were away", glance section; null when nothing to report. */
export function AwaySection() {
  const { rows, reviewId, waitingId, agent } = useAway();
  const review = reviewId ? () => openSession(reviewId) : undefined;
  const answer = waitingId ? () => openSession(waitingId) : undefined;
  useKeys(
    rows.length > 0 ? { "Alt 1": review ?? answer, "Alt 2": review ? answer : undefined, "Alt X": markSeen } : {},
  );
  if (rows.length === 0) return null;
  const done = rows.filter((r) => r.dot === "done").length;
  const waits = rows.filter((r) => r.dot === "wait").length;
  const parts = [
    done && `${done} finished`,
    waits && `${waits} waiting for you`,
    rows.length - done - waits && `${rows.length - done - waits} new`,
  ].filter(Boolean);
  const options = [
    review && { label: "Review the change", keys: "Alt 1", run: review },
    answer && { label: `Answer ${agent}`, keys: review ? "Alt 2" : "Alt 1", run: answer },
  ].filter((o): o is { label: string; keys: string; run: () => void } => !!o);
  return (
    <div className="mt-3 flex flex-col">
      <CardHead title="While you were away" detail={parts.join(" \u00b7 ")} />
      <CardList
        label="Since you last looked"
        action={
          <button type="button" onClick={markSeen} className="chip hover:text-white">
            Clear all{" "}
            <kbd className="ml-1 font-sans text-[11px] text-white/45">
              <i className="alt-pre">Alt </i>X
            </kbd>
          </button>
        }
        rows={rows}
      />
      {options.length > 0 && <CardChips options={options} />}
    </div>
  );
}

/** @deprecated Prefer AwaySection inside the unified glance. */
export function AwayCard() {
  return <AwaySection />;
}
