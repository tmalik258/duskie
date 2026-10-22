// Part of types: DEFAULT_SETTINGS, SENSOR_IDS, Clash, MergeState.

import { FAST_CLAUDE_MODEL, FAST_CODEX_MODEL } from "../ai-models";
import type { Settings } from "./ai-settings";

export const DEFAULT_SETTINGS: Settings = {
  muted: false,
  masterVolume: 0.6,
  cueVolumes: {},
  collapseAfterSecs: 6,
  launchAtLogin: true,
  sensors: {},
  pause: { kind: "none" },
  theme: "atelier",
  codeEditor: "auto",
  islandColor: "atelier",
  soundKit: "sidekick",
  paletteHotkey: "Ctrl+Space",
  shortcuts: {
    agents: "Ctrl+Shift+Space",
    talk: "Ctrl+Alt+Space",
    accept: "Ctrl+Alt+Enter",
    dismiss: "Ctrl+Alt+Backspace",
    screen: "Ctrl+Alt+S",
    clipboard: "Ctrl+Alt+V",
    focus: "Ctrl+Alt+F",
    pause: "Ctrl+Alt+P",
    settings: "Ctrl+Alt+Comma",
  },
  codeFolders: [],
  savedProjects: [],
  indexFolders: [],
  endOfDayHour: 18,
  cloneRules: {},
  ai: {
    order: ["local", "gemini", "groq", "claude_code", "codex", "anthropic", "openrouter", "openai", "xai"],
    claudeCode: { enabled: true, path: "", model: FAST_CLAUDE_MODEL },
    codex: { enabled: true, path: "", model: FAST_CODEX_MODEL },
    codingAgent: "auto",
    local: { enabled: true, baseUrl: "http://127.0.0.1:11434/v1", model: "", visionModel: "" },
    anthropic: { enabled: true, model: FAST_CLAUDE_MODEL },
    gemini: { enabled: false, model: "" },
    groq: { enabled: false, model: "" },
    openrouter: { enabled: false, model: "" },
    openai: { enabled: false, model: "" },
    xai: { enabled: false, model: "" },
    semif: {
      enabled: true,
      command: ["semif-score"],
      mode: "direct",
      backend: "llamacpp",
      model: "openbmb/MiniCPM5-2B",
      revision: "main",
      gguf: "",
    },
    decisions: true,
    localOnly: false,
  },
  calendar: { remindMinutes: 5 },
  semanticSearch: { enabled: true, model: "nomic-embed-text" },
  directMcp: { servers: [] },
  onboarded: false,
  welcomeStep: 0,
  checkUpdates: true,
  composio: { enabled: false, account: "", userId: "", url: "", headers: {} },
  directServers: [],
  denyApps: ["1password.exe", "bitwarden.exe", "keepass.exe", "keepassxc.exe"],
  denySites: [],
  routines: true,
  routinesAuto: false,
  hideInFullscreen: true,
  tips: true,
  alive: true,
  crashReports: false,
  notifications: {
    enabled: true,
    apps: {},
    vip: [],
    profile: "normal",
    lessons: { entries: {} },
    imap: { host: "", port: 993, user: "" },
  },
  recipes: [],
  memory: [],
  userName: "",
  people: "",
  projects: "",
  answerStyle: "",
  codes: null,
  assistantName: "Duskie",
  learning: true,
  agent: { ask: "outward", places: {} },
  voice: {
    enabled: true,
    wakeWord: true,
    speakAnswers: true,
    listeningStyle: "compact",
    conversation: true,
    speakSuggestions: true,
    interrupt: true,
    live: false,
    liveHistory: true,
    onlyMe: false,
    voice: "f4",
    speed: 1,
  },
};

export const SENSOR_IDS = [
  { id: "calendar", label: "Calendar", hint: "Reads your calendar through Composio for meeting reminders." },
  { id: "downloads", label: "Downloads", hint: "Notices finished downloads the moment they land." },
  { id: "screenshots", label: "Screenshots", hint: "Notices new screenshots in Pictures\\Screenshots." },
  { id: "ports", label: "Dev servers", hint: "Notices local servers starting, checked every second." },
  { id: "clipboard", label: "Clipboard", hint: "Notices copied text. Secrets are never stored." },
  { id: "window", label: "Active window", hint: "Knows which app is in front; hides the island in fullscreen." },
  {
    id: "claude_code",
    label: "Claude Code",
    hint: "Hears when a Claude Code session finishes or needs you (add the hook under AI).",
  },
  {
    id: "browser",
    label: "Browser",
    hint: "Hears the Duskie extension: long reads, Upwork jobs, too many tabs.",
  },
  { id: "system", label: "Disk and memory", hint: "Warns when a drive is almost full or memory stays high." },
  {
    id: "idle",
    label: "Away detection",
    hint: "Holds suggestions while you are away and shows them when you are back.",
  },
] as const;

/** One file the branch update left clashing. */
export interface Clash {
  file: string;
  spots: number;
  mine: string;
  theirs: string;
}

/** An update of a feature branch from main, stopped on conflicts. */
export interface MergeState {
  branch: string;
  main: string;
  stashed: boolean;
  files: Clash[];
}
