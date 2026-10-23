// Agent sessions: the store, starting one and handing a chat off.

import { create } from "zustand";
import type { OpenChoice } from "../agent-questions";
import { api } from "../bridge";
import type { AgentMode, AgentStarted } from "../types";
import {
  type AgentsLayout,
  type AskTab,
  type Entry,
  loadLayout,
  type PlanDoc,
  type PlanItem,
  type QueuedStart,
  STORE_KEY,
} from "./timeline";

export interface Session extends AgentStarted {
  mode: AgentMode;
  activeMode?: AgentMode;
  compaction?: "running" | "done" | "failed";
  view?: { draft: string; scroll: number; follow: boolean; reviewing: boolean; active: number; reviewTurn?: string };
  title: string;
  status: "working" | "waiting" | "idle" | "ended" | "failed";
  entries: Entry[];
  plan: PlanItem[];
  /** Full plan write-up when parsed from prose or a Codex plan item. */
  planDoc?: PlanDoc | null;
  /** Timeline index of the entry the Plan card is pinned to. */
  planEntry?: number | null;
  /** ready for Build, building, or finished (Built). */
  planPhase?: "ready" | "building" | "built" | null;
  usage: { used: number; window: number; total?: number; at?: number } | null;
  /** The plan's usage limit, when the agent says it is close or reached. */
  limit?: { status: string; window: string; resetsAt: number | null; used: number | null } | null;
  /** When it started waiting on you. */
  waitingSince?: number;
  /** Paused from its card: stopped after the current step, resumes on request. */
  paused?: boolean;
  /** "Not now" on the compact offer, until the context is compacted. */
  compactDismissed?: boolean;
  /** The agent's own multiple-choice question, waiting for an answer. */
  choose?: OpenChoice | null;
  /** A permission question waiting for the user. */
  question: { id: string; label: string; detail: string } | null;
  error: string | null;
  startedAt: number;
  /** When the current turn began, and how long the last one took. */
  turnAt: number;
  tookMs: number | null;
  /** Files changed when it ended, from Rust. */
  changes: number;
  /** The turn whose review was finished, and how many changes were left undecided. */
  reviewed?: { turnAt: number; left: number } | null;
  /** Said before the next message after a rewind, so the agent knows. */
  note?: string | null;
  /** Cut off by a restart: nothing runs until Resume. */
  restored?: boolean;
  /** The Ollama model a Local session runs. */
  localModel?: string;
  /** Picked in the chat box; null is the agent's default. */
  model?: string | null;
  /** Thinking: off, low, medium, high; null is the default. */
  effort?: string | null;
  /** The local model went round in circles: offer a handoff. */
  stuck?: boolean;
}

export interface AgentsState {
  layout: AgentsLayout;
  /** The board tile the chat box talks to. */
  focus: string | null;
  /** Ask's tab: quick questions, agent sessions, or history. */
  tab: AskTab;
  sessions: Session[];
  /** The session shown in the Agents tab; null shows New. */
  current: string | null;
  /** The project New starts in, when something picked it. */
  draftPath?: string | null;
  /** What New's box starts with ("Ask an agent to fix it"). */
  draftPrompt?: string | null;
  /** New agents waiting for a free slot, oldest first. */
  queued: QueuedStart[];
  /** Cards put off with Later: session id to the moment it was waiting from. */
  later: Record<string, number>;
  /** The repo open in the Git dock; "first" picks one once the list loads. */
  dock?: string | null;
  /** Island list width while a side dock (Git or Review) is open beside it. */
  listW?: number;
}

function loadSessions(): Session[] {
  try {
    const raw = typeof localStorage === "undefined" ? null : localStorage.getItem(STORE_KEY);
    const saved = raw ? JSON.parse(raw) : [];
    const list: Session[] = Array.isArray(saved) ? saved : (saved.sessions ?? []);
    // Whatever was running stopped with Duskie; each can be resumed.
    return list.map((s) => ({
      ...s,
      status: s.status === "working" || s.status === "waiting" ? "ended" : s.status,
      question: null,
      choose: null,
      restored: true,
    }));
  } catch {
    return [];
  }
}

function loadView(): Partial<AgentsState> {
  try {
    const saved = JSON.parse(localStorage.getItem(STORE_KEY) ?? "{}");
    const ids = new Set(loadSessions().map((s) => s.id));
    return {
      current: ids.has(saved.current) ? saved.current : null,
      focus: ids.has(saved.focus) ? saved.focus : null,
      tab: ["ask", "agents", "repos", "history"].includes(saved.tab) ? saved.tab : "ask",
      layout: saved.layout === "board" ? "board" : saved.layout === "one" ? "one" : loadLayout(),
    };
  } catch {
    return {};
  }
}

export const useAgents = create<AgentsState>(() => ({
  tab: "ask",
  sessions: loadSessions(),
  current: null,
  layout: typeof window === "undefined" ? "one" : loadLayout(),
  focus: null,
  queued: [],
  later: {},
  ...loadView(),
}));

export function update(id: string, fn: (s: Session) => Session) {
  useAgents.setState((st) => ({
    sessions: st.sessions.map((s) => {
      if (s.id !== id) return s;
      const next = fn(s);
      // Notes when it started waiting on you, for "Waiting 3 min".
      if (next.status === "waiting" && s.status !== "waiting") return { ...next, waitingSince: Date.now() };
      return next;
    }),
  }));
}

export async function startOne(
  agent: string,
  path: string,
  prompt: string,
  mode: AgentMode,
  model: string | null,
  effort: string | null,
  focus: boolean,
): Promise<string> {
  const started = await api.agentStart(agent, path, prompt, mode, model, effort);
  addSession(started, prompt, mode, prompt, focus);
  update(started.id, (s) => ({ ...s, model, effort }));
  return started.id;
}

function addSession(started: AgentStarted, title: string, mode: AgentMode, first: string, focus = true) {
  const session: Session = {
    ...started,
    mode,
    title: title.length > 60 ? `${title.slice(0, 57)}...` : title,
    status: "working",
    activeMode: mode,
    entries: [{ kind: "you", text: first }],
    plan: [],
    planDoc: null,
    planEntry: null,
    planPhase: null,
    usage: null,
    question: null,
    error: null,
    startedAt: Date.now(),
    turnAt: Date.now(),
    tookMs: null,
    changes: 0,
  };
  useAgents.setState((st) =>
    focus
      ? { sessions: [session, ...st.sessions], current: started.id, tab: "agents" }
      : { sessions: [session, ...st.sessions] },
  );
}

/** Continues an Ask conversation in Claude Code or Codex, here in the island. */
export async function handOff(messages: { role: "user" | "assistant"; content: string }[], reason: string | null) {
  const started = await api.agentHandoff(messages, reason);
  const first = messages.find((m) => m.role === "user")?.content ?? "Continue the conversation";
  addSession(started, `Continue: ${first}`, "ask", first);
  return started.id;
}
