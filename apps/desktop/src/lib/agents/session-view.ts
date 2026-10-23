// Per-session view state, plans, layout, new-session choices, tune and finish.

import { api } from "../bridge";
import type { AgentMode } from "../types";
import { type Session, update, useAgents } from "./session";
import { type AgentsLayout, LAYOUT_KEY, lastTextEntry, type PlanDoc, type PlanItem } from "./timeline";

/** "Not now" on the compact offer. */
export function dismissCompact(id: string) {
  update(id, (s) => ({ ...s, compactDismissed: true }));
}

export function sessionView(id: string, patch: Partial<NonNullable<Session["view"]>>) {
  update(id, (s) => ({
    ...s,
    view: { draft: "", scroll: 0, follow: true, reviewing: false, active: 0, ...s.view, ...patch },
  }));
}

export async function setSessionMode(id: string, mode: AgentMode) {
  try {
    await api.agentSetMode(id, mode);
    update(id, (s) => ({
      ...s,
      mode,
      // Entering Plan for a new round: drop the previous card so it cannot flash stale.
      ...(mode === "plan" && s.mode !== "plan" ? { plan: [], planDoc: null, planEntry: null, planPhase: null } : {}),
    }));
  } catch (e) {
    update(id, (s) => ({ ...s, error: String(e) }));
  }
}

/** Replace the session checklist and optional full plan document. */
export function setSessionPlan(id: string, plan: PlanItem[], planDoc?: PlanDoc | null, planEntry?: number | null) {
  update(id, (s) => ({
    ...s,
    plan,
    planDoc: planDoc === undefined ? s.planDoc : planDoc,
    planEntry:
      planEntry !== undefined
        ? planEntry
        : plan.length === 0 && (planDoc === null || planDoc === undefined)
          ? null
          : (s.planEntry ?? lastTextEntry(s.entries)),
    // A new/updated plan document is ready to Build again.
    planPhase:
      plan.length === 0 && (planDoc === null || planDoc === undefined)
        ? null
        : s.planPhase === "building" || s.planPhase === "built"
          ? s.planPhase
          : "ready",
  }));
}

/** Clear plan card state (fresh Plan turn, rewind). */
export function clearSessionPlan(id: string) {
  update(id, (s) => ({ ...s, plan: [], planDoc: null, planEntry: null, planPhase: null }));
}

export function sendToSession(id: string, text: string) {
  const note = useAgents.getState().sessions.find((s) => s.id === id)?.note;
  update(id, (s) => ({
    ...s,
    entries: [...s.entries, { kind: "you", text }],
    // Sending anything answers or replaces the agent's open question.
    choose: null,
    status: "working",
    paused: false,
    stuck: false,
    activeMode: s.status === "working" || s.status === "waiting" ? s.activeMode : s.mode,
    turnAt: Date.now(),
    tookMs: null,
    note: null,
    error: null,
  }));
  void api
    .agentSend(id, note ? `${note}\n\n${text}` : text)
    .catch((e: unknown) => update(id, (s) => ({ ...s, status: "failed", error: String(e) })));
}

/** Leave Plan mode and start building without pasting the plan into chat. */
export async function buildSessionPlan(id: string) {
  await setSessionMode(id, "edit");
  update(id, (s) => ({ ...s, planPhase: "building" }));
  sendToSession(id, "Build the approved plan.");
}

export function setLayout(layout: AgentsLayout) {
  useAgents.setState({ layout });
  try {
    localStorage.setItem(LAYOUT_KEY, layout);
  } catch {
    // Not kept: the layout resets after a restart.
  }
}

/** The three Agents views: every session, one big, or the board. */
export type AgentsView = "home" | "one" | "board";

export function viewOf(st: { layout: AgentsLayout; current: string | null }): AgentsView {
  return st.layout === "board" ? "board" : st.current === null ? "home" : "one";
}

export function setView(view: AgentsView) {
  if (view === "board") return setLayout("board");
  setLayout("one");
  if (view === "home") return useAgents.setState({ current: null });
  const st = useAgents.getState();
  if (st.current !== null) return;
  const latest = [...st.sessions].sort((a, b) => b.turnAt - a.turnAt)[0];
  if (latest) useAgents.setState({ current: latest.id });
}

/** Gives a session your own name; it shows in the row and the board. */
export function renameSession(id: string, title: string) {
  const t = title.trim();
  if (t) update(id, (s) => ({ ...s, title: t }));
}

export type AgentNewPrefs = {
  agent?: string | null;
  model?: string | null;
  effort?: string | null;
  mode?: AgentMode;
  byAgent?: Record<string, { model?: string | null; effort?: string | null }>;
};

/** New-session agent/model/effort/mode, so reopening Agents does not flash defaults. */
const NEW_PREFS_KEY = "sidekick.agentNewPrefs";

export function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function readNewPrefs(): AgentNewPrefs {
  return readJson<AgentNewPrefs>(NEW_PREFS_KEY, {});
}

export function writeNewPrefs(patch: AgentNewPrefs) {
  try {
    const prev = readNewPrefs();
    const agent = patch.agent !== undefined ? patch.agent : prev.agent;
    const byAgent = { ...prev.byAgent, ...patch.byAgent };
    if (agent && (patch.model !== undefined || patch.effort !== undefined || patch.byAgent?.[agent])) {
      byAgent[agent] = {
        ...prev.byAgent?.[agent],
        ...patch.byAgent?.[agent],
        ...(patch.model !== undefined ? { model: patch.model } : {}),
        ...(patch.effort !== undefined ? { effort: patch.effort } : {}),
      };
    }
    const next: AgentNewPrefs = { ...prev, ...patch, byAgent };
    localStorage.setItem(NEW_PREFS_KEY, JSON.stringify(next));
  } catch {
    // Not kept across restarts.
  }
}

/** Model and thinking for one session, from its chat box. */
export function tuneSession(id: string, model: string | null, effort: string | null) {
  update(id, (s) => {
    const agent = s.agent.toLowerCase().replace(/\s+/g, "_");
    writeNewPrefs({ agent, model, effort });
    return { ...s, model, effort };
  });
  void api.agentTune(id, model, effort).catch((e) => update(id, (s) => ({ ...s, error: String(e) })));
}

/** Cap persisted sessions so streaming does not stringify unbounded timelines. */
export const SAVE_CAP = 20;
