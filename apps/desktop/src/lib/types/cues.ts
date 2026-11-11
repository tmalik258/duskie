// Part of types: CUES, Cue, Pause, DirectMcpServer, DirectMcp, VoiceSettings, ISLAND_COLORS, IslandColor, ComposioSettings, PlaceRule, AgentAsk, AgentSettings, AttentionProfile, NotifyLevel, NotificationSettings, DirectServer, Trigger, Recipe, AI_PROVIDERS, AiProviderId.

export const CUES = ["yawn", "settle", "chirp", "pop", "open", "ding", "boop"] as const;

export type Cue = (typeof CUES)[number];

export type Pause = { kind: "none" } | { kind: "until"; until: string } | { kind: "indefinite" };

/** One MCP server started as a program on this PC (no shell). */
export interface DirectMcpServer {
  id: string;
  name: string;
  command: string;
  args: string[];
}

export interface DirectMcp {
  servers: DirectMcpServer[];
}

export interface VoiceSettings {
  /** Listen for "Duskie" (with or without "hey"). Off means push to talk only. */
  wakeWord: boolean;
  speakAnswers: boolean;
  /** While you talk: one slim line, or a waveform and larger words. */
  listeningStyle: "compact" | "full";
  /** After a spoken answer, listen for a reply without the wake word. */
  conversation: boolean;
  /** Seconds of silence after an answer before the conversation ends. */
  replyWait?: number;
  /** Read suggestions aloud and take a spoken choice. */
  speakSuggestions: boolean;
  /** Talking over a spoken answer stops it and listens. */
  interrupt: boolean;
  voice: string;
  speed: number;
  /** Extra wake names: "desky, desuki, deskie". */
  fixes?: string;
  /** Which voice model the voice was picked for (3 = Supertonic 3). */
  model?: number;
  /** Start answering at a pause in speech. Off by default. */
  live?: boolean;
  /** Keep Live conversations in Ask history, as text. */
  liveHistory?: boolean;
  /** Only the voice you taught Duskie wakes it. */
  onlyMe?: boolean;
}

export const ISLAND_COLORS = [
  "atelier",
  "solid_black",
  "black_glass",
  "graphite",
  "midnight",
  "smoke",
  "warm_graphite",
] as const;

export type IslandColor = (typeof ISLAND_COLORS)[number];

export interface ComposioSettings {
  enabled: boolean;
  /** Who signed in (their email). */
  account: string;
  userId: string;
  /** Another MCP link; empty means Composio Connect. */
  url: string;
  headers: Record<string, string>;
}

export type PlaceRule = "allow" | "ask" | "never";

/** When an agent step waits for a tap. */
export type AgentAsk = "each" | "outward" | "irreversible";

export interface AgentSettings {
  ask: AgentAsk;
  /** Per app or site ("whatsapp", "mail.google.com"). */
  places: Record<string, PlaceRule>;
}

export type AttentionProfile = "normal" | "calm";

/** How much a notification interrupts. */
export type NotifyLevel = "now" | "soon" | "digest" | "never";

export interface NotificationSettings {
  enabled: boolean;
  /** The user's level per app; missing means Duskie decides. */
  apps: Record<string, NotifyLevel>;
  /** People whose messages always come through right away. */
  vip: string[];
  /** Normal (soft sound for quieter things) or Calm (sound only for Urgent). */
  profile: AttentionProfile;
  /** What Duskie learned from what you act on and ask for less of. */
  lessons: { entries: Record<string, { acted: number; showLess: number; updated: number }> };
  /** An IMAP account (Advanced). The password is in the keychain. */
  imap: { host: string; port: number; user: string };
}

/** An app connected directly over MCP. */
export interface DirectServer {
  id: string;
  app: string;
  kind: "stdio" | "url";
  command: string;
  args: string[];
  /** Names only; values are in the keychain. */
  envNames: string[];
  url: string;
  /** The exact command was confirmed by the user. */
  confirmed: boolean;
  writesAllowed: string[];
}

/** When a recipe runs. */
export type Trigger =
  | { when: "manual" }
  | { when: "time"; time: string; days: string[] }
  | { when: "notification"; app: string; contains: string }
  | { when: "download"; kind: string }
  | { when: "meeting_ended" }
  | { when: "app_opened"; app: string };

/** A saved task: what to do, in the user's words, and when. */
export interface Recipe {
  id: string;
  name: string;
  prompt: string;
  trigger: Trigger;
  /** Start without asking first; sending still waits for a tap. */
  auto: boolean;
  enabled: boolean;
}

export const AI_PROVIDERS = [
  "local",
  "gemini",
  "groq",
  "claude_code",
  "codex",
  "anthropic",
  "openrouter",
  "openai",
  "xai",
] as const;

export type AiProviderId = (typeof AI_PROVIDERS)[number];
