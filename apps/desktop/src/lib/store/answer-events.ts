// Streaming answers: text, tool steps, proposals and done.

import { api, type EVENTS, type EventPayloads } from "../bridge";
import { captionOf } from "../live";
import { timings } from "../timings";
import { toolStatus } from "../tools";
import { flushText, liveText, pendingText, scheduleText, updateLastTurn } from "./chat-turns";
import { saveChat } from "./done-pill";
import { useDuskie } from "./duskie-state";
import { early } from "./send-chat";
import { LIVE_LINGER_MS, liveAnswer, liveIds } from "./waiting";

export function onAiDelta({ id, text }: EventPayloads[typeof EVENTS.aiDelta], sounds: boolean) {
  // The model took back what it wrote (a tool call written as text).
  if (text === "\u0001clear") {
    pendingText.delete(id);
    updateLastTurn(id, (t) => ({ ...t, content: "" }));
    return;
  }
  // Words arrive faster than the screen paints: one update per frame.
  pendingText.set(id, (pendingText.get(id) ?? "") + text);
  scheduleText();
  timings.firstWord(id);
  // Live: the answer stays a caption in the island; Ask stays closed.
  if (liveAnswer(id)) {
    liveText.set(id, (liveText.get(id) ?? "") + text);
    const caption = captionOf(liveText.get(id) ?? "");
    const prev = useDuskie.getState().live;
    useDuskie.setState({ voiceQuestion: null, live: { caption, tool: prev?.tool ?? null, done: false } });
    return;
  }
  // The first words of a spoken question's answer: open to show it.
  if (sounds && useDuskie.getState().voiceQuestion !== null) {
    useDuskie.setState({ voiceQuestion: null });
    if (!useDuskie.getState().ask) void api.askOpen();
  }
}

/** A first status line before any step runs; real steps replace it. */
export function onAiAck({ id, label }: EventPayloads[typeof EVENTS.aiAck]) {
  if (early?.id === id) return;
  if (liveAnswer(id)) {
    const prev = useDuskie.getState().live;
    useDuskie.setState({ live: { caption: prev?.caption ?? "", tool: label, done: false } });
  }
  updateLastTurn(id, (t) => (t.tool || t.content ? t : { ...t, tool: label }));
}

export function onAiTool({ id, name, label, source }: EventPayloads[typeof EVENTS.aiTool]) {
  if (early?.id === id) {
    early.tools.push({ name, label, source });
    return;
  }
  if (liveAnswer(id)) {
    const prev = useDuskie.getState().live;
    useDuskie.setState({
      live: { caption: prev?.caption ?? "", tool: label || toolStatus(name).replace(/\.\.\.$/, ""), done: false },
    });
  }
  flushText();
  // A line written before a tool call is narration ("I'll check your
  // Downloads"), not the answer: drop it so the answer starts clean.
  updateLastTurn(id, (t) => (t.content && t.content.length < 240 ? { ...t, content: "" } : t));
  // Steps read as what they do ("Searching the web for ..."), in words.
  const step = label || toolStatus(name).replace(/\.\.\.$/, "");
  updateLastTurn(id, (t) => ({
    ...t,
    tool: step,
    steps: [...(t.steps ?? []), step],
    sources: source && !t.sources?.includes(source) ? [...(t.sources ?? []), source] : t.sources,
  }));
}

export function onAiProposal({ chatId, id, label, step, undoable }: EventPayloads[typeof EVENTS.aiProposal]) {
  if (early?.id === chatId) {
    early.proposals.push({ id, label, step, undoable });
    return;
  }
  updateLastTurn(chatId, (t) => ({ ...t, proposals: [...(t.proposals ?? []), { id, label, step, undoable }] }));
}

export function onAiDone({ id, provider, error, handoff, cost }: EventPayloads[typeof EVENTS.aiDone], sounds: boolean) {
  flushText();
  timings.done(id);
  const wasLive = liveAnswer(id);
  if (wasLive) {
    liveIds.delete(id);
    liveText.delete(id);
    const prev = useDuskie.getState().live;
    if (prev) {
      useDuskie.setState({ live: { ...prev, tool: null, done: true } });
      setTimeout(() => {
        if (useDuskie.getState().live?.done) useDuskie.setState({ live: null });
      }, LIVE_LINGER_MS);
    }
  }
  if (useDuskie.getState().voiceQuestion !== null) useDuskie.setState({ voiceQuestion: null });
  updateLastTurn(id, (t) => ({
    ...t,
    provider,
    error,
    handoff,
    cost: cost ?? undefined,
    live: wasLive || undefined,
    tool: null,
    streaming: false,
    tookMs: t.startedAt ? Date.now() - t.startedAt : undefined,
  }));
  if (useDuskie.getState().chatId === id) {
    useDuskie.setState({ chatId: null });
    const keep = !wasLive || useDuskie.getState().settings.voice.liveHistory !== false;
    if (sounds && keep && !useDuskie.getState().chatSkill) saveChat();
    // Ask was closed while the answer came in: bring it back with the answer.
    if (sounds && !wasLive && !useDuskie.getState().ask && useDuskie.getState().turns.length > 0) {
      void api.askOpen();
    }
  }
}
