// Ask actions: open a chat, start a skill, listen, overlays and settings updates.

import { api } from "../bridge";
import type { HitRect, Settings } from "../types";
import { cancelChat, confirmSettings, newChat } from "./chat-turns";
import { useDuskie } from "./duskie-state";
import { sendChat } from "./send-chat";
import { liveIds } from "./waiting";

/** Picks up a saved conversation. */
export async function openChat(id: string) {
  cancelChat();
  const turns = await api.chatGet(id);
  // The chat keeps the This PC only it was last asked with, whatever the setting says now.
  const last = turns.findLast((t) => t.role === "user");
  const { ask, settings } = useDuskie.getState();
  const localOnly = last?.localOnly ?? settings.ai.localOnly;
  useDuskie.setState({
    turns,
    chatId: null,
    chatPage: null,
    chatSkill: false,
    conversation: id,
    ask: ask && { ...ask, localOnly },
  });
}

/** Starts a conversation in which AI drafts a new skill. */
export function startSkill(description: string) {
  newChat();
  useDuskie.setState({ chatSkill: true });
  sendChat(`Write a skill: ${description}`);
}

/** Push to talk: listen now, no wake word needed. */
export function startListening() {
  useDuskie.setState({ hearing: "" });
  api.voiceListen().catch((e) => {
    const { turns } = useDuskie.getState();
    useDuskie.setState({ hearing: null, turns: [...turns, { role: "assistant", content: "", error: String(e) }] });
  });
}

/** Stops a Live answer: speech, the model and the caption. */
export function stopLive() {
  const { chatId } = useDuskie.getState();
  if (chatId && liveIds.has(chatId)) void api.aiCancel(chatId);
  void api.voiceStop();
  useDuskie.setState({ live: null });
}

/** Grow the clickable area around a floating menu so it is not click-through. */
export const setOverlayHit = (overlayHit: HitRect | null) => {
  const prev = useDuskie.getState().overlayHit;
  if (prev === overlayHit) return;
  if (
    prev &&
    overlayHit &&
    prev.x === overlayHit.x &&
    prev.y === overlayHit.y &&
    prev.width === overlayHit.width &&
    prev.height === overlayHit.height
  ) {
    return;
  }
  useDuskie.setState({ overlayHit });
};

export function updateSettings(patch: Partial<Settings>): Promise<Settings> {
  const next = { ...useDuskie.getState().settings, ...patch };
  useDuskie.setState({ settings: next });
  return api.settingsSet(next).then((settings) => {
    confirmSettings(settings);
    return settings;
  });
}
