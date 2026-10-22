// Part of types: AskOpen, Timing, SearchHit, AppTime, formatDuration, BrowserInfo, EditorList, Suggestion, UpdateInfo, UpdateProgress, StoredEvent, AppInfo, HitRect.

import { Settings } from "./ai-settings";
import { Agents, type AskContext } from "./voice-heard";

export interface AskOpen {
  context: AskContext;
  prompt: string | null;
  ask: boolean;
  /** Attach the clipboard to the first question. */
  clipboard: boolean;
  /** Text of the web page the question is about. */
  page: string | null;
  /** Which island panel to show. */
  view?: "ask" | "settings" | "welcome";
  /** A tool to start with: "screen" or "clipboard". */
  tool?: "screen" | "clipboard" | null;
  /** When the open was asked for (ms since 1970), for the timings. */
  sentAt?: number;
  /** Which Settings tab to show with view "settings". */
  settingsTab?: string | null;
  /** Opens Agents with a new session in this project. */
  project?: string | null;
  /** Ask panel tab to show. */
  tab?: "ask" | "agents" | null;
  /** Rust open generation; stale opens after a close are ignored. */
  panelGen?: number;
}

/** One measured moment, for the timings overlay. */
export interface Timing {
  name: "open_to_ready" | "enter_to_first_word" | "speech_to_first_word" | "speech_to_first_sound";
  ms: number;
}

export interface SearchHit {
  source: string;
  reference: string;
  title: string;
  snippet: string;
  ts: string;
}

export interface AppTime {
  app: string;
  project: string;
  secs: number;
}

export function formatDuration(secs: number): string {
  const h = Math.floor(secs / 3600);
  const m = Math.round((secs % 3600) / 60);
  return h ? `${h} h ${m} min` : `${m} min`;
}

export interface BrowserInfo {
  token: string;
  port: number;
}

export interface EditorList {
  editors: { id: string; name: string; minutes: number }[];
  /** The editor projects open in now. */
  current: string | null;
}

export interface Suggestion {
  id: string;
  skillId: string;
  title: string;
  detail: string;
  options: string[];
  /** Action id per option (parallel to options), for Opening… feedback. */
  actions: string[];
  /** Which options can become "Always do this". */
  always?: boolean[];
  /** Why this showed, from how often you took this kind before. */
  why?: string;
  /** A small pill that opens into the card on hover or while Alt is held. */
  compact?: boolean;
  /** Shows without a sound. */
  silent?: boolean;
  /** Where it came from, for "From Calendar, 2 min ago". */
  source?: string;
  /** When it was first raised (Unix ms). */
  at?: number;
}

/** A newer Duskie release than the one running. */
export interface UpdateInfo {
  version: string;
  current: string;
  url: string;
  /** First line of the release notes, plain text; may be empty. */
  summary: string;
}

export interface UpdateProgress {
  phase: "preparing" | "downloading" | "verifying" | "opening" | "failed";
  done: number;
  total: number | null;
  error: string | null;
}

export interface StoredEvent {
  id: string;
  ts: string;
  kind: string;
  source: string;
  payload: unknown;
  sensitivity: string;
}

export interface AppInfo {
  version: string;
  dbPath: string;
  settingsPath: string;
  eventCount: number;
}

export interface HitRect {
  x: number;
  y: number;
  width: number;
  height: number;
}
