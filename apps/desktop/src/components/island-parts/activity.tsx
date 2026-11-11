"use client";

// Part of island-parts: Activity, CompactTrailing, NetNoticeCard, UndoButton, SourceLine, ALWAYS_GLANCE, OPEN_ACTIONS, runningLabel, always, dismiss.

import { motion } from "motion/react";
import { api } from "@/lib/bridge";
import { useNow } from "@/lib/hooks";
import type { NetNotice } from "@/lib/net";
import { playSound } from "@/lib/sound/play-mood";
import { uiVolume, useDuskie } from "@/lib/store";
import type { Suggestion } from "@/lib/types";
import { Ic } from "../icon";
import { RoundButton } from "../island-glance/settings-shift-history-button";
import { COMPACT } from "../island-layout";
import { Tip } from "../tip";

/** Three bars that breathe while the mascot is busy. */
export function Activity() {
  return (
    <span className="flex h-3 items-center gap-0.75" role="img" aria-label="Busy">
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="w-0.75 rounded-full bg-(--listen)"
          animate={{ height: [4, 12, 4] }}
          transition={{ duration: 0.9, repeat: Number.POSITIVE_INFINITY, delay: i * 0.15, ease: "easeInOut" }}
        />
      ))}
    </span>
  );
}

export function CompactTrailing({
  paused,
  busy,
  offline,
  waiting,
}: {
  paused: boolean;
  busy: boolean;
  offline: boolean;
  waiting: string | null;
}) {
  const later = useDuskie((s) => s.later);
  if (waiting) {
    return (
      <motion.div
        className="absolute top-0 right-0 flex h-[38px] items-center gap-2.5 pr-3.5"
        style={{ left: COMPACT.height + 4 }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1, transition: { delay: 0.12, duration: 0.2 } }}
        exit={{ opacity: 0, transition: { duration: 0.08 } }}
      >
        <span className="min-w-0 flex-1 truncate text-[12.5px] font-medium text-(--c2)/85">Waiting for {waiting}</span>
        <Activity />
      </motion.div>
    );
  }
  return (
    <motion.div
      className="absolute top-0 right-0 flex h-[38px] items-center pr-3.5"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1, transition: { delay: 0.12, duration: 0.2 } }}
      exit={{ opacity: 0, transition: { duration: 0.08 } }}
    >
      {busy ? (
        <Activity />
      ) : offline ? (
        <Tip label="Offline">
          <span role="img" aria-label="Offline" className="text-(--warn)">
            <Ic name="wifi" size={14} />
          </span>
        </Tip>
      ) : paused ? (
        <Tip label="Paused">
          <span className="size-1.5 rounded-full bg-(--warn)" style={{ boxShadow: "0 0 8px var(--warn)" }} />
        </Tip>
      ) : (
        later > 0 && (
          <Tip label={`${later} waiting for you`}>
            <span className="grid h-4 min-w-4 place-items-center rounded-full bg-(--c3) px-1 text-[10px] leading-none font-semibold text-(--c1)">
              {later}
            </span>
          </Tip>
        )
      )}
    </motion.div>
  );
}

/** The connection dropped or came back. */
export function NetNoticeCard({ notice }: { notice: NetNotice }) {
  return (
    <div className="flex items-start gap-3">
      <div className="min-w-0 flex-1">
        <p className="truncate font-display text-[15px] leading-5 font-semibold tracking-[-0.015em] text-white">
          {notice.title}
        </p>
        <p className="mt-0.5 line-clamp-2 text-[13px] leading-4.5 tracking-[-0.005em] text-[rgb(235_235_245/0.6)]">
          {notice.detail}
        </p>
      </div>
      <span
        className={`grid size-8 shrink-0 place-items-center rounded-full ${
          notice.online ? "bg-[#30d158]/15 text-[#30d158]" : "bg-[#ff9f0a]/15 text-[#ff9f0a]"
        }`}
        aria-hidden="true"
      >
        <Ic name="wifi" size={16} />
      </span>
    </div>
  );
}

export function UndoButton({ id }: { id: number }) {
  const undo = async () => {
    const result = useDuskie.getState().lastResult;
    try {
      const message = await api.actionUndo(id);
      useDuskie.setState({ lastResult: result && { ...result, message, path: null, undoId: null } });
    } catch (err) {
      useDuskie.setState({ lastResult: result && { ...result, ok: false, message: String(err), undoId: null } });
    }
  };
  return (
    <RoundButton label="Undo" onClick={() => void undo()}>
      <Ic name="undo" size={15} />
    </RoundButton>
  );
}

/** "From Calendar, 2 min ago" above a suggestion's title. */
export function SourceLine({ source, at }: { source: string; at?: number }) {
  const now = useNow(30_000);
  const mins = at ? Math.floor((now - at) / 60_000) : 0;
  return (
    <p className="rd-eyebrow mb-0.5">
      From {source}, {mins < 1 ? "just now" : mins < 60 ? `${mins} min ago` : `${Math.floor(mins / 60)} h ago`}
    </p>
  );
}

/** Moments Duskie always offers - not habits, so no Show less / skip score. */
export const ALWAYS_GLANCE = new Set([
  "files.screenshot",
  "clipboard.open-url",
  "system.back",
  "dev.open-in-browser",
  "system.update",
  "system.health",
  "browser.pair",
  "recipes.offer",
]);

export const OPEN_ACTIONS = new Set([
  "open_path",
  "open_folder",
  "open_in_editor",
  "open_url",
  "open_app",
  "launch_app",
  "open_system_page",
  "routine_open",
  "routine_open_all",
]);

export function runningLabel(suggestion: Suggestion, index: number): string {
  const action = suggestion.actions[index];
  if (action && OPEN_ACTIONS.has(action)) return "Opening";
  return suggestion.options[index] ?? "Working";
}

export function always(suggestion: Suggestion, index: number) {
  playSound("select", uiVolume(), useDuskie.getState().settings.soundKit);
  useDuskie.setState({ running: runningLabel(suggestion, index) });
  void api.suggestionAlways(suggestion.id, index);
}

export function dismiss(suggestion: Suggestion) {
  playSound("toggle_off", uiVolume(), useDuskie.getState().settings.soundKit);
  void api.suggestionDismiss(suggestion.id, "user");
}
