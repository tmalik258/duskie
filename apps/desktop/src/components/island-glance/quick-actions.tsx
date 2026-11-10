"use client";

// Part of island-glance: QuickActions, FOCUS_PRESETS, FOCUS_MIN, FOCUS_MAX, FOCUS_LAST_KEY, readLastFocus, writeLastFocus, ISSUES, CrashCard.

import { api } from "@/lib/bridge";
import { useDuskie } from "@/lib/store";
import { CardChips, CardHead, CardNote } from "../island-card";
import { FocusShiftPauseButton } from "./later-list";
import {
  AskShiftAgentsButton,
  SettingsShiftHistoryButton,
  UpdateButton,
  useShiftHeld,
} from "./settings-shift-history-button";

export function QuickActions({
  paused,
  focusOpen,
  onFocusOpenChange,
}: {
  paused: boolean;
  focusOpen: boolean;
  onFocusOpenChange: (open: boolean) => void;
}) {
  const update = useDuskie((s) => s.update);
  const shift = useShiftHeld();
  // Single row keeps the glance short, two rows stacked taller than the copy.
  return (
    <div className="flex gap-1">
      <AskShiftAgentsButton shift={shift} />
      <FocusShiftPauseButton paused={paused} open={focusOpen} onOpenChange={onFocusOpenChange} shift={shift} />
      {update ? <UpdateButton /> : null}
      <SettingsShiftHistoryButton shift={shift} />
    </div>
  );
}

export const FOCUS_PRESETS = [15, 25, 45, 60, 90, 120] as const;

export const FOCUS_MIN = 5;

export const FOCUS_MAX = 180;

const FOCUS_LAST_KEY = "sidekick.focusMinutes";

export function readLastFocus(): number {
  try {
    const n = Number(localStorage.getItem(FOCUS_LAST_KEY));
    if (Number.isFinite(n) && n >= FOCUS_MIN && n <= FOCUS_MAX) return Math.round(n);
  } catch {
    // Default below.
  }
  return 25;
}

export function writeLastFocus(minutes: number) {
  try {
    localStorage.setItem(FOCUS_LAST_KEY, String(minutes));
  } catch {
    // Preference is optional.
  }
}

const ISSUES = "https://github.com/tmalik258/duskie/issues/new";

/** After a crash, for people who opted in: the report, and sending it is
 * their choice (a GitHub issue they can read and edit first). */
export function CrashCard({ note, onDone }: { note: string; onDone: () => void }) {
  const dismiss = () => void api.crashDismiss().then(onDone);
  const report = () =>
    void api.appInfo().then((info) => {
      const body = `Duskie ${info.version} closed unexpectedly.\n\n\`\`\`\n${note}\n\`\`\`\n\nWhat I was doing:\n`;
      const url = `${ISSUES}?title=${encodeURIComponent("Crash report")}&body=${encodeURIComponent(body)}`;
      void api.aiOpenLink(url).then(dismiss);
    });
  return (
    <div className="flex flex-col">
      <CardHead
        title="Duskie closed unexpectedly"
        detail="The report has the version and the error, nothing else. You read it before it is sent."
      />
      <CardNote>
        <span className="line-clamp-3">{note}</span>
      </CardNote>
      <CardChips options={[{ label: "Report it", run: report }]} quiet={{ label: "Ignore", run: dismiss }} />
    </div>
  );
}
