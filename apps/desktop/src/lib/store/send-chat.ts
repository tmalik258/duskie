// Sending a chat question, and the early answer started while you pause mid-sentence.

import { api } from "../bridge";
import { followUp } from "../follow-up";
import { isThanks } from "../mood";
import { timings } from "../timings";
import { toolStatus } from "../tools";
import type { ChatMessage } from "../types";
import { takeAskFiles } from "./ask-files";
import { autoContext, type ChatAttach, type EarlyChat } from "./ask-types";
import { setMood, useDuskie } from "./duskie-state";
import { runProposal } from "./proposals";

/** "Thanks" in Ask: a little shy, then warm. */
function thanked() {
  setMood("shy", 1400, "cooSoft");
  setTimeout(() => setMood("love", 2400, "mwah"), 1400);
}

/** What `api.aiChat` needs for question `q` in the chat as it is now. */
function chatRequest(q: string, attach?: ChatAttach) {
  const { ask, turns, chatPage, chatSkill, askModel, settings } = useDuskie.getState();
  const history: ChatMessage[] = [
    ...turns.filter((t) => !t.error).map(({ role, content }) => ({ role, content })),
    { role: "user", content: q },
  ];
  const auto = autoContext(q, ask);
  const windowOn = (ask?.attachWindow ?? false) || auto.window;
  // App chip / window-about-app phrases capture the window (PNG), same path as Screen.
  const screenOn = attach?.screen ?? (auto.screen || windowOn);
  return {
    history,
    attach: {
      window: windowOn,
      clipboard: attach?.clipboard ?? ((ask?.attachClip ?? false) || auto.clipboard),
      page: chatPage,
      skill: chatSkill,
      screen: screenOn,
      // Every answer follows the speaker button, typed or spoken.
      speak: attach?.speak ?? settings.voice.speakAnswers,
      voice: attach?.voice ?? false,
      think: attach?.think ?? false,
      prefer: askModel,
      files: [] as string[],
    },
    localOnly: ask?.localOnly ?? false,
  };
}

export let early: EarlyChat | null = null;

export function dropEarly() {
  if (!early) return;
  void api.aiCancel(early.id);
  early = null;
}

export function startEarly(q: string, speak: boolean) {
  if (!q || useDuskie.getState().chatId || early?.q === q) return;
  dropEarly();
  const id = crypto.randomUUID();
  const req = chatRequest(q, { speak, voice: true });
  early = { id, q, tools: [], proposals: [] };
  timings.sent(id);
  void api.aiChat(id, req.history, { ...req.attach, hold: true }, req.localOnly);
}

/** Sends a question; false when it could not start (empty, or one running). */
export function sendChat(prompt: string, attach?: ChatAttach): boolean {
  const { turns, chatId, ask } = useDuskie.getState();
  let q = prompt.trim();
  if (!q || chatId) {
    dropEarly();
    return false;
  }
  // "do it" taps the top offer; "is it fixed now?" asks the last check again.
  const follow = followUp(q, turns);
  if (follow?.kind === "run") {
    dropEarly();
    void runProposal(follow.id);
    return true;
  }
  if (follow?.kind === "send") q = follow.text;
  if (isThanks(q)) thanked();
  const adopted = early?.q === q && (attach?.screen ?? false) === false ? early : null;
  if (!adopted) dropEarly();
  early = null;
  const id = adopted?.id ?? crypto.randomUUID();
  const auto = autoContext(q, ask);
  // Flip chips on when the question clearly wants that context, so the UI
  // matches what goes with the send and follow-ups keep it.
  const nextAsk =
    ask && (auto.window || auto.clipboard)
      ? {
          ...ask,
          attachWindow: ask.attachWindow || auto.window,
          attachClip: ask.attachClip || auto.clipboard,
        }
      : ask;
  const req = chatRequest(q, attach);
  const files = takeAskFiles();
  req.attach.files = files;
  const screen = req.attach.screen;
  useDuskie.setState({
    chatId: id,
    ask: nextAsk,
    turns: [
      ...turns,
      { role: "user", content: [q, ...files.map((f) => `@"${f}"`)].join(" "), screen, localOnly: req.localOnly },
      {
        role: "assistant",
        content: "",
        streaming: true,
        startedAt: Date.now(),
        offline: !useDuskie.getState().online,
        steps: adopted?.tools.map((t) => t.label || toolStatus(t.name).replace(/\.\.\.$/, "")),
        sources: [...new Set(adopted?.tools.flatMap((t) => (t.source ? [t.source] : [])))],
        proposals: adopted?.proposals,
      },
    ],
  });
  if (adopted) {
    void api.aiRelease(id);
    return true;
  }
  timings.sent(id);
  void api.aiChat(id, req.history, req.attach, req.localOnly);
  return true;
}

/** Sends a message in the Ask conversation; answers stream into the last turn. */
/** Asks the last question again after an answer failed. */
/** Asks the question of the last answer again when the internet is back. */
export function askWhenOnline() {
  const { turns } = useDuskie.getState();
  const question = turns.findLast((t) => t.role === "user");
  if (question) useDuskie.setState({ askWhenOnline: question.content });
}

// Back online with a question waiting: open Ask and ask it.
useDuskie.subscribe((s, prev) => {
  if (!prev.online && s.online && s.askWhenOnline) {
    const q = s.askWhenOnline;
    useDuskie.setState({ askWhenOnline: null });
    void api.askOpen().then(() => setTimeout(() => sendChat(q), 400));
  }
});
