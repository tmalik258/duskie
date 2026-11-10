// Part of types: VoiceHeard, VoiceDownload, CloudId, CLOUD_IDS, PROVIDER_LABELS, ProviderStatus, ChatMessage, Proposal, Turn, SuggestionRate, AskContext, AgentInfo, Agents.

export interface VoiceHeard {
  text: string;
  final: boolean;
  /** The words settled for a moment: an answer may start early. */
  pause?: boolean;
  byVoice: boolean;
}

export interface VoiceDownload {
  label: string;
  done: number;
  total: number;
  finished: boolean;
  error: string | null;
}

/** Cloud models reached with an API key kept in Credential Manager. */
export type CloudId = "gemini" | "groq" | "openrouter" | "openai" | "xai";

export const CLOUD_IDS: CloudId[] = ["gemini", "groq", "openrouter", "openai", "xai"];

export const PROVIDER_LABELS: Record<string, string> = {
  claude_code: "Claude Code",
  codex: "Codex",
  anthropic: "Anthropic API",
  local: "Local model",
  gemini: "Gemini",
  groq: "Groq",
  openrouter: "OpenRouter",
  openai: "OpenAI",
  xai: "xAI Grok",
  semif: "SemIf",
};

/** Where Duskie listens for Claude Code hooks (ClaudeCodeSensor::DEFAULT_PORT). */

export interface ProviderStatus {
  id: string;
  available: boolean;
  local: boolean;
  /** Installed / keyed / model chosen, even if not running right now. */
  configured: boolean;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface Proposal {
  id: string;
  label: string;
  /** One step of a task: shown with the others as a plan, run in order. */
  step?: boolean;
  /** Undo can put this back once it has run. */
  undoable?: boolean;
  /** Set once tapped: what happened, and Undo if it can be undone. */
  ran?: { ok: boolean; message: string; undoId: number | null; path: string | null; undone?: boolean };
}

/** One turn of an Ask conversation, as the island shows it. */
export interface Turn extends ChatMessage {
  provider?: string | null;
  /** Where app tools answered from ("direct connection", "Composio"). */
  sources?: string[];
  error?: string | null;
  streaming?: boolean;
  /** A screenshot went with this question. */
  screen?: boolean;
  /** This question was asked with This PC only on; a reopened chat keeps it. */
  localOnly?: boolean;
  /** Why the local model suggests continuing in Claude Code. */
  handoff?: string | null;
  /** The tool the model is using right now. */
  tool?: string | null;
  /** Every tool step taken for this answer, in order (multi-step tasks). */
  steps?: string[];
  /** Actions offered as buttons; each runs on a tap. */
  proposals?: Proposal[];
  /** What the answer cost in US dollars (Anthropic API only). */
  cost?: number;
  /** Answered Live: spoken as it was heard, so Live history can filter it. */
  live?: boolean;
  /** When the question was sent (ms since 1970), and how long the answer took. */
  startedAt?: number;
  tookMs?: number;
  /** How long until the first word showed. */
  firstMs?: number;
  /** Asked while offline: web answers wait for the connection. */
  offline?: boolean;
}

export interface SuggestionRate {
  skill: string;
  taken: number;
  dismissed: number;
}

export interface AskContext {
  app: string | null;
  title: string | null;
  clipboardKind: string | null;
  clipboardPreview: string | null;
  clipboardSecret: boolean;
}

/** One agent in the picker. */
export interface AgentInfo {
  id: string;
  name: string;
  installed: boolean;
  /** null when Duskie cannot tell. */
  signedIn: boolean | null;
  /** Out of plan usage for now. */
  limited: boolean;
  /** The one step that makes it ready. */
  fix: string | null;
  /** Runs on this PC; nothing leaves it. */
  local?: boolean;
}

export interface Agents {
  claudeCode: boolean;
  codex: boolean;
  copilot: boolean;
  cursor: boolean;
  /** The agent that gets handoffs by name, or null when none is installed. */
  handoff: string | null;
  /** Every agent with whether it is ready, for the picker. */
  list?: AgentInfo[];
}
