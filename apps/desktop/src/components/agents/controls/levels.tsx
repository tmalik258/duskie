"use client";

// Part of controls: LEVELS, ABOUT, idOf, markOf, modelsFor, defaultModel, DEFAULT_EFFORT, Caret, Brain, ModeId, MODE_INFO, Pop.

import { type ReactNode, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CLAUDE_MODELS, CODEX_MODELS, FAST_CLAUDE_MODEL } from "@/lib/ai-models";
import { setOverlayHit, useDuskie } from "@/lib/store";
import type { IcName } from "../../icon";
import { AGENT_MARKS } from "../marks";

/** Thinking levels; "max" is the most each agent allows. */
export const LEVELS: [string, string, string][] = [
  ["low", "Low", "Quick answers, least usage."],
  ["medium", "Medium", "A good default for most changes."],
  ["high", "High", "Plans first. Slower, uses more."],
  ["max", "Max", "For hard bugs. Uses the most."],
];

/** One line on each model, and how much it can hold. */
export const ABOUT: Record<string, [string, string]> = {
  [FAST_CLAUDE_MODEL]: ["Fast, light tasks", "200k"],
  "claude-opus-5-5": ["Most capable, uses limits fastest", "1M"],
  "claude-sonnet-5-5": ["Everyday coding, balanced", "1M"],
  "claude-fable-5-1": ["Long, careful work", "1M"],
  "claude-fable-5": ["Long, careful work", "1M"],
  "claude-opus-4-6": ["Previous Opus", "200k"],
  "claude-sonnet-4-6": ["Previous Sonnet", "200k"],
};

export const idOf = (agent: string) => agent.toLowerCase().replace(/\s+/g, "_");

export const markOf = (agent: string): [string, string] => AGENT_MARKS[idOf(agent)] ?? ["?", "#2b2b30"];

/** The models an agent can switch between here; none when it picks its own. */
export function modelsFor(agent: string): [string, string][] {
  const id = idOf(agent);
  if (id === "claude_code") return CLAUDE_MODELS;
  if (id === "codex") return CODEX_MODELS;
  return [];
}

/** The model an agent starts on when none is picked. */
export function defaultModel(agent: string): string | null {
  const id = idOf(agent);
  if (id === "claude_code") return "claude-opus-5-5";
  if (id === "codex") return CODEX_MODELS.find(([v]) => v === "gpt-6.1-sol")?.[0] ?? CODEX_MODELS[0]?.[0] ?? null;
  return null;
}

/** Thinking an agent starts on when none is picked. */
export const DEFAULT_EFFORT = "medium";

export const Caret = () => (
  <svg viewBox="0 0 16 16" aria-hidden="true" className="size-3 opacity-60">
    <path d="m4 6 4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
  </svg>
);

export const Brain = () => (
  <svg viewBox="0 0 16 16" aria-hidden="true" className="size-3.5 opacity-75">
    <path
      d="M6 3a2 2 0 0 0-2 2 2 2 0 0 0-1 3.5A2 2 0 0 0 5 12a2 2 0 0 0 3 .5V3.5A2 2 0 0 0 6 3Zm4 0a2 2 0 0 1 2 2 2 2 0 0 1 1 3.5 2 2 0 0 1-2 3.5 2 2 0 0 1-3 .5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.2"
      strokeLinejoin="round"
    />
  </svg>
);

export type ModeId = "plan" | "ask" | "edit" | "debug" | "full" | "try";

/** The agent modes, with the icon and note each shows in the composer bar. */
export const MODE_INFO: { id: ModeId; label: string; note: string; icon: IcName }[] = [
  { id: "plan", label: "Plan", note: "Reads and plans, changes nothing", icon: "file" },
  { id: "ask", label: "Ask", note: "Asks before every change", icon: "warn" },
  { id: "edit", label: "Edit", note: "Edits files, asks before commands", icon: "pencil" },
  {
    id: "debug",
    label: "Debug",
    note: "Adds temporary logs, finds the cause, fixes it, then removes the logs",
    icon: "bug",
  },
  { id: "full", label: "Full", note: "Does everything without asking", icon: "bolt" },
  { id: "try", label: "Try", note: "Works on a copy. Keep it or throw it away", icon: "copy" },
];

/** A chip that opens a popover above itself (portaled so the island shell
 *  does not clip it; same pattern as the model Select overlay). */
export function Pop({
  label,
  chip,
  className = "",
  children,
  requested,
}: {
  label: string;
  chip: ReactNode;
  className?: string;
  children: (close: () => void) => ReactNode;
  requested?: number;
}) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (requested) setOpen(true);
  }, [requested]);
  const btn = useRef<HTMLButtonElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const islandColor = useDuskie((s) => s.settings.islandColor);
  const [at, setAt] = useState<{ left: number; bottom: number } | null>(null);
  useEffect(() => {
    if (!open) {
      setAt(null);
      return;
    }
    const r = btn.current?.getBoundingClientRect();
    // Grows from the chip: left-aligned on the left half, right-aligned on the right.
    if (r)
      setAt({
        left: r.left + r.width / 2 > window.innerWidth / 2 ? r.right - 324 : r.left,
        bottom: window.innerHeight - r.top + 8,
      });
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!btn.current?.contains(t) && !box.current?.contains(t)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        setOpen(false);
        btn.current?.focus();
      }
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey, true);
      setOverlayHit(null);
    };
  }, [open]);
  // Keep the popover on screen and clickable above the island.
  useLayoutEffect(() => {
    const el = box.current;
    if (!open || !at || !el) return;
    const r = el.getBoundingClientRect();
    const left = Math.max(8, Math.min(at.left, window.innerWidth - r.width - 8));
    if (left !== at.left) setAt({ ...at, left });
    setOverlayHit({ x: left, y: r.top, width: r.width, height: r.height });
  }, [open, at]);
  return (
    <>
      <button
        ref={btn}
        type="button"
        aria-label={label}
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => setOpen((o) => !o)}
        className={`ak-cchip chip ${className}`}
      >
        {chip}
      </button>
      {open &&
        at &&
        createPortal(
          <div
            ref={box}
            role="dialog"
            aria-label={label}
            data-color={islandColor}
            className="ak-pop menu"
            style={{ left: at.left, bottom: at.bottom, zIndex: 100 }}
          >
            {children(() => setOpen(false))}
          </div>,
          document.body,
        )}
    </>
  );
}
