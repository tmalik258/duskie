"use client";

// One hover glance: day head with quick actions beside it, then optional
// sections (needs you, away, activity, later, tip). Cached data shows at
// once and refreshes behind.

import { useEffect, useState } from "react";
import { useActivities, visibleActivities } from "@/lib/activities";
import { useAgents } from "@/lib/agents";
import { api } from "@/lib/bridge";
import { useCached } from "@/lib/cache";
import { useNow } from "@/lib/hooks";
import type { AppTime, CalendarToday } from "@/lib/types";
import { ActivityProgress } from "./activity-progress";
import { Ic } from "./icon";
import { NeedsYouSection } from "./island-agents";
import { AwaySection } from "./island-agents/away-ms";
import { LaterList } from "./island-glance/later-list";
import { FullscreenSwitch, headline, QuietTip } from "./island-glance/qb-class";
import {
  CrashCard,
  FOCUS_MAX,
  FOCUS_MIN,
  FOCUS_PRESETS,
  QuickActions,
  readLastFocus,
  writeLastFocus,
} from "./island-glance/quick-actions";

/** Unified island hover: stacked sections, empty ones omit themselves. */
export function Glance({ paused }: { paused: boolean }) {
  const sessions = useAgents((s) => s.sessions);
  const agentsLive = sessions.some((s) => s.status === "working" || s.status === "waiting");
  const { data: crash, refresh: refreshCrash } = useCached<string | null>("crash", api.crashPending);
  const activityState = useActivities();
  const activityNow = useNow(1000);
  // Agent/chat rows belong in the agents list, not the flat activity line.
  const otherActivities = visibleActivities(
    [...activityState.activities, ...activityState.local],
    activityNow,
    true,
  ).filter((a) => !(agentsLive && (a.source === "agent" || a.source === "chat")));
  const now = useNow(30_000);
  const { data: calendar } = useCached<CalendarToday>("calendar-today", api.calendarToday);
  const { data: time } = useCached<AppTime[]>("time-today", api.timeToday);
  const head = headline(now, paused, calendar, time);
  const [focusOpen, setFocusOpen] = useState(false);
  const eyebrow = new Date(now).toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" });
  return (
    <div className="rd-glance">
      {crash && <CrashCard note={crash} onDone={() => void refreshCrash()} />}
      <div className="rd-ghead-wrap">
        <div className="rd-ghead">
          <div className="rd-card-head">
            <p className="rd-eyebrow">{eyebrow}</p>
            <p className="rd-title">{head.title}</p>
          </div>
          <div className="rd-ghead-actions">
            {head.join ? (
              <button
                type="button"
                className="rd-gfoot-btn"
                onClick={() => void api.openReference("page", head.join ?? "")}
              >
                Join
              </button>
            ) : null}
            <QuickActions paused={paused} focusOpen={focusOpen} onFocusOpenChange={setFocusOpen} />
          </div>
        </div>
        <p className="rd-detail">{head.detail}</p>
      </div>
      {focusOpen && <FocusPicker onDone={() => setFocusOpen(false)} />}
      <NeedsYouSection sessions={sessions} />
      <AwaySection />
      {otherActivities.length > 0 && (
        <div style={{ marginLeft: "calc(var(--orb-indent, 0px) * -1)" }}>
          <ActivityProgress sources={["update", "browser", "file", "action", "open"]} />
        </div>
      )}
      <FullscreenSwitch />
      <LaterList />
      {head.quiet && <QuietTip />}
    </div>
  );
}

/** Choose how long, then start, presets plus a quiet custom stepper. */
function FocusPicker({ onDone }: { onDone: () => void }) {
  const [minutes, setMinutes] = useState(readLastFocus);
  const start = (n: number) => {
    const next = Math.min(FOCUS_MAX, Math.max(FOCUS_MIN, Math.round(n)));
    writeLastFocus(next);
    void api.focusStart(next);
    onDone();
  };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onDone();
      }
      if (e.key === "Enter") {
        e.preventDefault();
        start(minutes);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });
  const nudge = (delta: number) => setMinutes((m) => Math.min(FOCUS_MAX, Math.max(FOCUS_MIN, m + delta)));
  return (
    <div
      className="rise-in rounded-[12px] bg-(--fill-2) p-3 shadow-[inset_0_0_0_1px_var(--line)]"
      style={{ marginLeft: "calc(var(--orb-indent, 0px) * -1)" }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-display text-[14px] leading-5 font-semibold tracking-[-0.015em] text-(--ink)">Focus</p>
          <p className="mt-0.5 text-[12px] leading-4 text-(--ink-2)">Suggestions and alerts wait until you are done.</p>
        </div>
        <div className="flex shrink-0 items-center gap-1 rounded-[10px] bg-(--fill) px-1 py-0.5 shadow-[inset_0_0_0_1px_var(--line)]">
          <button
            type="button"
            aria-label="Five minutes less"
            onClick={() => nudge(-5)}
            className="chip grid size-7 place-items-center rounded-[8px] text-(--ink-2) hover:bg-(--fill-2) hover:text-(--ink)"
          >
            −
          </button>
          <span className="min-w-[4.5rem] text-center font-display text-[15px] font-semibold tracking-[-0.02em] text-(--ink) tabular-nums">
            {minutes}
            <span className="ml-1 text-[11px] font-medium text-(--ink-2)">min</span>
          </span>
          <button
            type="button"
            aria-label="Five minutes more"
            onClick={() => nudge(5)}
            className="chip grid size-7 place-items-center rounded-[8px] text-(--ink-2) hover:bg-(--fill-2) hover:text-(--ink)"
          >
            +
          </button>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {FOCUS_PRESETS.map((n) => {
          const on = minutes === n;
          return (
            <button
              key={n}
              type="button"
              onClick={() => setMinutes(n)}
              className={`chip min-h-8 rounded-[10px] px-3 text-[12.5px] font-medium tracking-[-0.01em] tabular-nums transition-[background,color,transform] duration-150 ${
                on ? "bg-(--c2) text-(--c1)" : "bg-(--fill) text-(--ink-2) hover:bg-(--fill-2) hover:text-(--ink)"
              }`}
            >
              {n}m
            </button>
          );
        })}
      </div>
      <div className="mt-3 flex items-center gap-2">
        <button
          type="button"
          onClick={() => start(minutes)}
          className="chip flex min-h-9 flex-1 items-center justify-center gap-2 rounded-[10px] bg-(--c2) px-4 text-[13px] font-semibold tracking-[-0.01em] text-(--c1) hover:opacity-92 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--c4)"
        >
          <Ic name="focus" size={14} />
          Start {minutes} minutes
          <kbd className="ml-0.5 font-sans text-[11px] font-medium text-(--c1)/40">Enter</kbd>
        </button>
        <button
          type="button"
          onClick={onDone}
          className="chip shrink-0 rounded-[10px] px-3 py-2 text-[12.5px] text-(--ink-2) hover:bg-(--fill) hover:text-(--ink)"
        >
          Not now
        </button>
      </div>
    </div>
  );
}
