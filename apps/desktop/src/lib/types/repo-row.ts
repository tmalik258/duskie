// Part of types: RepoRow, ReposOverview, LimitState, ServerTool, MailState, MailStatus, GitFile, GitBranch, CommitRow, StashRow, MessageDiff, LearnedLevel, LessonRow, InboxItem, InboxStatus, InstantResults, Learned.

import { Settings } from "./ai-settings";
import type { RepoPr } from "./composio-status";
import type { NotifyLevel } from "./cues";

/** One repo in the Repos list. */
export interface RepoRow {
  name: string;
  path: string;
  slug: string | null;
  branch: string;
  ahead: number;
  behind: number;
  changed: number;
  prs: RepoPr[];
  ci: RepoPr["ci"];
  reviews: number;
}

export interface ReposOverview {
  /** How GitHub is reached: the gh sign-in, Composio, or not at all. */
  via: "gh" | "composio" | "none";
  repos: RepoRow[];
}

/** A provider or connector paused after repeated errors. */
export interface LimitState {
  name: string;
  /** Seconds until it is tried again. */
  pausedSecs: number;
}

/** A tool a direct server offers. Writes stay off until allowed. */
export interface ServerTool {
  name: string;
  description: string;
  writes: boolean;
  allowed: boolean;
}

/** Where the Gmail connection stands. Never holds message content. */
export type MailState = "disconnected" | "connected" | "offline" | "auth_expired";

export interface MailStatus {
  state: MailState;
  /** False when this build has no Google sign-in set up. */
  configured: boolean;
  /** Seconds since the epoch of the last good check. */
  lastOk: number | null;
  error: string | null;
  /** Which account is connected. */
  provider: "gmail" | "imap" | "composio" | null;
}

/** One changed file in the Git dock. */
export interface GitFile {
  path: string;
  /** M changed, A added, D deleted, R renamed, ? new, U conflict. */
  kind: string;
  staged: boolean;
  unstaged: boolean;
}

/** One local branch in the Git dock's Branches tab. */
export interface GitBranch {
  name: string;
  current: boolean;
  ahead: number;
  behind: number;
  /** Tracks a remote branch; without one, Push publishes it. */
  upstream: boolean;
}

/** One commit in the Git dock's History tab. */
export interface CommitRow {
  hash: string;
  subject: string;
  author: string;
  /** Relative time, as git words it. */
  when: string;
}

/** One stash in the Git dock's Stashes tab. */
export interface StashRow {
  /** stash@{0} and so on. */
  name: string;
  message: string;
  when: string;
}

/** The capped diff a model reads to write a commit message. */
export interface MessageDiff {
  text: string;
  /** Files the text covers, and how many changed in all. */
  covered: number;
  total: number;
}

/** One learned sender or source, as Settings lists it. */
/** A level picked for a sender or source in Settings (attention::Lean). */
export type LearnedLevel = "more" | "usual" | "less" | "silent";

export interface LessonRow {
  key: string;
  /** Points added to or taken from the score; negative means less. */
  shift: number;
  updated: number;
}

/** One notification Duskie read, and where it put it. */
export interface InboxItem {
  id: number;
  app: string;
  title: string;
  body: string;
  ts: string;
  level: NotifyLevel;
  why: string;
  code?: string | null;
  /** Mirrored from the phone (Phone Link). */
  phone?: boolean;
  /** Other apps that brought the same thing. */
  also?: string[];
}

export interface InboxStatus {
  /** Reading works (Windows only). */
  readable: boolean;
  error?: string | null;
  items: InboxItem[];
  /** Apps seen so far, newest first, with Duskie's level for each. */
  apps: { app: string; level: NotifyLevel | null; count: number }[];
}

/** Ask's instant results: apps and files named like what is typed, no AI. */
export interface InstantResults {
  apps: { name: string; id: string; minutes: number; browser?: string | null }[];
  files: { name: string; path: string; folder: boolean; place: string }[];
  /** "18% of 2450" worked out, when the text is math. */
  calc?: string | null;
}

/** Something Duskie learned, for Settings > Memory. */
export interface Learned {
  kind: "choice" | "quiet" | "routine";
  key: string;
  label: string;
  text: string;
  why: string;
}
