// The done pill, merge view, saving chats and hover.

import { api } from "../bridge";
import type { VoiceStatus } from "../types";
import { DONE_PILL_MS } from "./chat-turns";
import { useDuskie } from "./duskie-state";

let doneTimer: ReturnType<typeof setTimeout> | undefined;

/** Shows a compact done pill for a moment: nothing needs you. */
export function showDone(text: string, undo?: () => void) {
  clearTimeout(doneTimer);
  useDuskie.setState({ donePill: text, doneUndo: undo ?? null, voiceQuestion: null });
  doneTimer = setTimeout(
    () => useDuskie.setState({ donePill: null, doneUndo: null }),
    undo ? DONE_PILL_MS * 2 : DONE_PILL_MS,
  );
}

/** Loads the conflicts of an update into the island. */
export async function openMerge(path: string) {
  try {
    useDuskie.setState({ merge: { path, state: await api.mergeState(path) } });
  } catch (e) {
    useDuskie.setState({ lastResult: { ok: false, message: String(e), path: null, auto: false, undoId: null } });
  }
}

export function voiceReady(voice: VoiceStatus | null): boolean {
  return voice?.models.some((m) => m.id === "voice" && m.installed) ?? false;
}

/** Saves the conversation so Ask mode can list it later. */
export function saveChat() {
  const { turns, conversation } = useDuskie.getState();
  const first = turns.find((t) => t.role === "user");
  if (!first) return;
  const title = first.content.length > 60 ? `${first.content.slice(0, 57)}...` : first.content;
  const clean = turns.filter((t) => !t.streaming).map(({ streaming: _, tool: __, ...t }) => t);
  void api.chatSave(conversation, title, clean).catch(() => undefined);
}

export const setHovered = (hovered: boolean) => {
  if (hovered) {
    useDuskie.setState({ hovered });
    return;
  }
  // Leave shiftHeld alone while a suggestion is up, Shift+Alt morph is global
  // and must survive the cursor leaving the island.
  const keepShift = useDuskie.getState().suggestion != null;
  useDuskie.setState(keepShift ? { hovered } : { hovered, shiftHeld: false });
};
