"use client";

// Part of connections-tab: Meetings, PairingCode, BrowserCard.

import { useEffect, useState } from "react";
import { api, EVENTS, listen } from "@/lib/bridge";
import { useCached } from "@/lib/cache";
import { installExtension, updateSettings, useDuskie } from "@/lib/store";
import type { BrowserInfo, BrowserStatus, CalendarToday, ExtensionGuide } from "@/lib/types";
import { Button, CopyButton, Field, Select } from "../ui";

/** Today's meetings and the reminder time, once a calendar is connected. */
export function Meetings({ onError }: { onError: (e: string) => void }) {
  const calendar = useDuskie((s) => s.settings.calendar);
  const { data: today, refresh } = useCached<CalendarToday>("calendar-today", api.calendarToday, 30_000);
  useEffect(() => {
    const off = listen(EVENTS.composioChanged, () => setTimeout(() => void refresh().catch(() => undefined), 3000));
    return () => {
      void off.then((f) => f());
    };
  }, [refresh]);
  const sources = today?.sources ?? [];
  if (sources.length === 0 && !today?.error) return null;
  return (
    <div className="flex flex-col gap-2.5 border-t border-(--border) pt-3 text-[13px]">
      <Field label="Meeting reminder" hint={sources.join(" and ")}>
        <Select
          label="Meeting reminder"
          value={String(calendar.remindMinutes)}
          options={[1, 2, 3, 5, 10, 15].map((m) => [String(m), `${m} min before`])}
          onChange={(v) =>
            void updateSettings({ calendar: { ...calendar, remindMinutes: Number(v) } }).catch((e) =>
              onError(String(e)),
            )
          }
        />
      </Field>
      {today?.error && <p className="text-[12px] text-red-400">{today.error}</p>}
      {sources.length > 0 &&
        (today && today.meetings.length > 0 ? (
          <ul className="flex flex-col gap-1.5">
            {today.meetings.map((m) => (
              <li key={`${m.start}${m.title}`} className="flex items-center justify-between gap-3">
                <span className="min-w-0 truncate">
                  <span className="text-(--muted) tabular-nums">
                    {m.start} to {m.end}
                  </span>{" "}
                  {m.title}
                </span>
                {m.joinUrl && (
                  <Button small onClick={() => void api.openReference("page", m.joinUrl ?? "")}>
                    Join
                  </Button>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-[12px] text-(--muted)">No more meetings today.</p>
        ))}
    </div>
  );
}

function PairingCode() {
  const [info, setInfo] = useState<BrowserInfo | null>(null);
  useEffect(() => {
    void api.browserInfo().then(setInfo);
  }, []);
  return (
    <details className="text-[12.5px]">
      <summary className="cursor-pointer text-(--muted)">Pair with a code instead</summary>
      <div className="mt-2 flex items-center gap-2">
        <code className="min-w-0 flex-1 truncate rounded-lg bg-(--surface) px-3 py-2 font-mono text-[12px] select-all">
          {info?.token || "..."}
        </code>
        <CopyButton text={info?.token ?? ""} />
      </div>
      <p className="mt-1 text-(--muted)">Paste it in the extension&apos;s options.</p>
    </details>
  );
}

export function BrowserCard() {
  const [guide, setGuide] = useState<{ id: string; guide: ExtensionGuide } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { data: browsers, refresh } = useCached<BrowserStatus[]>("browsers", api.browsersStatus);
  useEffect(() => {
    const off = listen(EVENTS.browsersChanged, () => void refresh().catch(() => undefined));
    return () => {
      void off.then((f) => f());
    };
  }, [refresh]);
  useEffect(() => {
    if (guide && browsers?.some((b) => b.id === guide.id && b.connected)) setGuide(null);
  }, [browsers, guide]);

  if (!browsers) return <div className="h-12" aria-busy="true" />;
  return (
    <div className="flex flex-col gap-2.5 text-[13px]">
      {browsers.length === 0 && <p className="text-(--muted)">No supported browser found.</p>}
      {browsers.map((b) => (
        <div key={b.id} className="flex flex-col gap-2 rounded-xl border border-(--border) px-3 py-2.5">
          <div className="flex items-center gap-3">
            <span className="min-w-0 flex-1 font-medium">{b.name}</span>
            {b.connected ? (
              <span className="text-[12px] text-[#30d158]">Connected</span>
            ) : (
              <Button
                small
                primary={guide?.id !== b.id}
                onClick={() => {
                  setError(null);
                  installExtension(b.id, b.name)
                    .then((g) => setGuide({ id: b.id, guide: g }))
                    .catch((e) => setError(String(e)));
                }}
              >
                {guide?.id === b.id ? "Open again" : "Install"}
              </Button>
            )}
          </div>
          {guide?.id === b.id && (
            <div className="flex flex-col gap-1.5 rounded-lg bg-(--accent)/10 p-2.5 text-[12.5px]">
              <p>{b.name} opened. Then:</p>
              <ol className="list-decimal space-y-0.5 pl-5">
                {guide.guide.steps.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ol>
              <p className="text-(--muted)">This turns green by itself once it connects.</p>
            </div>
          )}
        </div>
      ))}
      {error && <p className="text-[12px] text-red-400">{error}</p>}
      <PairingCode />
    </div>
  );
}
