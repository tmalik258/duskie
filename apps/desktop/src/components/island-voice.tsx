"use client";

import { motion } from "motion/react";
import { acceptActivities, activityElapsedSecs, activityLabel, dismissLocal } from "@/lib/activities";
import { api } from "@/lib/bridge";
import { useNow } from "@/lib/hooks";
import type { Activity as ActivityItem } from "@/lib/types";
import { VoiceBars } from "./ask/voice";
import { Ic } from "./icon";
import { Activity } from "./island-parts/activity";
import { AgentRing, statusNeedsTruncate, voiceLabel } from "./island-voice/tail";
import { Tip } from "./tip";

export function VoicePill({
  text,
  thinking,
  working,
  done,
  focus,
  asks,
  waiting,
  failed,
  dots,
  activity,
  onOpen,
  onCancel,
}: {
  text: string;
  thinking: boolean;
  working?: boolean;
  done?: boolean;
  focus?: boolean;
  asks?: boolean;
  waiting?: boolean;
  failed?: boolean;
  dots?: string[];
  activity?: ActivityItem;
  onOpen?: () => void;
  onCancel?: () => void;
}) {
  const now = useNow(1000);
  const elapsed = activity ? activityElapsedSecs(activity, now) : null;
  // Compact pill always offers icon actions when an activity is on screen.
  const showActions = !!activity;
  // Split · Ns out of the label so copy, timer, and activity can be spaced apart.
  const baseText = activity && elapsed !== null ? activityLabel(activity, now, { elapsed: false }) : text;
  const label = voiceLabel(baseText, thinking, working || done || focus);
  const fullLabel = elapsed !== null ? `${label} · ${elapsed}s` : label;
  // Listening: label flexes so bars + Stop stay on the right. Status: one
  // tight cluster (label + indicator) so the shell never shows a stretch gap.
  const listening = !(working || thinking || done || focus || failed || waiting || asks);
  const clip =
    listening ||
    statusNeedsTruncate(fullLabel, {
      cancel: !!onCancel || !!focus,
      indicator: !!(thinking || working || done || waiting || failed || asks || (dots && dots.length > 0)),
    });
  const warn = "bg-(--warn)";
  const inkStrong = "text-(--ink)";
  const inkSoft = "text-(--ink-2)";
  const iconBtn =
    "chip grid size-6 place-items-center rounded-[8px] text-(--ink-2) hover:bg-(--fill-2) hover:text-(--ink)";
  const stopBtn = "chip grid size-6 shrink-0 place-items-center rounded-[8px] bg-(--fill-2) hover:bg-(--fill-3)";
  const stopMark = "size-2 rounded-[2px] bg-(--ink)";
  const indicator = failed ? (
    <span role="img" aria-label="Failed" className="size-2 shrink-0 rounded-full bg-red-400" />
  ) : waiting ? (
    <span role="img" aria-label="Waiting for confirmed progress" className={`size-2 shrink-0 rounded-full ${warn}`} />
  ) : done ? (
    <span className="shrink-0 text-(--ok,#30d158)">
      <Ic name="check" size={14} />
    </span>
  ) : asks ? (
    <span className="relative flex size-2 shrink-0" role="img" aria-label="Waiting for you">
      <span className={`absolute inset-0 animate-ping rounded-full opacity-60 motion-reduce:animate-none ${warn}`} />
      <span className={`relative size-2 rounded-full ${warn}`} />
    </span>
  ) : dots && dots.length > 1 ? (
    <AgentRing states={dots} />
  ) : thinking || working ? (
    <Activity />
  ) : null;
  const labelClass = `text-[13px] tracking-[-0.005em] font-medium ${
    listening ? "min-w-0 flex-1 truncate" : clip ? "min-w-0 truncate" : "shrink-0"
  } ${text.trim() || thinking || working ? inkStrong : inkSoft}`;
  const labelInner = <span className="min-w-0 truncate">{label}</span>;
  const labelEl = onOpen ? (
    <button type="button" onClick={onOpen} className={`text-left ${labelClass}`}>
      {labelInner}
    </button>
  ) : (
    <span className={labelClass}>{labelInner}</span>
  );
  const labeled = clip ? <Tip label={fullLabel}>{labelEl}</Tip> : labelEl;
  const actions = showActions ? (
    <span className="flex shrink-0 items-center gap-0.5">
      <Tip label="Check again">
        <button
          type="button"
          aria-label="Check again"
          onClick={(e) => {
            e.stopPropagation();
            void api
              .activityCheck(activity.id)
              .then(acceptActivities)
              .catch(() => {});
          }}
          className={iconBtn}
        >
          <Ic name="refresh" size={12} />
        </button>
      </Tip>
      <Tip label="Dismiss">
        <button
          type="button"
          aria-label="Dismiss"
          onClick={(e) => {
            e.stopPropagation();
            if (activity.source === "open") dismissLocal(activity.id);
            void api.activityDismiss(activity.id).catch(() => {});
          }}
          className={iconBtn}
        >
          <Ic name="x" size={12} />
        </button>
      </Tip>
    </span>
  ) : null;
  const showCancel = !!focus || (!!onCancel && !!(working || asks));
  const cancelLabel = focus ? "End focus" : "Cancel";
  const runCancel = () => {
    if (focus) void api.focusStop();
    else onCancel?.();
  };
  // Prototype .cmp: the label starts after the mascot (48px) on the compact pill.
  const pillPad = !listening ? "pl-12" : "";
  return (
    <motion.div
      className={`absolute top-0 right-0 flex h-[38px] items-center ${listening ? "gap-2.5 pr-3.5" : `${pillPad} pr-2`}`}
      style={{ left: 0 }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1, transition: { delay: 0.1, duration: 0.2 } }}
      exit={{ opacity: 0, transition: { duration: 0.08 } }}
      aria-live="polite"
    >
      {listening ? (
        <>
          {labeled}
          <VoiceBars />
          <Tip label="Stop (Esc)">
            <button
              type="button"
              aria-label="Stop listening"
              onClick={(e) => {
                e.stopPropagation();
                void api.voiceStop();
              }}
              className={stopBtn}
            >
              <span className={stopMark} />
            </button>
          </Tip>
        </>
      ) : (
        <div className="flex min-w-0 max-w-full items-center gap-2.5 pr-3">
          {labeled}
          {elapsed !== null && (
            <span className={`shrink-0 text-[12.5px] font-medium tabular-nums ${inkStrong}`}>· {elapsed}s</span>
          )}
          {indicator && <span className="flex shrink-0 items-center">{indicator}</span>}
          {actions}
          {showCancel && (
            <Tip label={cancelLabel}>
              <button
                type="button"
                aria-label={cancelLabel}
                onClick={(e) => {
                  e.stopPropagation();
                  runCancel();
                }}
                className={stopBtn}
              >
                <span className={stopMark} />
              </button>
            </Tip>
          )}
        </div>
      )}
    </motion.div>
  );
}
