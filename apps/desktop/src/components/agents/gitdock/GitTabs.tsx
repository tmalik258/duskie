"use client";

// Changes / History / Pull request / Stashes, with a 2px underline that
// slides to the active tab on a critically damped spring (no overshoot).

import { motion, useReducedMotion } from "motion/react";
import { useLayoutEffect, useRef, useState } from "react";

export type GitTab = "changes" | "history" | "pr" | "stashes";

const TABS: [GitTab, string][] = [
  ["changes", "Changes"],
  ["history", "History"],
  ["pr", "Pull request"],
  ["stashes", "Stashes"],
];

// Critical damping is 2 * sqrt(stiffness * mass); with mass 1 that is 40.
const SPRING = { type: "spring", stiffness: 400, damping: 40, mass: 1 } as const;

export function GitTabs({
  tab,
  onTab,
  changes,
  stashes,
}: {
  tab: GitTab;
  onTab: (t: GitTab) => void;
  changes: number;
  stashes: number;
}) {
  const reduce = useReducedMotion();
  const refs = useRef<Partial<Record<GitTab, HTMLButtonElement | null>>>({});
  const [box, setBox] = useState<{ x: number; w: number } | null>(null);
  const counts: Partial<Record<GitTab, number>> = { changes, stashes };

  // Counts change a tab's width, so measure again when they do.
  // biome-ignore lint/correctness/useExhaustiveDependencies: changes and stashes resize the tabs
  useLayoutEffect(() => {
    const el = refs.current[tab];
    if (!el) return;
    const next = { x: el.offsetLeft, w: el.offsetWidth };
    setBox((b) => (b && b.x === next.x && b.w === next.w ? b : next));
  }, [tab, changes, stashes]);

  return (
    <div className="gtabs" role="tablist" aria-label="Git views">
      {TABS.map(([k, label]) => {
        const n = counts[k] ?? 0;
        return (
          <button
            key={k}
            ref={(el) => {
              refs.current[k] = el;
            }}
            type="button"
            role="tab"
            className="gtab"
            aria-selected={tab === k}
            onClick={() => onTab(k)}
          >
            {label}
            {n > 0 && <span className="n">{n}</span>}
          </button>
        );
      })}
      {box && (
        <motion.span
          className="uline"
          aria-hidden="true"
          initial={false}
          animate={{ x: box.x, width: box.w }}
          transition={reduce ? { duration: 0 } : SPRING}
        />
      )}
    </div>
  );
}
