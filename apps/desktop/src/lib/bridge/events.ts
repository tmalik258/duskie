import type {
  ActionResult,
  ActivitySnapshot,
  AskOpen,
  FileChange,
  Settings,
  Suggestion,
  Timing,
  Transition,
  UpdateInfo,
  UpdateProgress,
  VoiceDownload,
  VoiceHeard,
  VoiceStatus,
  WelcomeSpeech,
} from "../types";

export const EVENTS = {
  activityChanged: "activity://changed",
  mascotState: "mascot://state",
  suggestionNew: "suggestion://new",
  suggestionClear: "suggestion://clear",
  suggestionHeld: "suggestion://held",
  islandHover: "island://hover",
  islandCursor: "island://cursor",
  islandVisible: "island://visible",
  islandFullscreen: "island://fullscreen",
  islandShift: "island://shift",
  inboxChanged: "inbox://changed",
  aiDelta: "ai://delta",
  aiDone: "ai://done",
  aiTool: "ai://tool",
  aiAck: "ai://ack",
  connectorsDuplicate: "connectors://duplicate",
  libraryFound: "library://found",
  termData: "term://data",
  aiProposal: "ai://proposal",
  askOpen: "ask://open",
  askClose: "ask://close",
  actionResult: "action://result",
  settingsChanged: "settings://changed",
  voiceState: "voice://state",
  voiceHeard: "voice://heard",
  voiceSpeaking: "voice://speaking",
  voiceSaying: "voice://saying",
  agentEvent: "agent://event",
  voiceDownload: "voice://download",
  suggestionLater: "suggestion://later",
  composioChanged: "composio://changed",
  browsersChanged: "browsers://changed",
  guideKey: "guide://key",
  voiceWelcome: "voice://welcome",
  netStatus: "net://status",
  updateAvailable: "update://available",
  updateProgress: "update://progress",
  timing: "timing://recorded",
  islandDone: "island://done",
  islandFocus: "island://focus",
  reviewFile: "review://file",
  reviewDone: "review://done",
} as const;

export interface EventPayloads {
  [EVENTS.activityChanged]: ActivitySnapshot;
  [EVENTS.mascotState]: Transition;
  [EVENTS.islandDone]: { id: string; text: string };
  [EVENTS.islandFocus]: { until: number | null; held: number | unknown[]; ended?: boolean };
  [EVENTS.suggestionNew]: Suggestion;
  [EVENTS.suggestionClear]: string;
  [EVENTS.suggestionHeld]: boolean;
  [EVENTS.islandHover]: boolean;
  [EVENTS.islandCursor]: { x: number; y: number };
  [EVENTS.islandVisible]: boolean;
  [EVENTS.islandFullscreen]: boolean;
  [EVENTS.islandShift]: boolean;
  [EVENTS.netStatus]: boolean;
  [EVENTS.updateAvailable]: UpdateInfo;
  [EVENTS.updateProgress]: UpdateProgress;
  [EVENTS.inboxChanged]: null;
  [EVENTS.aiDelta]: { id: string; text: string };
  [EVENTS.aiDone]: {
    id: string;
    provider: string | null;
    error: string | null;
    handoff: string | null;
    /** US dollars, only for Anthropic API answers. */
    cost?: number | null;
  };
  [EVENTS.aiAck]: { id: string; label: string };
  [EVENTS.aiTool]: { id: string; name: string; label?: string; source?: string | null };
  [EVENTS.connectorsDuplicate]: { app: string; used: string; unused: string[] };
  [EVENTS.libraryFound]: { names: string[] };
  [EVENTS.termData]: { id: number; data: string | null; done: boolean };
  [EVENTS.aiProposal]: { chatId: string; id: string; label: string; step?: boolean; undoable?: boolean };
  [EVENTS.askOpen]: AskOpen;
  [EVENTS.askClose]: { reason: "close" | "defer"; panelGen?: number };
  [EVENTS.actionResult]: ActionResult;
  [EVENTS.settingsChanged]: Settings;
  [EVENTS.voiceState]: VoiceStatus;
  [EVENTS.voiceHeard]: VoiceHeard;
  [EVENTS.voiceSpeaking]: boolean;
  [EVENTS.voiceSaying]: { text: string; startsInMs: number; ms: number };
  [EVENTS.agentEvent]: { session: string; kind: string } & Record<string, unknown>;
  [EVENTS.voiceDownload]: VoiceDownload;
  [EVENTS.suggestionLater]: number;
  [EVENTS.composioChanged]: { ok: boolean; message: string };
  [EVENTS.browsersChanged]: null;
  [EVENTS.guideKey]: number;
  [EVENTS.voiceWelcome]: WelcomeSpeech;
  [EVENTS.timing]: Timing;
  [EVENTS.reviewFile]: { session: string; file: FileChange };
  [EVENTS.reviewDone]: { session: string };
}
