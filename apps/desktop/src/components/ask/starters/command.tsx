"use client";

// Part of starters: Command, ContextLine, soonestMeeting, MAIL, MEETING, CODE.

import { setAsk, useDuskie } from "@/lib/store";
import type { CalendarToday } from "@/lib/types";
import { Ic, type IcName } from "../../icon";
import { Tip } from "../../tip";
import { KeyHint } from "../parts";
import { pendingCount, useAltDigits } from "../proposals/pending-count";

export interface Command {
  id: string;
  label: string;
  hint?: string;
  icon: IcName;
  run: () => void;
  /** Keep Ask mode open after running. */
  stay?: boolean;
}

/** What goes with the question, as one quiet line under it: the app you
 * were in and what you copied. Click one to leave it out (or back in).
 * This PC only sits at the end. Hold Alt for 1 / 2 on the chips. */
export function ContextLine({ keys }: { keys: boolean }) {
  // Clicking a chip leaves focus in the input; otherwise the next Enter
  // would press the chip again and switch it back.
  const keepFocus = (e: { preventDefault: () => void }) => e.preventDefault();
  const ask = useDuskie((s) => s.ask);
  const offline = useDuskie((s) => !s.online);
  // Answer actions already own Alt 1…n; leave chips free when those are waiting.
  const proposalDigits = useDuskie((s) => pendingCount(s.turns.at(-1)?.proposals));
  const { context } = ask ?? { context: null };
  const items: {
    id: string;
    label: string;
    on: boolean;
    title?: string | null;
    tip: string;
    toggle: () => void;
  }[] = [];
  if (ask && context?.app) {
    items.push({
      id: "app",
      label: context.app,
      on: ask.attachWindow,
      title: context.title,
      tip: ask.attachWindow ? `Exclude what's visible in ${context.app}` : `Include what's visible in ${context.app}`,
      toggle: () => setAsk({ attachWindow: !ask.attachWindow }),
    });
  }
  if (ask && context && !context.clipboardSecret && context.clipboardKind) {
    // What it is ("stack trace", "link"); the text itself shows on hover.
    items.push({
      id: "clip",
      label: `Copied: ${context.clipboardKind.replace(/_/g, " ")}`,
      on: ask.attachClip,
      title: context.clipboardPreview,
      tip: ask.attachClip ? "Exclude clipboard" : "Include clipboard",
      toggle: () => setAsk({ attachClip: !ask.attachClip }),
    });
  }
  useAltDigits(proposalDigits > 0 ? 0 : Math.min(items.length, 9), 0, (n) => {
    items[n]?.toggle();
  });
  if (!ask || !context) return null;
  return (
    <div className="ak-ctx">
      {offline && <span className="ak-offl">Offline</span>}
      {items.map((it, i) => (
        <span key={it.id} className={`relative flex min-w-0 items-center ${it.id === "clip" ? "shrink" : "shrink-0"}`}>
          <Tip label={`${it.tip}${it.title ? ` · ${it.title}` : ""} · Alt ${i + 1}`}>
            <button
              type="button"
              aria-pressed={it.on}
              onMouseDown={keepFocus}
              onClick={it.toggle}
              className={`ak-ctx-i chip ${it.id === "clip" ? "cpy" : ""}`}
            >
              <Ic name={it.id === "clip" ? "copy" : "file"} size={12} />
              <span className="truncate">{it.label}</span>
            </button>
          </Tip>
          {proposalDigits === 0 && i < 9 && (
            <KeyHint show={keys} side="left">
              {`Alt ${i + 1}`}
            </KeyHint>
          )}
        </span>
      ))}
      {context.clipboardSecret && <span className="ak-ctx-i cpy">Clipboard hidden (looks like a secret)</span>}
      <span className="relative ml-auto shrink-0">
        <Tip label="This PC only (Alt P)">
          <button
            type="button"
            aria-pressed={ask.localOnly}
            aria-label="This PC only"
            onMouseDown={keepFocus}
            onClick={() => setAsk({ localOnly: !ask.localOnly })}
            className="ak-pc chip"
          >
            <Ic name={ask.localOnly ? "check" : "lock"} size={10} />
            {ask.localOnly && "This PC only"}
          </button>
        </Tip>
        <KeyHint show={keys} side="right">
          Alt P
        </KeyHint>
      </span>
    </div>
  );
}

/** A meeting starting within the hour, from today's "HH:MM" list. */
export function soonestMeeting(calendar: CalendarToday | null): { title: string; start: string } | null {
  const now = new Date();
  for (const m of calendar?.meetings ?? []) {
    const [h, min] = m.start.split(":").map(Number);
    const at = new Date(now);
    at.setHours(h ?? 0, min ?? 0, 0, 0);
    const mins = (at.getTime() - now.getTime()) / 60_000;
    if (mins >= -5 && mins <= 60) return m;
  }
  return null;
}

export const MAIL = /outlook|gmail|thunderbird|mail/i;

export const MEETING = /teams|zoom|meet|onenote|notion|obsidian|notes/i;

export const CODE = /code|cursor|visual studio|idea|pycharm|webstorm|terminal/i;
