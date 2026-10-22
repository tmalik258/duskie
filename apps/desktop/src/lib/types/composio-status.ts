// Part of types: ComposioStatus, BrowserStatus, ExtensionGuide, Folder, Found, SetupFound, SetupPlan, LocalModels, LaterItem, ChatSummary, SHORTCUT_ACTIONS, RoutineItem, AgentMode, AgentStarted, FileChange, CursorChat, RepoPr.

import type { ComposioApp, SetupItem } from "./action-result";

export interface ComposioStatus {
  signedIn: boolean;
  account: string;
  apps: ComposioApp[];
  error: string | null;
}

export interface BrowserStatus {
  id: string;
  name: string;
  connected: boolean;
}

export interface ExtensionGuide {
  copied: string;
  /** The extensions page, to paste into the address bar. */
  page: string;
  steps: string[];
}

export interface Folder {
  path: string;
  label: string;
  repos: number;
}

export interface Found {
  codeFolders: Folder[];
  searchFolders: Folder[];
  chatModels: string[];
  embedModels: string[];
  claudeInstalled: boolean;
  claudeHooks: boolean;
  claudeMcp: boolean;
  composioSignedIn: boolean;
  composioInClaude: boolean;
  browsers: string[];
  installable: SetupItem[];
}

/** Older names used by the welcome and setup guides. */
export type SetupFound = Found;

export interface SetupPlan {
  codeFolders: string[];
  searchFolders: string[];
  chatModel: string | null;
  claudeHooks: boolean;
  claudeMcp: boolean;
  install: string[];
  voice: boolean;
  launchAtLogin: boolean;
}

export interface LocalModels {
  reachable: boolean;
  chat: string[];
  vision: string[];
  embed: string[];
}

export interface LaterItem {
  id: string;
  title: string;
  detail: string;
  minutesAgo: number;
  /** Shown and timed out while you were away, not held back. */
  missed: boolean;
}

export interface ChatSummary {
  id: string;
  title: string;
  updated: string;
  /** At least one answer was a Live answer. */
  live?: boolean;
}

/** Shortcut actions besides Ask, in the order Settings shows them. */
export const SHORTCUT_ACTIONS: { id: string; label: string }[] = [
  { id: "agents", label: "Agents" },
  { id: "git", label: "Git" },
  { id: "talk", label: "Talk" },
  { id: "accept", label: "Accept the suggestion" },
  { id: "dismiss", label: "Stop or Not now" },
  { id: "screen", label: "Ask about the screen" },
  { id: "clipboard", label: "Clipboard history" },
  { id: "focus", label: "Focus on or off" },
  { id: "pause", label: "Pause or resume" },
  { id: "settings", label: "Settings" },
];

/** Something opened early on most mornings (see Settings > Privacy). */
export interface RoutineItem {
  kind: "app" | "site";
  key: string;
  label: string;
  target: string;
  browser: string;
  /** Of the last five matching days. */
  days: number;
}

/** Coding agents on this PC, and which one gets handoffs. */
/** How much an agent may do without asking. */
export type AgentMode = "plan" | "ask" | "edit" | "debug" | "full" | "try";

export interface AgentStarted {
  id: string;
  agent: string;
  project: string;
  branch: string | null;
  /** Changes can be reviewed and undone (the project uses git). */
  reviewable: boolean;
  /** Try mode: the copy's branch. The project folder is untouched. */
  trial?: string | null;
}

export interface FileChange {
  path: string;
  status: "added" | "deleted" | "modified";
  added: number;
  removed: number;
  hunks: { header: string; lines: string[] }[];
}

/** A chat started in Cursor's own window, watched from Agents. */
export interface CursorChat {
  id: string;
  title: string;
  path: string | null;
  project: string;
  updatedAt: number;
  status: "working" | "idle";
  lastReply: string;
}

/** One open pull request in the Repos list. */
export interface RepoPr {
  number: number;
  title: string;
  url: string;
  branch: string;
  mine: boolean;
  ci: "pass" | "fail" | "pending" | "none";
  /** The first failing check and its link. */
  failing: [string, string] | null;
  reviewRequested: boolean;
}
