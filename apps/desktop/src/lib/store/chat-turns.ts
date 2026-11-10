// Chat turns: new and cancel, streamed text, settings confirm and reacting to results.

import { api } from "../bridge";
import { revalidate } from "../cache";
import { firstToday } from "../mood";
import type { ActionResult, MascotState, Settings, Turn } from "../types";
import { setMood, useDuskie } from "./duskie-state";

export function cancelChat() {
  const { chatId } = useDuskie.getState();
  if (chatId) void api.aiCancel(chatId);
  void api.voiceStop();
}

/** Ends an in-flight chat so a new voice turn can start (clears chatId). */
export function clearInFlightChat() {
  cancelChat();
  if (useDuskie.getState().chatId) useDuskie.setState({ chatId: null });
}

/** Chirp/Pop while listening or waiting on a voice answer would talk over the user. */
export function muteSuggestionCue(state: MascotState, previous: MascotState | null): boolean {
  const { hearing, voiceQuestion } = useDuskie.getState();
  if (hearing !== null || voiceQuestion !== null) return true;
  return state === "listening" || previous === "listening";
}

/** Clears the Ask thread. Pass `cancel: false` to leave an in-flight answer
 * running unbound (Ctrl+N) so it can finish in the background. */
export function newChat(opts?: { cancel?: boolean }) {
  if (opts?.cancel !== false) cancelChat();
  const { ask, settings } = useDuskie.getState();
  useDuskie.setState({
    // A new chat starts from the setting; the old chat's choice stays with it.
    ask: ask && { ...ask, localOnly: settings.ai.localOnly },
    turns: [],
    chatId: null,
    chatPage: null,
    chatSkill: false,
    conversation: crypto.randomUUID(),
  });
}

/** Streamed words waiting for the next frame, by chat. */
export const pendingText = new Map<string, string>();

/** Reopening Ask within this long keeps the last chat. */
export const RESUME_MS = 10 * 60_000;

export function updateLastTurn(id: string, fn: (t: Turn) => Turn) {
  const { chatId, turns } = useDuskie.getState();
  const last = turns[turns.length - 1];
  if (id !== chatId || last?.role !== "assistant") return;
  useDuskie.setState({ turns: [...turns.slice(0, -1), fn(last)] });
}

/** The first time Duskie is seen each day, it says hello. */
export function helloOncePerDay() {
  if (firstToday()) setTimeout(() => setMood("hello", 2600, "hello"), 900);
}

let pendingFrame = 0;

let pendingTimer = 0;

/** Flush on the next frame; a hidden window paints no frames, so on a timer. */
export function scheduleText() {
  if (pendingFrame || pendingTimer) return;
  if (document.hidden) pendingTimer = window.setTimeout(flushText, 50);
  else pendingFrame = requestAnimationFrame(flushText);
}

export function flushText() {
  if (pendingFrame) cancelAnimationFrame(pendingFrame);
  if (pendingTimer) clearTimeout(pendingTimer);
  pendingFrame = 0;
  pendingTimer = 0;
  for (const [id, text] of pendingText)
    updateLastTurn(id, (t) => ({
      ...t,
      content: t.content + text,
      firstMs: t.firstMs ?? (t.startedAt ? Date.now() - t.startedAt : undefined),
    }));
  pendingText.clear();
}

/** Marks a result whose branch update stopped on conflicts. */
export const MERGE_AT = "git-merge:";

export const liveText = new Map<string, string>();

let confirmedCodeFolders: string[] | null = null;

let confirmedSavedProjects: string[] | null = null;

export function confirmSettings(settings: Settings) {
  const changed =
    confirmedCodeFolders !== null && JSON.stringify(confirmedCodeFolders) !== JSON.stringify(settings.codeFolders);
  const savedChanged =
    confirmedSavedProjects !== null &&
    JSON.stringify(confirmedSavedProjects) !== JSON.stringify(settings.savedProjects);
  confirmedCodeFolders = [...settings.codeFolders];
  confirmedSavedProjects = [...settings.savedProjects];
  useDuskie.setState({ settings });
  if (changed || savedChanged) {
    revalidate("projects", api.projectsList);
    revalidate("repos", () => api.reposOverview(false));
  }
}

/** Two failures this close together make the mascot sad, not just "oops". */
const SAD_WITHIN_MS = 10 * 60_000;

let failures = 0;

let lastFailure = 0;

/** The option the user picked last, to know what an action result was for. */
let lastPick: { skillId: string; label: string } | null = null;

export function notePick(skillId: string, label: string) {
  lastPick = { skillId, label };
}

/** How an action ended: a second failure in a row is sad; finishing the
 * whole morning routine is worth a small celebration. */
export function reactToResult(result: ActionResult, sound: boolean) {
  const pick = lastPick;
  lastPick = null;
  if (!result.ok) {
    const now = Date.now();
    failures = now - lastFailure < SAD_WITHIN_MS ? failures + 1 : 1;
    lastFailure = now;
    if (failures >= 2) {
      failures = 0;
      setMood("sad", 3500, sound ? "sad" : undefined);
    }
    return;
  }
  failures = 0;
  if (pick?.skillId === "system.morning-brief" && pick.label === "Open all") {
    setMood("celebrate", 3000, sound ? "fanfare" : undefined);
  }
}

/** How long a done pill stays before the island settles. */
export const DONE_PILL_MS = 2600;
