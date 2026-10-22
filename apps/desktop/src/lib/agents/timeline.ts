// Timeline entries, plans, layout keys and plan usage seen per agent.

import type { AgentMode } from "../types";

export interface Step {
  id: string;
  tool: string;
  label: string;
  detail: string;
  state: "running" | "done" | "failed" | "cancelled";
  /** The end of a command's output, folded under the step. */
  output?: string;
}

export interface PlanItem {
  /** Short step heading. */
  text: string;
  /** Full step write-up under the heading. */
  detail?: string;
  status: "pending" | "in_progress" | "completed";
}

/** Full plan document shown in Plan mode (Cursor-style), not just todos. */
export interface PlanDoc {
  title: string;
  items: PlanItem[];
  assumptions?: string;
  markdown: string;
}

/** One entry in a session's timeline: something said, or a step taken. */
export type Entry =
  | { kind: "you"; text: string }
  | { kind: "text"; text: string }
  | { kind: "step"; step: Step }
  | { kind: "review"; id: string; files: number; error: string | null };

/** One session big, or the board of live tiles. */
export type AgentsLayout = "one" | "board";

export const LAYOUT_KEY = "sidekick.agentsLayout";

export function loadLayout(): AgentsLayout {
  try {
    return localStorage.getItem(LAYOUT_KEY) === "board" ? "board" : "one";
  } catch {
    return "one";
  }
}

/** Sessions are kept in this window's storage, so the timeline comes back
 * after a restart; Rust keeps what Review, Undo and Resume need. */
export const STORE_KEY = "sidekick.agents";

/** A new agent waiting for a free slot. */
export interface QueuedStart {
  id: string;
  agent: string;
  path: string;
  prompt: string;
  mode: AgentMode;
  model: string | null;
  effort: string | null;
  at: number;
}

export type AskTab = "ask" | "agents" | "repos" | "history";

/** Last agent text entry index, or the last entry if none. */
export function lastTextEntry(entries: Entry[]): number | null {
  for (let i = entries.length - 1; i >= 0; i--) {
    if (entries[i]?.kind === "text") return i;
  }
  return entries.length > 0 ? entries.length - 1 : null;
}

/** Half the context used: Claude Code works best compacted from here. */
export const COMPACT_AT = 0.5;

export function entriesCancelRunning(entries: Entry[]): Entry[] {
  return entries.map((e) =>
    e.kind === "step" && e.step.state === "running" ? { kind: "step", step: { ...e.step, state: "cancelled" } } : e,
  );
}

/** One plan-limit window an agent reported, kept so the picker and usage pop can show it. */
export interface SeenUsage {
  used: number;
  window: string;
  resetsAt: number | null;
  at: number;
}

const USAGE_KEY = "sidekick.agentUsage";

function isSeenUsage(v: unknown): v is SeenUsage {
  return !!v && typeof v === "object" && "used" in v && "window" in v && "at" in v;
}

/** Per agent, each rate-limit window (5-hour, weekly, …). */
type SeenByAgent = Record<string, Record<string, SeenUsage>>;

/** Older stores kept one SeenUsage per agent; lift those into a window map. */
export function seenAll(): SeenByAgent {
  try {
    const raw = JSON.parse(localStorage.getItem(USAGE_KEY) ?? "{}") as Record<string, unknown>;
    const out: SeenByAgent = {};
    for (const [agent, v] of Object.entries(raw)) {
      if (isSeenUsage(v)) {
        out[agent] = { [v.window || "plan"]: v };
      } else if (v && typeof v === "object") {
        const windows: Record<string, SeenUsage> = {};
        for (const [w, u] of Object.entries(v as Record<string, unknown>)) {
          if (isSeenUsage(u)) windows[w] = u;
        }
        if (Object.keys(windows).length) out[agent] = windows;
      }
    }
    return out;
  } catch {
    return {};
  }
}

export function noteUsage(agent: string, u: SeenUsage) {
  const key = u.window || "plan";
  try {
    const all = seenAll();
    localStorage.setItem(USAGE_KEY, JSON.stringify({ ...all, [agent]: { ...all[agent], [key]: u } }));
  } catch {
    // Not kept: the picker just shows nothing for this agent.
  }
}

/** Timeline Review rows only when there are real files (or a capture error). */
export function appendReview(entries: Entry[], review: unknown): Entry[] {
  const r = review as { id: string; files: number; error: string | null } | null | undefined;
  if (!r?.id) return entries;
  if (r.files === 0 && !r.error) return entries;
  if (entries.some((entry) => entry.kind === "review" && entry.id === r.id)) return entries;
  return [...entries, { kind: "review", id: r.id, files: r.files, error: r.error }];
}
