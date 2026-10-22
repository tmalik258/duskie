"use client";

// Part of home-tab: TimeToday, RecentActions, RecentEvents, Backup, LEVELS, LEVEL_TONE, DoNotDisturb.

import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/bridge";
import { useDnd } from "@/lib/hooks";
import {
  type ActionRecord,
  type AppTime,
  canUndo,
  formatDuration,
  type NotifyLevel,
  type StoredEvent,
} from "@/lib/types";
import { Button, Toggle } from "../ui";

/** Where today went, by app and project. */
export function TimeToday() {
  const [rows, setRows] = useState<AppTime[] | null>(null);
  useEffect(() => {
    void api.timeToday().then(setRows);
    const id = setInterval(() => void api.timeToday().then(setRows), 60_000);
    return () => clearInterval(id);
  }, []);
  if (!rows) return null;
  if (rows.length === 0) return <p className="text-sm text-(--muted)">Nothing counted yet today.</p>;
  const total = rows.reduce((n, r) => n + r.secs, 0);
  const top = rows[0].secs;
  return (
    <div className="flex flex-col gap-2.5">
      <p className="text-[13px] text-(--muted)">
        <span className="font-display text-[22px] font-semibold tracking-[-0.02em] text-(--text)">
          {formatDuration(total)}
        </span>{" "}
        at the computer
      </p>
      <ul className="flex flex-col gap-2">
        {rows.slice(0, 8).map((r) => (
          <li key={`${r.app}|${r.project}`} className="text-[13px]">
            <div className="flex justify-between gap-3">
              <span className="truncate">
                {r.app}
                {r.project && <span className="text-(--muted)"> · {r.project}</span>}
              </span>
              <span className="shrink-0 text-(--muted) tabular-nums">{formatDuration(r.secs)}</span>
            </div>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-(--surface)">
              <div className="h-full rounded-full bg-(--accent)" style={{ width: `${(r.secs / top) * 100}%` }} />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function RecentActions({ onError }: { onError: (e: string) => void }) {
  const [actions, setActions] = useState<ActionRecord[]>([]);
  const refresh = useCallback(() => void api.actionsRecent(30).then(setActions), []);
  useEffect(refresh, [refresh]);
  const undo = async (id: number) => {
    try {
      await api.actionUndo(id);
    } catch (err) {
      onError(String(err));
    }
    refresh();
  };
  if (actions.length === 0) {
    return <p className="text-sm text-(--muted)">Nothing yet. Actions you pick on the island show up here.</p>;
  }
  return (
    <ul className="divide-y divide-(--border) text-[12.5px]">
      {actions.map((a) => (
        <li key={a.id} className="flex items-center justify-between gap-3 py-2 first:pt-0 last:pb-0">
          <span className={`min-w-0 ${a.ok ? "" : "text-red-500"}`}>
            <span className="font-medium">{a.label}</span>
            {a.auto ? " (auto)" : ""}
            <span className="block truncate text-(--muted)">
              {a.undone ? "Undone. " : ""}
              {a.message}
            </span>
          </span>
          <span className="flex shrink-0 items-center gap-2">
            {canUndo(a) && (
              <Button small onClick={() => void undo(a.id)}>
                Undo
              </Button>
            )}
            <span className="text-(--muted)">{new Date(a.ts).toLocaleTimeString()}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

export function RecentEvents() {
  const [events, setEvents] = useState<StoredEvent[]>([]);
  useEffect(() => void api.eventsRecent(15).then(setEvents), []);
  if (events.length === 0) return <p className="text-(--muted)">No events stored yet.</p>;
  return (
    <ul className="divide-y divide-(--border) rounded-lg border border-(--border) text-xs">
      {events.map((e) => (
        <li key={e.id} className="flex justify-between gap-3 px-3 py-1.5 font-mono">
          <span>{e.kind}</span>
          <span className="text-(--muted)">{new Date(e.ts).toLocaleTimeString()}</span>
        </li>
      ))}
    </ul>
  );
}

export function Backup({ onError }: { onError: (e: string) => void }) {
  const [note, setNote] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  return (
    <div className="flex flex-col gap-2 text-[13px]">
      <div className="flex gap-2">
        <Button
          onClick={() =>
            api
              .backupExport()
              .then((p) => setNote(`Saved to ${p}`))
              .catch((e) => onError(String(e)))
          }
        >
          Export
        </Button>
        <Button onClick={() => input.current?.click()}>Import</Button>
        <input
          ref={input}
          type="file"
          accept=".json,application/json"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (!file) return;
            void file
              .text()
              .then((text) => api.backupImport(text))
              .then(setNote)
              .catch((err) => onError(String(err)));
          }}
        />
      </div>
      {note && <p className="text-[12px] break-all text-(--muted)">{note}</p>}
    </div>
  );
}

export const LEVELS: [NotifyLevel | "auto", string][] = [
  ["auto", "Duskie decides"],
  ["now", "Right away"],
  ["soon", "Gather for later"],
  ["digest", "Digest only"],
  ["never", "Mute"],
];

export const LEVEL_TONE: Record<NotifyLevel, string> = {
  now: "bg-[#ff453a]/20 text-[#ff9f97]",
  soon: "bg-(--accent)/20 text-(--accent)",
  digest: "bg-(--surface) text-(--muted)",
  never: "bg-(--surface)/50 text-(--muted)",
};

/** Windows' Do Not Disturb as a switch that shows the real state. */
export function DoNotDisturb({ onError }: { onError: (e: string) => void }) {
  const dnd = useDnd({ onError });
  return (
    <Toggle
      label="Do Not Disturb"
      hint={dnd.busy ? "Switching..." : "Stops Windows pop-ups. Notifications still reach Duskie."}
      checked={dnd.on}
      onChange={dnd.set}
    />
  );
}
