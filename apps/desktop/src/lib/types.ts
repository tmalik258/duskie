import type { Cue } from "./types/cues";

// Mirrors the Rust types in crates/core and src-tauri. Keep in sync.

export const MASCOT_STATES = [
  "idle",
  "sleeping",
  "noticing",
  "suggesting",
  "listening",
  "working",
  "success",
  "error",
  "focus",
] as const;

export type MascotState = (typeof MASCOT_STATES)[number];

export interface Transition {
  previous: MascotState;
  state: MascotState;
  cue: Cue | null;
}

export * from "./types/action-result";
export * from "./types/activity";
export * from "./types/ai-settings";
export * from "./types/ask-open";
export * from "./types/composio-status";
export * from "./types/cues";
export * from "./types/default-settings";
export * from "./types/repo-row";
export * from "./types/voice-heard";
