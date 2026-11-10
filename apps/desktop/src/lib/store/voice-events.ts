// Voice status and heard speech.

import { api, type EVENTS, type EventPayloads } from "../bridge";
import { clearInFlightChat } from "./chat-turns";
import { voiceReady } from "./done-pill";
import { useDuskie } from "./duskie-state";
import { dropEarly, early, sendChat, startEarly } from "./send-chat";
import { liveIds, watchVoice } from "./waiting";

export function onVoiceState(voiceStatus: EventPayloads[typeof EVENTS.voiceState]) {
  useDuskie.setState({ voiceStatus });
  const { settings, ask } = useDuskie.getState();
  if (!settings.onboarded && !ask && voiceReady(voiceStatus)) {
    void api.askEnsureWelcome();
  }
}

export function onVoiceHeard({ text, final, pause, byVoice }: EventPayloads[typeof EVENTS.voiceHeard]) {
  if (!final) {
    if (pause) {
      startEarly(text.trim(), useDuskie.getState().settings.voice.speakAnswers);
      return;
    }
    // More words came: the early answer was for a different question.
    if (early && text.trim() !== early.q) dropEarly();
    useDuskie.setState({ hearing: text });
    watchVoice();
    return;
  }
  const q = text.trim();
  if (!q) dropEarly();
  const { settings, turns, ask, chatId } = useDuskie.getState();
  if (q) {
    // A stale chatId makes sendChat no-op and drops the Thinking pill,
    // leaving a bare idle island (tiny hit rect / lockout).
    if (chatId) clearInFlightChat();
    // Asked with Ask closed: Thinking pill first so the hit rect stays live.
    if (!ask) {
      useDuskie.setState({ hearing: null, voiceQuestion: q });
      watchVoice();
    } else {
      useDuskie.setState({ hearing: null });
    }
    const started = sendChat(q, { speak: settings.voice.speakAnswers, voice: true });
    if (!started && !ask) useDuskie.setState({ voiceQuestion: null });
    const live = useDuskie.getState().chatId;
    if (started && !ask && settings.voice.live && live) liveIds.add(live);
  } else {
    useDuskie.setState({ hearing: null });
    if (byVoice && turns.length === 0 && ask) void api.askClose();
  }
}
