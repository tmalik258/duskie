// Opening and closing Ask, and finishing a wait once it is done.

import { setTab, startHere } from "../agents";
import { api, type EVENTS, type EventPayloads } from "../bridge";
import { putCached, SETUP_STATUS_CACHE_KEY } from "../cache";
import { playCue } from "../sound";
import { cueVolume } from "../sound/snd-sound";
import { timings } from "../timings";
import type { Waiting } from "./ask-types";
import { newChat, RESUME_MS } from "./chat-turns";
import { setMood, useDuskie } from "./duskie-state";
import { sendChat } from "./send-chat";
import { JUST_DONE_MS, stopListening, stopWaiting } from "./waiting";

/** Settings tab to open once a waited-for step finishes (post-onboarding). */
let resumeSettingsTab: string | null = null;

/** Marks a waited-for step done: speak, show island Done, then reopen welcome or Settings. */
export function finishWaiting(waiting: Waiting, line: string) {
  if (useDuskie.getState().waiting?.id !== waiting.id) return;
  stopWaiting();
  const { settings } = useDuskie.getState();
  playCue("ding", cueVolume(settings, "ding"), settings.soundKit);
  void api.voiceSay(line);

  // Island Done / All set (mascot success), not only the orb celebrate face.
  // Welcome/Settings reopen after this so the card is actually visible.
  const detail = line.replace(/^Done\.\s*/i, "").trim() || `${waiting.label} is connected.`;
  useDuskie.setState({
    justDone: waiting.id,
    mascot: "success",
    lastResult: { ok: true, message: detail, path: null, auto: false, undoId: null },
  });
  setMood("celebrate", JUST_DONE_MS);

  const openPanel = () => {
    if (useDuskie.getState().justDone === waiting.id) {
      useDuskie.setState({ justDone: null });
    }
    if (useDuskie.getState().mascot === "success") {
      useDuskie.setState({ mascot: "idle", lastResult: null });
    }
    if (settings.onboarded) {
      resumeSettingsTab = waiting.resumeTab ?? "home";
      void api.openSettings();
    } else {
      void api.askResumeWelcome();
    }
  };

  // Prime caches while Done shows; do not open the panel until the hold is up.
  const caches = Promise.all([
    api.setupStatus().then((s) => putCached(SETUP_STATUS_CACHE_KEY, s)),
    api.browsersStatus().then((b) => putCached("browsers", b)),
    api.composioStatus().then((s) => {
      if (waiting.id.startsWith("app:")) {
        const slug = waiting.id.slice("app:".length);
        putCached("composio-status", {
          ...s,
          apps: s.apps.map((a) => (a.slug === slug ? { ...a, connected: true } : a)),
        });
      } else {
        putCached("composio-status", s);
      }
    }),
  ]).catch(() => undefined);

  void Promise.all([caches, new Promise<void>((r) => setTimeout(r, JUST_DONE_MS))]).then(openPanel);
}

/** Finish a browser wait the moment pairing is allowed (no 3s poll lag). */
export function onBrowsersChanged() {
  void api
    .setupStatus()
    .then((s) => putCached(SETUP_STATUS_CACHE_KEY, s))
    .catch(() => undefined);

  const waiting = useDuskie.getState().waiting;
  if (waiting?.id !== "browser" || !waiting.target) return;
  const target = waiting.target;
  const name = waiting.label.charAt(0).toUpperCase() + waiting.label.slice(1);
  void api
    .browsersStatus()
    .then((browsers) => {
      putCached("browsers", browsers);
      if (useDuskie.getState().waiting?.id !== waiting.id) return;
      if (browsers.some((b) => b.id === target && b.connected)) {
        finishWaiting(waiting, `Done. ${name} is connected.`);
      }
    })
    .catch(() => undefined);
}

/** This PC only of the chat that was open, for when Ask comes back to it. */
let keptLocalOnly = false;

let askClosedAt = Date.now();

/** Last close generation from Rust; drops late open events. */
let lastPanelCloseGen = 0;

/**
 * Loads initial state and subscribes to core events. Only the island window
 * passes `sounds: true`, so cues never play twice.
 *
 * Listeners are registered before askEnsureWelcome so a cold-start emit is not
 * dropped (welcome lock).
 */
export function onAskOpen(open: EventPayloads[typeof EVENTS.askOpen]) {
  const panelGen = open.panelGen ?? 0;
  if (panelGen > 0 && panelGen <= lastPanelCloseGen) return;
  timings.opened(open.sentAt);
  const seq = (useDuskie.getState().ask?.seq ?? 0) + 1;
  // Back within 10 minutes: the last chat is still there. Later, a new one.
  const { turns, chatId } = useDuskie.getState();
  if (turns.length > 0 && chatId === null && Date.now() - askClosedAt > RESUME_MS) newChat();
  const clip = open.clipboard && !open.context.clipboardSecret;
  if (open.page) {
    newChat();
    useDuskie.setState({ chatPage: open.page });
  }
  const settingsTab = open.settingsTab ?? resumeSettingsTab ?? undefined;
  resumeSettingsTab = null;
  // This PC only belongs to the chat: it stays while the chat goes on.
  // A new chat starts from the setting.
  const state = useDuskie.getState();
  const sameChat = state.turns.length > 0;
  const localOnly = sameChat ? (state.ask?.localOnly ?? keptLocalOnly) : state.settings.ai.localOnly;
  useDuskie.setState({
    ask: {
      view: open.view ?? "ask",
      context: open.context,
      prompt: open.ask || open.project ? "" : (open.prompt ?? ""),
      seq,
      panelGen,
      attachWindow: false,
      attachClip: clip,
      localOnly,
      tool: open.tool ?? null,
      settingsTab,
    },
  });
  if (open.project) startHere(open.project, open.prompt);
  else if (open.tab === "agents" || open.tab === "ask") setTab(open.tab);
  if (open.ask && open.prompt) sendChat(open.prompt, { clipboard: clip });
}

export function onAskClose(payload: EventPayloads[typeof EVENTS.askClose]) {
  const panelGen = payload.panelGen ?? 0;
  const current = useDuskie.getState().ask;
  if (panelGen > 0 && current !== null && current.panelGen > 0 && panelGen < current.panelGen) {
    return;
  }
  if (panelGen > 0) lastPanelCloseGen = panelGen;
  askClosedAt = Date.now();
  keptLocalOnly = useDuskie.getState().ask?.localOnly ?? false;
  if (useDuskie.getState().hearing !== null) stopListening();
  useDuskie.setState({ ask: null });
  // Hide parks welcome; do not fight the park with ensure_welcome.
  if (payload.reason === "defer") return;
  if (!useDuskie.getState().settings.onboarded) {
    void api.askEnsureWelcome();
  }
}

export function onComposioChanged({ ok, message }: EventPayloads[typeof EVENTS.composioChanged]) {
  const waiting = useDuskie.getState().waiting;
  if (!ok || !waiting) return;
  if (waiting.id === "composio") {
    finishWaiting(waiting, message.trim() || "Done. Composio is connected.");
    return;
  }
  if (waiting.id.startsWith("app:")) {
    // Only finish when this app connected (message is e.g. "Gmail connected").
    if (!message.toLowerCase().includes(waiting.label.toLowerCase())) return;
    finishWaiting(waiting, message.trim() || `Done. ${waiting.label} is connected.`);
  }
}
