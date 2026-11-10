"use client";

// Part of island-pill: PillKind, PillModel, clock, MorphLabel, Bars, EdgeRing.

import { useEffect, useRef } from "react";
import { clockText } from "@/lib/time-text";

export type PillKind =
  | "working"
  | "listening"
  | "caption"
  | "done"
  | "error"
  | "focus"
  | "paused"
  | "offline"
  | "noticing"
  | "waiting"
  | "suggest"
  | "notify";

export interface PillModel {
  kind: PillKind;
  label: string;
  /** Quieter text after the label. */
  dim?: string;
  /** Working: when it began, for the m:ss timer. */
  startedAt?: number;
  /** Working: 0..1 for the edge ring; undefined runs the ring as indeterminate. */
  progress?: number;
  /** Focus: time left, already formatted. */
  left?: string;
  /** Waiting: how many. */
  count?: number;
  onOpen?: () => void;
  /** Suggest: the likely option as a chip. */
  chip?: string;
  onChip?: () => void;
  /** Paused: resume / cancel the pause. */
  onCancel?: () => void;
}

export const clock = clockText;

/** The label morphs word by word: words that changed blur in, the rest stay. */
export function MorphLabel({ text }: { text: string }) {
  const prev = useRef<string[]>([]);
  const words = text.split(" ");
  const old = prev.current;
  useEffect(() => {
    prev.current = words;
  });
  return (
    <span className="words">
      {words.map((w, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: position is the identity of a word in the label
        <span key={`${i}-${w}`} className={old.length && old[i] !== w ? "new" : undefined}>
          {i ? " " : ""}
          {w}
        </span>
      ))}
    </span>
  );
}

export function Bars() {
  return (
    <span className="bars" aria-hidden>
      <i />
      <i />
      <i />
      <i />
      <i />
    </span>
  );
}

/** Progress traced along the capsule's own edge. */
export function EdgeRing({ progress }: { progress?: number }) {
  const ind = progress === undefined;
  return (
    <svg className={`edge${ind ? " ind" : ""}`} aria-hidden="true">
      <rect className="trk" pathLength={100} />
      <rect
        className="val"
        pathLength={100}
        strokeDasharray={ind ? undefined : 100}
        strokeDashoffset={ind ? undefined : 100 * (1 - (progress ?? 0))}
      />
    </svg>
  );
}
