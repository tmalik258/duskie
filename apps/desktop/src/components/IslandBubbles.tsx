"use client";

// Busy-island notification bubbles: at most three, with +N for the rest.
// Redesign path only; sits beside the capsule.

import { motion, useReducedMotion } from "motion/react";
import { bubblesOf } from "@/lib/peek";
import { motionFor, SPRINGS } from "@/lib/spring";

export interface BubbleItem {
  id: string;
  label: string;
  /** Agent progress: a small ring and its initials before the label. */
  ring?: { mark: string; done: number; total: number };
  /** Second line under the label. */
  sub?: string;
  /** Initial or short mark in the round badge. */
  mark?: string;
  /** Download or install progress, 0..1, drawn along the bottom edge. */
  progress?: number | null;
  tone?: "err";
}

export function IslandBubbles({ items, onOpen }: { items: BubbleItem[]; onOpen?: (id: string) => void }) {
  const reduced = useReducedMotion() ?? false;
  const { shown, more } = bubblesOf(items);
  if (shown.length === 0) return null;
  const spring = motionFor(SPRINGS.pop, reduced);

  return (
    <ul className="pointer-events-auto absolute top-0 left-full ml-1.5 m-0 flex list-none flex-col gap-1.5 p-0">
      {shown.map((it) => (
        <li key={it.id} className="m-0 p-0">
          <motion.button
            type="button"
            className="relative h-[38px] max-w-[170px] overflow-hidden rounded-[19px] border-0 bg-[rgb(from_var(--c1)_r_g_b_/_0.95)] pr-2.5 pl-[5px] text-left text-[12.5px] text-(--c2) shadow-[0_14px_30px_-12px_rgb(0_0_0_/_0.85),inset_0_0_0_1px_rgb(242_240_235_/_0.07)]"
            initial={reduced ? false : { opacity: 0, x: -6, scale: 0.96 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            transition={spring}
            onClick={() => onOpen?.(it.id)}
          >
            {it.ring ? (
              <span className="flex items-center gap-1.5">
                <Ring {...it.ring} />
                {it.label}
              </span>
            ) : (
              <span className="flex min-w-0 items-center gap-2">
                <span
                  className={`grid size-[26px] flex-none place-items-center rounded-full bg-[rgb(242_240_235_/_0.07)] font-mono text-[10px] font-semibold ${it.tone === "err" ? "text-(--err)" : "text-(--c4)"}`}
                  aria-hidden="true"
                >
                  {it.mark ?? it.label.slice(0, 1).toUpperCase()}
                </span>
                <span className="flex min-w-0 flex-col leading-[1.15]">
                  <b className="truncate text-[11.5px] font-semibold">{it.label}</b>
                  {it.sub && <small className="truncate text-[10.5px] text-(--ink-3)">{it.sub}</small>}
                </span>
              </span>
            )}
            {it.progress != null && (
              <span className="absolute right-3 bottom-[3px] left-3 h-[2px] overflow-hidden rounded-[2px] bg-[rgb(242_240_235_/_0.08)]">
                <i
                  className="block h-full bg-(--listen) transition-[width] duration-500"
                  style={{ width: `${Math.round(Math.min(1, Math.max(0, it.progress)) * 100)}%` }}
                />
              </span>
            )}
          </motion.button>
        </li>
      ))}
      {more > 0 && <li className="m-0 px-2 text-[11px] text-(--muted)">+{more} more</li>}
    </ul>
  );
}

function Ring({ mark, done, total }: { mark: string; done: number; total: number }) {
  const c = 2 * Math.PI * 9;
  const p = total > 0 ? Math.min(1, done / total) : 0.3;
  return (
    <span className="relative grid size-[22px] place-items-center text-[8.5px] font-semibold">
      <svg width="22" height="22" viewBox="0 0 22 22" className="absolute inset-0 -rotate-90" aria-hidden="true">
        <circle cx="11" cy="11" r="9" fill="none" stroke="rgb(242 240 235 / 0.14)" strokeWidth="2" />
        <circle
          cx="11"
          cy="11"
          r="9"
          fill="none"
          stroke="#a8c0cc"
          strokeWidth="2"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - p)}
        />
      </svg>
      {mark}
    </span>
  );
}
