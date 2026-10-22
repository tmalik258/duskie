"use client";

// Part of island-glance: qbClass, MEETING_SOON_MIN, LATER_SHOWN, openAgentsBoard, openHistory, QuietTip, FullscreenSwitch, Headline, at, nextMeeting, topFocus, headline, ago.

import { useState } from "react";
import { setTab, useAgents } from "@/lib/agents";
import { api } from "@/lib/bridge";
import { updateSettings, useDuskie } from "@/lib/store";
import { minutesText } from "@/lib/time-text";
import { pickTip } from "@/lib/tips";
import { type AppTime, type CalendarToday, formatDuration } from "@/lib/types";

/** Round quick-action button (porcelain chrome). */
export const qbClass = "rd-qb chip relative grid size-7 place-items-center overflow-hidden";

/** A meeting this close (or already on) takes the headline. */
const MEETING_SOON_MIN = 60;

/** Missed items shown before "Show N more". */
export const LATER_SHOWN = 3;

export function openAgentsBoard() {
  useAgents.setState({ tab: "agents", layout: "board" });
  void api.askOpen();
}

export function openHistory() {
  setTab("history");
  void api.askOpen();
}

/** About one hover in four, when nothing needs you: one short tip, never
 * the same one twice in a row. */
export function QuietTip() {
  const on = useDuskie((s) => s.settings.tips);
  const later = useDuskie((s) => s.later);
  const [tip] = useState(pickTip);
  if (!on || later > 0 || !tip) return null;
  return (
    <p className="rd-list-row flex items-baseline gap-2" style={{ marginLeft: "calc(var(--orb-indent, 0px) * -1)" }}>
      <span className="rd-eyebrow shrink-0">Tip</span>
      {tip}
    </p>
  );
}

/** Only while a fullscreen app is in front: keep the island out of it. */
export function FullscreenSwitch() {
  const fullscreen = useDuskie((s) => s.fullscreen);
  const hide = useDuskie((s) => s.settings.hideInFullscreen);
  if (!fullscreen) return null;
  return (
    <button
      type="button"
      role="switch"
      aria-checked={hide}
      onClick={() => void updateSettings({ hideInFullscreen: !hide })}
      style={{ marginLeft: "calc(var(--orb-indent, 0px) * -1)", width: "calc(100% + var(--orb-indent, 0px))" }}
      className="rd-list-row chip flex items-center gap-3 text-left"
    >
      <span className="min-w-0 flex-1">
        <span className="block text-[13px] font-medium text-(--ink)">Hide while fullscreen</span>
        <span className="block text-[12px] text-(--ink-2)">
          {hide ? "Hidden; hover the top edge to bring it back" : "The island stays on top of this app"}
        </span>
      </span>
      <span
        aria-hidden="true"
        className="flex shrink-0 gap-0.5 rounded-[10px] bg-(--fill) p-[3px] text-[12.5px] leading-none shadow-[inset_0_0_0_1px_var(--line)]"
      >
        <span
          className={`rounded-[8px] px-2.5 py-[5px] ${hide ? "bg-(--c2) font-semibold text-(--c1)" : "text-(--ink-2)"}`}
        >
          On
        </span>
        <span
          className={`rounded-[8px] px-2.5 py-[5px] ${hide ? "text-(--ink-2)" : "bg-(--c2) font-semibold text-(--c1)"}`}
        >
          Off
        </span>
      </span>
    </button>
  );
}

interface Headline {
  title: string;
  detail: string;
  /** Nothing pressing: a tip may show. */
  quiet?: boolean;
  join?: string | null;
}

/** Today's meetings come as local "HH:MM". */
function at(now: number, hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  const d = new Date(now);
  d.setHours(h ?? 0, m ?? 0, 0, 0);
  return d.getTime();
}

function nextMeeting(now: number, calendar: CalendarToday | null): Headline | null {
  for (const m of calendar?.meetings ?? []) {
    const start = at(now, m.start);
    const end = at(now, m.end);
    if (end <= now) continue;
    if (start <= now) return { title: `${m.title} is on now`, detail: `Until ${m.end}.`, join: m.joinUrl };
    const mins = Math.round((start - now) / 60_000);
    if (mins > MEETING_SOON_MIN) return null;
    return {
      title: mins < 1 ? `${m.title} is starting` : `${m.title} in ${mins} min`,
      detail: `${m.start} to ${m.end}.`,
      join: m.joinUrl,
    };
  }
  return null;
}

/** Where most of today went: a project when known, else the app. */
function topFocus(time: AppTime[]): string | null {
  const by = new Map<string, number>();
  for (const t of time) {
    const key = t.project ? `on ${t.project}` : `in ${t.app}`;
    by.set(key, (by.get(key) ?? 0) + t.secs);
  }
  let best: [string, number] | null = null;
  for (const e of by) if (!best || e[1] > best[1]) best = e;
  return best?.[0] ?? null;
}

export function headline(
  now: number,
  paused: boolean,
  calendar: CalendarToday | null,
  time: AppTime[] | null,
): Headline {
  if (paused) return { title: "Paused", detail: "Sensors are off. Resume when you are ready." };
  const meeting = nextMeeting(now, calendar);
  if (meeting) return meeting;
  const hour = new Date(now).getHours();
  const title = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const total = (time ?? []).reduce((sum, t) => sum + t.secs, 0);
  if (total < 60) return { title, detail: "Nothing needs you right now.", quiet: true };
  const top = topFocus(time ?? []);
  return { title, detail: `${formatDuration(total)} at your PC today${top ? `, mostly ${top}` : ""}.`, quiet: true };
}

export const ago = (mins: number) => minutesText(mins, { justNow: "now", floorHours: true });
