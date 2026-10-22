// Ask state shapes and the saved model choice.

import type { AskContext, SearchHit } from "../types";

export const MODEL_KEY = "sidekick.askModel";

export function savedModel(): string | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage.getItem(MODEL_KEY);
  } catch {
    return null;
  }
}

export type ChatAttach = { clipboard?: boolean; screen?: boolean; speak?: boolean; voice?: boolean; think?: boolean };

export interface AskState {
  /** Ask (commands and chat) or Settings. */
  view: "ask" | "settings" | "welcome";
  context: AskContext;
  /** Text to start the input with. */
  prompt: string;
  /** Bumped on every open, so the panel refocuses. */
  seq: number;
  /** Matches Rust `panelGen` for this open. */
  panelGen: number;
  attachWindow: boolean;
  attachClip: boolean;
  localOnly: boolean;
  /** Settings tab to show, when something asked for a particular one. */
  settingsTab?: string;
  /** A tool a shortcut asked to start with. */
  tool?: "screen" | "clipboard" | null;
}

/**
 * Context a question plainly points at, so you rarely tick the chips: "this
 * error" or "here" means the window in front, "what I copied" the clipboard,
 * "what's on my screen" a screenshot. Secrets on the clipboard are never
 * added this way.
 */
export function autoContext(q: string, ask: AskState | null): { window: boolean; clipboard: boolean; screen: boolean } {
  const text = q.toLowerCase();
  const app = ask?.context.app?.trim().toLowerCase() ?? "";
  const mentionsApp = app.length > 1 && text.includes(app);
  const win =
    Boolean(ask?.context.app) &&
    (/\b(this|here|current(ly)?|in front)\b/.test(text) ||
      /\b(on|in) (the |my |this )?(app|window)\b/.test(text) ||
      /\bwhat (i'?m|i am|you'?re|you are) doing\b/.test(text) ||
      /\bwhat('s| is) (wrong|the issue|broken)\b/.test(text) ||
      /\bhow (do i|to|can i) (fix|resolve|solve|use|do|find|open)\b/.test(text) ||
      /\b(where|which) (is|are|do i|can i)\b/.test(text) ||
      /\bpoint (at|to|out)\b/.test(text) ||
      /\b(first|this|that) control\b/.test(text) ||
      /\b(walk me through|guide me|show me how)\b/.test(text) ||
      mentionsApp);
  const clipboard =
    Boolean(ask?.context.clipboardKind) &&
    !ask?.context.clipboardSecret &&
    /\b(copied|clipboard|pasted|i just copied|this (error|trace|stack ?trace|snippet|link|url))\b/.test(text);
  const screen = /\b(on (my )?screen|what('s| is) on (my |the )?screen|look at (my )?screen|see (my )?screen)\b/.test(
    text,
  );
  return { window: win, clipboard, screen };
}

/**
 * An answer started at a pause in speech, before the question was final.
 * Rust holds it unseen and unsaid (and lets it only look things up) until
 * the question ends the same way; then it is shown at once.
 */
export interface EarlyChat {
  id: string;
  q: string;
  tools: { name: string; label?: string; source?: string | null }[];
  proposals: { id: string; label: string; step?: boolean; undoable?: boolean }[];
}

/** Sticky Ask input + search results for the app session (not localStorage). */
export interface AskForm {
  text: string;
  hits: { query: string; items: SearchHit[]; loading?: boolean } | null;
}

export interface Waiting {
  /** The setup item (e.g. "composio"). */
  id: string;
  /** What the island says, e.g. "Composio". */
  label: string;
  since: number;
  /** Settings tab to reopen when this finishes after onboarding. */
  resumeTab?: string;
  /** What to do meanwhile; stays on the island until done or cancelled. */
  steps?: string[];
  /** Copy buttons for things to paste (an address, a folder path). */
  copies?: { label: string; text: string }[];
  /** Starts the step again (reopens the browser page, reruns the install). */
  again?: () => void;
  /** Shrunk to the pill; hovering brings the guide back unless background. */
  minimized?: boolean;
  /**
   * Wait quietly: compact pill only, hover does not reopen the guide.
   * Still finishes with the usual success when the step is done.
   */
  background?: boolean;
  /** Browser id when waiting on a specific extension (chrome, edge, zen, …). */
  target?: string;
  /** Said when it finishes, instead of "… is installed" or "… is connected". */
  doneLine?: string;
}
