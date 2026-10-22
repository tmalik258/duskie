// Waiting on a step finished elsewhere, the Ask form, and live voice answers.

import { api } from "../bridge";
import { type AskForm, MODEL_KEY } from "./ask-types";
import { useDuskie } from "./duskie-state";

export interface WaitOptions {
  resumeTab?: string;
  steps?: string[];
  copies?: { label: string; text: string }[];
  again?: () => void;
  /** Browser id for per-browser extension waiting. */
  target?: string;
  /** When true, skip the initial expanded guide (steps only). */
  minimized?: boolean;
  doneLine?: string;
}

/** Updates the typed Ask draft. Survives panel close. */
export function setAskFormText(text: string) {
  useDuskie.setState((s) => ({ askForm: { ...s.askForm, text } }));
}

/** Updates the last search hit list in Ask. Survives panel close. */
export function setAskHits(hits: AskForm["hits"]) {
  useDuskie.setState((s) => ({ askForm: { ...s.askForm, hits } }));
}

/** Picks the model for Ask mode (null: Duskie chooses), kept for next time. */
export function setAskModel(id: string | null) {
  useDuskie.setState({ askModel: id });
  try {
    if (id) localStorage.setItem(MODEL_KEY, id);
    else localStorage.removeItem(MODEL_KEY);
  } catch {
    // Storage off: the pick lasts until restart.
  }
}

/** Give up waiting after this long. */
export const WAIT_LIMIT_MS = 10 * 60_000;

export const WAIT_POLL_MS = 3000;

/** After Set up, keep the step guide open before shrinking to the pill. */
const GUIDE_HOLD_MS = 5000;

/** How long the island keeps the Done card after a waited step. */
export const JUST_DONE_MS = 3000;

/** Shrinks the guide to the pill, or brings it back. */
export function minimizeWaiting(minimized: boolean) {
  const waiting = useDuskie.getState().waiting;
  if (waiting)
    useDuskie.setState({ waiting: { ...waiting, minimized, background: minimized ? waiting.background : false } });
}

let guideHoldTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * Shrinks to a "Waiting for …" pill while a step is finished elsewhere
 * (browser sign-in, install), then brings Settings or welcome back when done.
 */
export function startWaiting(
  id: string,
  label: string,
  { resumeTab, steps, copies, again, target, minimized = false, doneLine }: WaitOptions = {},
) {
  if (guideHoldTimer) {
    clearTimeout(guideHoldTimer);
    guideHoldTimer = null;
  }
  const since = Date.now();
  const hasSteps = (steps?.length ?? 0) > 0;
  const startMinimized = hasSteps ? minimized : true;
  useDuskie.setState({
    waiting: {
      id,
      label,
      since,
      resumeTab,
      steps,
      copies,
      again,
      target,
      minimized: startMinimized,
      doneLine,
    },
  });
  if (hasSteps && !startMinimized) {
    guideHoldTimer = setTimeout(() => {
      guideHoldTimer = null;
      const waiting = useDuskie.getState().waiting;
      if (waiting?.id === id && waiting.since === since) minimizeWaiting(true);
    }, GUIDE_HOLD_MS);
  }
  // ask_defer_welcome parks welcome, or closes Settings/Ask when already onboarded.
  void api.askDeferWelcome();
}

export function stopWaiting() {
  if (guideHoldTimer) {
    clearTimeout(guideHoldTimer);
    guideHoldTimer = null;
  }
  useDuskie.setState({ waiting: null });
}

/** How long the last caption stays after the answer ends. */
export const LIVE_LINGER_MS = 6000;

/** How long the voice pill may sit unchanged before it is cleared. */
const VOICE_STUCK_MS = { hearing: 30_000, question: 120_000 };

export function stopListening() {
  useDuskie.setState({ hearing: null });
  void api.voiceStop();
}

let voiceTimer: ReturnType<typeof setTimeout> | null = null;

export function watchVoice() {
  if (voiceTimer) clearTimeout(voiceTimer);
  const { hearing, voiceQuestion } = useDuskie.getState();
  const ms = voiceQuestion !== null ? VOICE_STUCK_MS.question : VOICE_STUCK_MS.hearing;
  voiceTimer = setTimeout(() => {
    voiceTimer = null;
    const now = useDuskie.getState();
    if (now.hearing !== null && now.hearing === hearing) stopListening();
    if (now.voiceQuestion !== null && now.voiceQuestion === voiceQuestion) {
      useDuskie.setState({ voiceQuestion: null });
    }
  }, ms);
}

/**
 * A safety net under the voice pill: if what is heard, or the question
 * waiting for an answer, stays the same too long, the pill clears and
 * listening stops, so the island never stays stuck.
 */
/** Chats asked by voice with Live on: answered as captions, Ask closed. */
export const liveIds = new Set<string>();

export function liveAnswer(id: string): boolean {
  return liveIds.has(id) && !useDuskie.getState().ask;
}
