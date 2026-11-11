// The island store: its state, mood and how loud the UI is.

import { create } from "zustand";
import type { Expression } from "@/components/creature/expressions";
import type { Mood } from "../mood";
import type { NetNotice } from "../net";
import { playMood } from "../sound/play-mood";
import type { SynthSound } from "../synth";
import {
  type ActionResult,
  DEFAULT_SETTINGS,
  type HitRect,
  type MascotState,
  type MergeState,
  type Settings,
  type Suggestion,
  type Turn,
  type UpdateInfo,
  type UpdateProgress,
  type VoiceStatus,
} from "../types";
import { type AskForm, type AskState, savedModel, type Waiting } from "./ask-types";

export interface DuskieState {
  mascot: MascotState;
  settings: Settings;
  suggestion: Suggestion | null;
  /** A newer release, until it is installed. */
  update: UpdateInfo | null;
  updateProgress: UpdateProgress | null;
  /** A short-lived face on top of the mascot's state (see mood.ts). */
  mood: Mood | null;
  /** The internet is reachable. */
  online: boolean;
  /** When the connection dropped, while offline. */
  offlineSince: number | null;
  /** A question to ask again once the internet is back. */
  askWhenOnline: string | null;
  /** A short note that the connection dropped or came back. */
  netNotice: NetNotice | null;
  /** Cursor is over the island's interactive area (reported by Rust). */
  hovered: boolean;
  /** Shift (hovered) or Shift+Alt (suggestion), Rust polls; webview has no focus. */
  shiftHeld: boolean;
  /** Extra interactive area while a floating menu is open (unioned into the hit rect). */
  overlayHit: HitRect | null;
  /** False while a fullscreen app is in front; the island fades away. */
  visible: boolean;
  /** A fullscreen app is in front on the island's screen. */
  fullscreen: boolean;
  ready: boolean;
  /** Outcome of the last action, shown while the mascot reports it. */
  lastResult: ActionResult | null;
  /** A branch update stopped on conflicts, solved file by file in the island. */
  merge: { path: string; state: MergeState } | null;
  /** The option being carried out, shown while the island works on it. */
  running: string | null;
  /** Ask mode: the island is a panel for commands and chat. */
  ask: AskState | null;
  /** The Ask conversation. It outlives Ask mode closing. */
  turns: Turn[];
  /** The chat request in flight, if any. */
  chatId: string | null;
  /** Web page text the conversation is about; sent with every turn. */
  chatPage: string | null;
  /** The conversation is about writing a new skill. */
  chatSkill: boolean;
  /** The model picked in Ask mode; null lets Duskie choose. */
  askModel: string | null;
  /** Typed Ask draft and last search hits; survives close for the session. */
  askForm: AskForm;
  /** A spoken question asked with Ask closed: the island stays compact
   * ("Thinking...") until the answer starts, then opens to show it. */
  voiceQuestion: string | null;
  /** A short "done" line in the compact island ("Hotspot is on"). */
  donePill: string | null;
  /** Undo for the done pill, when what just happened can be taken back. */
  doneUndo: (() => void) | null;
  /** When Focus mode ends (ms since epoch), or null when not focusing. */
  focusUntil: number | null;
  /** Where the conversation is saved, so it can be picked up later. */
  conversation: string;
  /** Duskie's voice is playing; the mascot talks along. */
  speaking: boolean;
  /** Voice: what is being heard right now, while listening. */
  hearing: string | null;
  /** Live: the spoken answer as a caption in the compact island, and the
   * step it is on ("Checking Gmail"). Ask stays closed. */
  live: { caption: string; tool: string | null; done: boolean } | null;
  voiceStatus: VoiceStatus | null;
  /** Suggestions held while you were busy or in a meeting. */
  later: number;
  /** A setup step finishing outside Duskie (browser, PowerShell). */
  waiting: Waiting | null;
  /** The step that just finished while waited for, shown highlighted. */
  justDone: string | null;
}

export const useDuskie = create<DuskieState>(() => ({
  mascot: "idle",
  settings: DEFAULT_SETTINGS,
  suggestion: null,
  mood: null,
  update: null,
  updateProgress: null,
  online: true,
  askWhenOnline: null,
  offlineSince: null,
  netNotice: null,
  hovered: false,
  shiftHeld: false,
  overlayHit: null,
  visible: true,
  fullscreen: false,
  ready: false,
  lastResult: null,
  merge: null,
  running: null,
  ask: null,
  turns: [],
  chatId: null,
  chatPage: null,
  chatSkill: false,
  askModel: savedModel(),
  askForm: { text: "", hits: null },
  voiceQuestion: null,
  donePill: null,
  doneUndo: null,
  focusUntil: null,
  conversation: crypto.randomUUID(),
  hearing: null,
  live: null,
  speaking: false,
  voiceStatus: null,
  later: 0,
  waiting: null,
  justDone: null,
}));

let moodTimer: ReturnType<typeof setTimeout> | undefined;

/** Shows a mood on the mascot for `ms`, with its sound when given. */
export function setMood(id: Expression, ms: number, sound?: SynthSound) {
  clearTimeout(moodTimer);
  const until = Date.now() + ms;
  useDuskie.setState({ mood: { id, until } });
  moodTimer = setTimeout(() => {
    if (useDuskie.getState().mood?.until === until) useDuskie.setState({ mood: null });
  }, ms);
  if (sound) playMood(sound, uiVolume(), useDuskie.getState().settings.soundKit);
}

/** Volume for interface sounds (chip presses), following the master volume. */
export function uiVolume(): number {
  const { settings } = useDuskie.getState();
  return settings.muted ? 0 : settings.masterVolume * 0.7;
}
