// Starting sessions: the queue and slots, the usual agent, tabs and later cards.

import { mask } from "../mask";
import type { AgentMode } from "../types";
import { type Session, startOne, useAgents } from "./session";
import { readJson, SAVE_CAP } from "./session-view";
import { type AskTab, STORE_KEY } from "./timeline";

let saveTimer: ReturnType<typeof setTimeout> | null = null;

function saveView(st = useAgents.getState()) {
  try {
    localStorage.setItem(
      STORE_KEY,
      JSON.stringify(
        {
          version: 2,
          sessions: st.sessions.slice(0, SAVE_CAP),
          current: st.current,
          focus: st.focus,
          tab: st.tab,
          layout: st.layout,
        },
        (_k, v: unknown) => (typeof v === "string" ? mask(v) : v),
      ),
    );
  } catch {
    // Storage full or blocked: the timeline just does not survive a restart.
  }
}
useAgents.subscribe(() => {
  if (saveTimer) clearTimeout(saveTimer);
  // Idle longer than a stream token so typing/draft flushes do not fight agent events.
  saveTimer = setTimeout(() => saveView(), 800);
});
if (typeof window !== "undefined") {
  window.addEventListener("pagehide", () => saveView());
  window.addEventListener("beforeunload", () => saveView());
}

/** Flush session view (draft/scroll) + localStorage immediately, island hide / unmount. */
export function flushAgentsView() {
  if (saveTimer) clearTimeout(saveTimer);
  saveView();
}

/** Last usual agent per project path (+ `__last` for first paint before path is known). */
const USUAL_KEY = "sidekick.agentUsualByPath";

/** Cached usual agent for a project; `__last` when path is not ready yet. */
export function readUsualAgent(path?: string | null): string | null {
  const map = readJson<Record<string, string | null>>(USUAL_KEY, {});
  if (path && map[path]) return map[path];
  return map.__last ?? null;
}

export function writeUsualAgent(path: string, id: string | null) {
  try {
    const map = readJson<Record<string, string | null>>(USUAL_KEY, {});
    map[path] = id;
    map.__last = id;
    localStorage.setItem(USUAL_KEY, JSON.stringify(map));
  } catch {
    // Storage blocked: next open may flash until agentUsual returns again.
  }
}

/** Opens a tab. Agents defaults to New unless a session is still working or waiting. */
export function setTab(tab: AskTab) {
  if (tab !== "agents") {
    useAgents.setState({ tab });
    return;
  }
  const st = useAgents.getState();
  const cur = st.sessions.find((s) => s.id === st.current);
  useAgents.setState({ tab, current: cur ? st.current : null });
}

/** "Later" on an agent's card: hides it until the agent does something new. */
export function laterCard(id: string) {
  const s = useAgents.getState().sessions.find((x) => x.id === id);
  if (s) useAgents.setState((st) => ({ later: { ...st.later, [id]: s.waitingSince ?? s.turnAt } }));
}

/** True while the card was put off and the agent has not moved on since. */
export const cardLater = (later: Record<string, number>, s: Session) =>
  later[s.id] !== undefined && later[s.id] === (s.waitingSince ?? s.turnAt);

/** How many agents run at once; the next one waits in Queued. */
export const SLOTS = 4;

export const runningCount = (sessions: Session[]) => sessions.filter((s) => s.status === "working").length;

/** Starts in flight, so two finishing agents do not both pull the same slot. */
let starting = 0;

async function startNow(
  agent: string,
  path: string,
  prompt: string,
  mode: AgentMode,
  model: string | null,
  effort: string | null,
  focus = true,
): Promise<string> {
  starting += 1;
  try {
    return await startOne(agent, path, prompt, mode, model, effort, focus);
  } finally {
    starting -= 1;
  }
}

// A freed slot starts the oldest queued agent.
if (typeof window !== "undefined") {
  useAgents.subscribe((st) => {
    const next = st.queued[0];
    if (!next || runningCount(st.sessions) + starting >= SLOTS) return;
    useAgents.setState({ queued: st.queued.slice(1) });
    // Started in the background: it joins the list without taking over the view.
    void startNow(next.agent, next.path, next.prompt, next.mode, next.model, next.effort, false).catch((e: unknown) =>
      console.warn("queued agent did not start", e),
    );
  });
}

/** Starts the agent now, or queues it when every slot is busy. Returns the
 *  session id, or the queue id when it waits. */
export async function startSession(
  agent: string,
  path: string,
  prompt: string,
  mode: AgentMode,
  model: string | null = null,
  effort: string | null = null,
): Promise<string> {
  const st = useAgents.getState();
  if (runningCount(st.sessions) + starting >= SLOTS) {
    const id = `queued:${Date.now()}`;
    useAgents.setState({ queued: [...st.queued, { id, agent, path, prompt, mode, model, effort, at: Date.now() }] });
    return id;
  }
  return startNow(agent, path, prompt, mode, model, effort);
}

export function cancelQueued(id: string) {
  useAgents.setState((st) => ({ queued: st.queued.filter((q) => q.id !== id) }));
}

/** Opens New in Agents for one project ("Start an agent here"). */
export const startHere = (path: string, prompt?: string | null) =>
  useAgents.setState({ tab: "agents", current: null, draftPath: path, draftPrompt: prompt ?? null });
