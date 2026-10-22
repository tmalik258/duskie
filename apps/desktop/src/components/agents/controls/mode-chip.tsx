"use client";

// Part of controls: ModeChip, windowName, resetText, ago.

import { agoText } from "@/lib/time-text";
import { Ic } from "../../icon";
import { Caret, MODE_INFO, type ModeId, Pop } from "./levels";

/** The mode as one chip with its icon; the menu lists every mode with its note. */
export function ModeChip({ mode, onChange }: { mode: ModeId; onChange?: (m: ModeId) => void }) {
  const cur = MODE_INFO.find((m) => m.id === mode) ?? MODE_INFO[2];
  if (!onChange)
    return (
      <span className="ak-cchip ak-mode">
        <Ic name={cur.icon} size={12} />
        {cur.label}
      </span>
    );
  return (
    <Pop
      label="Mode (Ctrl .)"
      className="ak-mode"
      chip={
        <>
          <Ic name={cur.icon} size={12} />
          {cur.label}
          <Caret />
        </>
      }
    >
      {(close) => (
        <>
          <div className="ak-pop-h">
            <span>Mode</span>
            <kbd className="mono">Ctrl .</kbd>
          </div>
          {MODE_INFO.map((m) => (
            <button
              key={m.id}
              type="button"
              className="ak-mode-opt"
              aria-pressed={m.id === mode}
              onClick={() => {
                onChange(m.id);
                close();
              }}
            >
              <Ic name={m.icon} size={13} />
              <span>
                <b>{m.label}</b>
                <small>{m.note}</small>
              </span>
            </button>
          ))}
        </>
      )}
    </Pop>
  );
}

export function windowName(w: string): string {
  if (w === "five_hour") return "5-hour";
  if (w.startsWith("seven_day")) return "Weekly";
  return w;
}

export function resetText(at: number | null): string {
  if (!at) return "";
  const ms = at * 1000 - Date.now();
  if (ms <= 0) return "Reset";
  const h = Math.floor(ms / 3_600_000);
  const m = Math.round((ms % 3_600_000) / 60_000);
  if (h >= 24)
    return `Resets ${new Date(at * 1000).toLocaleString([], { weekday: "short", hour: "numeric", minute: "2-digit" })}`;
  return h ? `Resets in ${h} hr ${m} min` : `Resets in ${m} min`;
}

export const ago = (t: number) => agoText(t, { suffix: true, justNow: "just now" });
