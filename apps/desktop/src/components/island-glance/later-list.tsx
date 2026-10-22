"use client";

// Part of island-glance: LaterList, keyHint, FocusShiftPauseButton.

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useState } from "react";
import { api } from "@/lib/bridge";
import { useCached } from "@/lib/cache";
import { shortcutBinding } from "@/lib/shortcuts";
import { useDuskie } from "@/lib/store";
import type { LaterItem } from "@/lib/types";
import { Ic, Icon } from "../icon";
import { Tip } from "../tip";
import { ago, LATER_SHOWN, qbClass } from "./qb-class";

/** Suggestions you missed (shown and timed out) or that waited quietly. */
export function LaterList() {
  const count = useDuskie((s) => s.later);
  const { data, refresh } = useCached<LaterItem[]>("later-list", api.laterList);
  const [all, setAll] = useState(false);
  // The count changes when one is added, opened or cleared.
  useEffect(() => {
    if (count > 0) void refresh().catch(() => undefined);
  }, [count, refresh]);
  const items = count > 0 ? (data ?? []) : [];
  if (items.length === 0) return null;
  const missed = items.some((l) => l.missed);
  const shown = all ? items : items.slice(0, LATER_SHOWN);
  return (
    <div
      className="rd-sec-list"
      style={{
        marginLeft: "calc(var(--orb-indent, 0px) * -0.925)",
        width: "calc(100% + var(--orb-indent, 0px))",
      }}
    >
      <div className="rd-sec">
        <span>{missed ? "You missed" : "Saved for later"}</span>
        <span className="flex items-center gap-3">
          {all && (
            <button type="button" onClick={() => setAll(false)} className="chip rd-gfoot-btn">
              Show less
            </button>
          )}
          <button type="button" onClick={() => void api.laterClear()} className="chip rd-gfoot-btn">
            Clear
          </button>
        </span>
      </div>
      <div className={`rd-sec-list ${all ? "island-scroll max-h-[260px] overflow-y-auto overscroll-contain" : ""}`}>
        {shown.map((l, n) => (
          // biome-ignore lint/a11y/useSemanticElements: the row holds its own dismiss button, so it cannot be a button
          <div
            key={l.id}
            role="button"
            tabIndex={0}
            style={{ animationDelay: `${Math.min(n, 6) * 40}ms` }}
            className="rise-in rd-list-row chip"
            onClick={() => void api.laterOpen(l.id)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void api.laterOpen(l.id);
            }}
          >
            <span className="dot" style={{ background: "#95a89a" }} />
            <span className="t">
              {l.title}
              {l.detail && <span className="text-(--ink-3)"> {l.detail}</span>}
            </span>
            <span className="r">{ago(l.minutesAgo)}</span>
            <button
              type="button"
              className="rx"
              aria-label={`Clear ${l.title}`}
              onClick={(e) => {
                e.stopPropagation();
                void api.laterDismiss(l.id);
              }}
            >
              <Ic name="x" size={12} />
            </button>
          </div>
        ))}
      </div>
      {!all && items.length > LATER_SHOWN && (
        <button type="button" onClick={() => setAll(true)} className="chip rd-gfoot-btn self-start text-[12px]">
          Show {items.length - LATER_SHOWN} more
        </button>
      )}
    </div>
  );
}

export function keyHint(keys: string | undefined): string {
  const k = keys ? shortcutBinding(keys) : "";
  return k ? ` (${k})` : "";
}

/** Focus by default; hold Shift to morph into Pause / Resume (one slot). When
 * sensors are already paused, Resume is primary and Shift reveals Focus. */
export function FocusShiftPauseButton({
  paused,
  open,
  onOpenChange,
  shift,
}: {
  paused: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  shift: boolean;
}) {
  const focusing = useDuskie((s) => s.focusUntil !== null && s.focusUntil > Date.now());
  const focusKeys = useDuskie((s) => s.settings.shortcuts.focus);
  const pauseKeys = useDuskie((s) => s.settings.shortcuts.pause);
  const reduced = useReducedMotion() ?? false;
  // Paused → Resume is primary; otherwise Focus is primary and Shift → Pause.
  const pauseSide = paused ? !shift : shift;
  const focusHint = keyHint(focusKeys);
  const pauseHint = keyHint(pauseKeys);
  const label = pauseSide
    ? paused
      ? `Resume${pauseHint} · Shift for Focus${focusHint}`
      : `Pause 15 minutes${pauseHint}`
    : focusing
      ? `End focus${focusHint}`
      : open
        ? "Close"
        : paused
          ? `Focus${focusHint}`
          : `Focus${focusHint} · Shift for Pause${pauseHint}`;
  const active = !pauseSide && (open || focusing);
  const icon = pauseSide ? (paused ? "play" : "pause") : "focus";
  return (
    <Tip label={label}>
      <button
        type="button"
        aria-label={label}
        aria-expanded={pauseSide ? undefined : open}
        onClick={(e) => {
          const wantPause = e.shiftKey ? !paused : pauseSide;
          if (wantPause) {
            onOpenChange(false);
            void (paused ? api.sensorsResume() : api.sensorsPause(15));
            return;
          }
          if (focusing) {
            onOpenChange(false);
            void api.focusStop();
            return;
          }
          onOpenChange(!open);
        }}
        className={`${qbClass}${active ? " rd-qb-on" : ""}`}
      >
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.span
            key={icon}
            className="grid place-items-center"
            initial={reduced ? false : { opacity: 0, scale: 0.7, rotate: pauseSide ? -20 : 20 }}
            animate={{ opacity: 1, scale: 1, rotate: 0 }}
            exit={reduced ? undefined : { opacity: 0, scale: 0.7, rotate: pauseSide ? 20 : -20 }}
            transition={{ duration: 0.16, ease: [0.23, 1, 0.32, 1] }}
          >
            <Icon name={icon} size={pauseSide ? 15 : 16} />
          </motion.span>
        </AnimatePresence>
      </button>
    </Tip>
  );
}
