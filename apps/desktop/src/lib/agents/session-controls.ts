// Closing, pausing and interrupting sessions; usage lines; the review and git docks.

import { api } from "../bridge";
import { dockTotal, readSeam, stacked } from "../seam";
import { agoText } from "../time-text";
import { type AgentsState, type Session, update, useAgents } from "./session";
import { sendToSession, sessionView } from "./session-view";
import { type AskTab, entriesCancelRunning, type SeenUsage, seenAll } from "./timeline";

export function closeSession(id: string) {
  void api.agentClose(id);
  useAgents.setState((st) => ({
    sessions: st.sessions.filter((s) => s.id !== id),
    current: st.current === id ? null : st.current,
    focus: st.focus === id ? null : st.focus,
  }));
}

/** How many sessions are working or waiting for an answer. */
export function activeCount(sessions: Session[]): number {
  return sessions.filter((s) => s.status === "working" || s.status === "waiting").length;
}

/** Every plan window Duskie has seen for an agent (5-hour, weekly, …). */
export function seenWindows(agent: string): SeenUsage[] {
  const map = seenAll()[agent];
  if (!map) return [];
  return Object.values(map);
}

function pct(u: SeenUsage): number {
  return Math.round(u.used <= 1 ? u.used * 100 : u.used);
}

/** The busiest live window, for a one-line chip; null when never seen. */
export function seenUsage(agent: string): SeenUsage | null {
  const now = Date.now();
  const live = seenWindows(agent).filter((u) => !(u.resetsAt !== null && u.resetsAt * 1000 <= now));
  if (live.length === 0) return null;
  return live.reduce((a, b) => (pct(b) > pct(a) ? b : a));
}

/** "85% of 5-hour, 20 min ago"; "ready" once every window has reset; null when never seen. */
export function usageLine(agent: string, now = Date.now()): string | null {
  const all = seenWindows(agent);
  if (all.length === 0) return null;
  const live = all.filter((u) => !(u.resetsAt !== null && u.resetsAt * 1000 <= now));
  if (live.length === 0) return "ready";
  const u = live.reduce((a, b) => (pct(b) > pct(a) ? b : a));
  const span = u.window === "five_hour" ? "5-hour" : u.window.startsWith("seven_day") ? "week" : "plan";
  const ago = agoText(u.at, { suffix: true, justNow: "just now" }, now);
  return `${pct(u)}% of ${span}, ${ago}`;
}

/** Esc / Stop: leave the session idle right away; Rust keeps it resumable on the next send. */
export function interruptSession(id: string) {
  update(id, (s) => ({
    ...s,
    status: "idle",
    question: null,
    tookMs: s.tookMs ?? Date.now() - s.turnAt,
    error: null,
    entries: entriesCancelRunning(s.entries),
  }));
  void api.agentStop(id);
}

/** Pause: stop the turn but keep the session ready to pick up where it was. */
export function pauseSession(id: string) {
  interruptSession(id);
  update(id, (s) => ({ ...s, paused: true }));
}

/** Resume a paused session by asking it to carry on. */
export function resumePaused(id: string) {
  update(id, (s) => ({ ...s, paused: false }));
  sendToSession(id, "Continue where you left off.");
}

/** Clear reviewing on every session (one Review dock at a time). */
export function clearReviewing() {
  const { sessions } = useAgents.getState();
  for (const s of sessions) {
    if (s.view?.reviewing) sessionView(s.id, { reviewing: false });
  }
}

/** Session id currently open in the Review dock, if any. */
export function reviewingSessionId(): string | null {
  return useAgents.getState().sessions.find((s) => s.view?.reviewing)?.id ?? null;
}

/** Open Review beside Agents (wide) or stacked in the session column (narrow). */
export function openReview(id: string) {
  const { dock, listW, sessions } = useAgents.getState();
  const screenW = typeof window === "undefined" ? 1920 : window.screen.availWidth;
  const side = !stacked(screenW);
  const patch: Partial<AgentsState> & { tab: AskTab } = { tab: "agents" };
  if (dock) patch.dock = null;
  if (side && listW == null) patch.listW = readSeam(dockTotal(screenW));
  if (!side) patch.listW = undefined;
  useAgents.setState(patch);
  for (const s of sessions) {
    if (s.id !== id && s.view?.reviewing) sessionView(s.id, { reviewing: false });
  }
  sessionView(id, { reviewing: true });
}

/** Remember that this turn's review was finished, so the chip says Reviewed. */
export function markReviewed(id: string, left: number) {
  update(id, (s) => ({ ...s, reviewed: { turnAt: s.turnAt, left } }));
}

/** Close the Review dock for a session (or whichever is open). */
export function closeReview(id?: string) {
  const target = id ?? reviewingSessionId();
  if (target) sessionView(target, { reviewing: false });
  const { dock } = useAgents.getState();
  if (!dock) useAgents.setState({ listW: undefined });
}

/** Close the Git dock. Window stays at dock-max (no OS resize). */
export function closeDock() {
  useAgents.setState({
    dock: null,
    // Keep seam width if Review is still open beside.
    ...(reviewingSessionId() ? {} : { listW: undefined }),
  });
}

/** Open or switch the repo shown in the Git dock. */
export function setDock(path: string | null) {
  if (path == null) {
    closeDock();
    return;
  }
  clearReviewing();
  const { listW } = useAgents.getState();
  const screenW = typeof window === "undefined" ? 1920 : window.screen.availWidth;
  const side = !stacked(screenW);
  useAgents.setState({
    dock: path,
    ...(listW == null && side ? { listW: readSeam(dockTotal(screenW)) } : {}),
  });
}

/** Open the Git tab (and dock) without toggling a dock that is already open.
 * Layout only - the OS window stays at dock-max from launch (no set_size). */
export async function showGit() {
  clearReviewing();
  const { dock, listW } = useAgents.getState();
  const screenW = typeof window === "undefined" ? 1920 : window.screen.availWidth;
  const side = !stacked(screenW);
  const patch: Partial<AgentsState> & { tab: AskTab } = { tab: "repos" };
  if (!dock) patch.dock = "first";
  if (listW == null && side) {
    patch.listW = readSeam(dockTotal(screenW));
  }
  useAgents.setState(patch);
}

/** Ctrl G: toggle the Git dock on the Repos tab (opens on the repo with changes). */
export function openGit() {
  const { dock } = useAgents.getState();
  if (dock) {
    closeDock();
    return;
  }
  void showGit();
}
