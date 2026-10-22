// Part of types: AiSettings, THEMES, Theme, Settings, CalendarToday, EnrollState, VoiceStatus, WelcomeSpeech.

import type {
  AgentSettings,
  AiProviderId,
  ComposioSettings,
  DirectMcp,
  DirectServer,
  IslandColor,
  NotificationSettings,
  Pause,
  Recipe,
  VoiceSettings,
} from "./cues";

export interface AiSettings {
  order: AiProviderId[];
  claudeCode: { enabled: boolean; path: string; model: string };
  codex: { enabled: boolean; path: string; model: string };
  /** Who gets handoffs: "auto", "claude_code" or "codex". */
  codingAgent: string;
  local: { enabled: boolean; baseUrl: string; model: string; visionModel: string };
  anthropic: { enabled: boolean; model: string };
  gemini: { enabled: boolean; model: string };
  groq: { enabled: boolean; model: string };
  openrouter: { enabled: boolean; model: string };
  openai: { enabled: boolean; model: string };
  xai: { enabled: boolean; model: string };
  semif: {
    enabled: boolean;
    command: string[];
    mode: string;
    backend: string;
    model: string;
    revision: string;
    gguf: string;
  };
  decisions: boolean;
  /** New Ask chats start with This PC only on. */
  localOnly: boolean;
}

export const THEMES = ["atelier", "pearl", "aurora", "chrome", "peach", "mint", "lilac", "onyx"] as const;

export type Theme = (typeof THEMES)[number];

export interface Settings {
  muted: boolean;
  masterVolume: number;
  cueVolumes: Record<string, number>;
  collapseAfterSecs: number;
  launchAtLogin: boolean;
  sensors: Record<string, boolean>;
  pause: Pause;
  theme: Theme;
  /** An editor id, or "auto" for the one used most this week. */
  codeEditor: string;
  islandColor: IslandColor;
  soundKit: string;
  skills?: Record<string, { enabled?: boolean | null; auto?: boolean | null }>;
  /** Ask shortcut. A leading `-` turns it off without clearing the combo. */
  paletteHotkey: string;
  /** Global shortcuts by action. A leading `-` turns one off without clearing. */
  shortcuts: Record<string, string>;
  codeFolders: string[];
  savedProjects: string[];
  indexFolders: string[];
  endOfDayHour: number;
  /** Where clones go, by owner. */
  cloneRules?: Record<string, string>;
  ai: AiSettings;
  voice: VoiceSettings;
  calendar: { remindMinutes: number };
  semanticSearch: { enabled: boolean; model: string };
  /** MCP servers connected directly (stdio), preferred over Composio. */
  directMcp: DirectMcp;
  onboarded: boolean;
  /** 0-based welcome step; resumed until onboarded is true. */
  welcomeStep: number;
  checkUpdates: boolean;
  composio: ComposioSettings;
  /** Apps connected directly over MCP. */
  directServers: DirectServer[];
  denyApps: string[];
  denySites: string[];
  routines: boolean;
  routinesAuto: boolean;
  /** The mascot idles on its own: glances around, blinks, the odd smile. */
  alive: boolean;
  /** After a crash, offer a report to send (never sent on its own). */
  crashReports: boolean;
  /** Fade the island while a fullscreen app is in front. */
  hideInFullscreen: boolean;
  tips: boolean;
  notifications: NotificationSettings;
  recipes: Recipe[];
  memory: string[];
  userName: string;
  people: string;
  projects: string;
  answerStyle: string;
  codes: boolean | null;
  assistantName: string;
  learning: boolean;
  agent: AgentSettings;
}

export interface CalendarToday {
  meetings: {
    title: string;
    start: string;
    end: string;
    joinUrl: string | null;
    /** The page or file used last time for this meeting, from history. */
    notes?: { title: string; source: string; reference: string } | null;
  }[];
  error: string | null;
  /** Calendars read through Composio, e.g. "Google Calendar". */
  sources: string[];
}

/** Teaching Duskie your voice: takes so far, kept in memory only. */
export interface EnrollState {
  taught: boolean;
  /** The name it was taught with; differs after a rename. */
  taughtFor?: string | null;
  nameTakes: number;
  sentenceTakes: number;
  namesNeeded: number;
  sentences: string[];
  /** Lines for the current "Add samples" round. */
  moreSentences: string[];
  /** Voiceprints kept for the taught voice. */
  samples: number;
  /** Sentences recorded so far in an "Add samples" round. */
  moreTakes: number;
}

export interface VoiceStatus {
  models: { id: string; label: string; size: number; installed: boolean }[];
  missingBytes: number;
  downloading: boolean;
  listening: boolean;
  error: string | null;
  voices: { id: string; label: string }[];
}

/** The first-run welcome line and when each part of it is heard. */
export interface WelcomeSpeech {
  /** The welcome step being spoken, and every step's line. */
  step: number;
  lines: string[];
  script: string;
  /** Sentences as queued: start (Unix ms) and length (ms). */
  pieces: { text: string; startsAt: number; ms: number }[];
  /** When the last word stops sounding, once known. */
  endsAt: number | null;
  /** Nothing will be heard; the welcome paces the words itself. */
  silent: boolean;
  /** Speech is on its way (the model may still be loading). */
  pending: boolean;
}
