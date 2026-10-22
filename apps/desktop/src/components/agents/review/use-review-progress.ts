"use client";

// Review progress that outlives the panel: kept changes per turn, the
// "N left" count when closed early, and closing on its own once all are decided.

import { useCallback, useEffect, useRef, useState } from "react";
import { markReviewed } from "@/lib/agents";

/** Kept changes per session turn, so closing and reopening resumes where you were. */
const keptByTurn = new Map<string, Set<string>>();

export function useKept(id: string, turnAt: number | undefined) {
  const turnKey = `${id}:${turnAt}`;
  const [kept, setKeptState] = useState<Set<string>>(() => keptByTurn.get(turnKey) ?? new Set());
  const setKept = useCallback(
    (next: Set<string> | ((k: Set<string>) => Set<string>)) =>
      setKeptState((k) => {
        const v = typeof next === "function" ? next(k) : next;
        keptByTurn.set(turnKey, v);
        return v;
      }),
    [turnKey],
  );
  return [kept, setKept] as const;
}

export function useReviewFinish(id: string, finished: boolean, total: number, left: number, onDone: () => void) {
  // Closed with changes still undecided: the chip says how many are left.
  const leftRef = useRef({ left: 0, total: 0 });
  leftRef.current = { left, total };
  useEffect(
    () => () => {
      const { left: l, total: t } = leftRef.current;
      if (t > 0 && l > 0) markReviewed(id, l);
    },
    [id],
  );
  // Every change decided: done; close after a beat so the last decision is seen.
  useEffect(() => {
    if (!finished || total === 0 || left > 0) return;
    const t = setTimeout(() => {
      markReviewed(id, 0);
      onDone();
    }, 600);
    return () => clearTimeout(t);
  }, [finished, total, left, id, onDone]);
}
