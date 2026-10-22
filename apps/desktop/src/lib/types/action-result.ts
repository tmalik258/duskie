// Part of types: ActionResult, SkillInfo, SkillOrigin, SkillTarget, FoundSkill, LibrarySkill, LinkSkill, LinkPreview, SyncReport, TreeEntry, OpenFile, EditorHit, CapabilityInfo, ActionRecord, canUndo, isPaused, SetupGroup, SetupItem, SetupStatus, ComposioApp.

import type { Pause } from "./cues";

export interface ActionResult {
  ok: boolean;
  message: string;
  path: string | null;
  auto: boolean;
  /** Set when the action created a file that Undo can move to the bin. */
  undoId: number | null;
}

export interface SkillInfo {
  id: string;
  name: string;
  description: string;
  event: string;
  enabled: boolean;
  auto: boolean;
  autoByDefault: boolean;
  /** Quiet after Not now three times, until this time. */
  mutedUntil: string | null;
}

export type SkillOrigin = "claude" | "claude_plugin" | "codex" | "cursor" | "duskie" | "url";

export type SkillTarget = "claude" | "codex" | "cursor" | "local";

/** A skill found on this PC that is not in the library yet. */
export interface FoundSkill {
  name: string;
  description: string;
  origin: SkillOrigin;
  dir: string;
  hash: string;
  files: string[];
  hasScripts: boolean;
}

/** A skill in the library and where it is written. */
export interface LibrarySkill {
  name: string;
  description: string;
  origin: SkillOrigin;
  hash: string;
  hasScripts: boolean;
  targets: Partial<Record<SkillTarget, boolean>>;
  synced: Partial<Record<SkillTarget, string>>;
  url: string | null;
  commit: string | null;
}

/** One skill behind a link, compared with the library. */
export interface LinkSkill {
  name: string;
  description: string;
  files: number;
  bytes: number;
  hasScripts: boolean;
  status: "new" | "changed" | "same";
  /** Files added, changed or removed against the library copy. */
  diff: string[];
}

export interface LinkPreview {
  url: string;
  commit: string;
  skills: LinkSkill[];
}

export interface SyncReport {
  written: string[];
  conflicts: string[];
  backups: string[];
}

/** One file or folder in the editor's project tree. */
export interface TreeEntry {
  path: string;
  dir: boolean;
}

export interface OpenFile {
  text: string;
  /** What was on disk when opened; a save sends it back. */
  stamp: string;
}

export interface EditorHit {
  path: string;
  line: number;
  text: string;
}

export interface CapabilityInfo {
  found: string[];
  skillsDir: string;
  skillErrors: string[];
}

export interface ActionRecord {
  id: number;
  ts: string;
  skillId: string;
  action: string;
  label: string;
  ok: boolean;
  message: string;
  auto: boolean;
  undoPath: string | null;
  undone: boolean;
}

/** Undo is kept for 24 hours. */
export function canUndo(a: ActionRecord, now = Date.now()): boolean {
  return !!a.undoPath && !a.undone && now - Date.parse(a.ts) < 24 * 60 * 60 * 1000;
}

export function isPaused(pause: Pause, now = Date.now()): boolean {
  if (pause.kind === "indefinite") return true;
  if (pause.kind === "until") return Date.parse(pause.until) > now;
  return false;
}

export type SetupGroup = "ai" | "connect" | "tools";

export interface SetupItem {
  id: string;
  group: SetupGroup;
  title: string;
  why: string;
  done: boolean;
  status: string;
  command: string | null;
  runnable: boolean;
  /** Button label for running it: "Install", "Download", "Sign in", "Run". */
  action: string;
  /** "Run" opens the installed app instead of a terminal window. */
  opensApp: boolean;
  /** Opens a terminal and copies the command for the user to paste. */
  opensTerminal: boolean;
  tab: string | null;
  recommended: boolean;
}

export interface SetupStatus {
  items: SetupItem[];
  installAll: string | null;
}

export interface ComposioApp {
  slug: string;
  name: string;
  /** What Duskie uses it for; empty for other apps in the account. */
  why: string;
  connected: boolean;
}
