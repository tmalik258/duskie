// Part of mock: mockInstallUpdate, CUE_BY_STATE, setServers, later, go, cloudKeys, saveSettings.

import type { CloudId, Cue, MascotState, Settings, UpdateProgress } from "../types";
import { call, emit, epoch, mascot, mockUpdateProgress, previewFlag, settings } from "./handler";

export async function mockInstallUpdate(): Promise<string> {
  if (mockUpdateProgress.v && mockUpdateProgress.v.phase !== "failed") return "An update is already in progress";
  const report = (phase: UpdateProgress["phase"], done = 0, error: string | null = null) => {
    mockUpdateProgress.v = { phase, done, total: phase === "preparing" ? null : 100 * 1_048_576, error };
    emit("update://progress", mockUpdateProgress.v);
  };
  const delay = () => new Promise((resolve) => setTimeout(resolve, 600));
  report("preparing");
  await delay();
  for (let i = 0; i <= 4; i++) {
    report("downloading", i * 25 * 1_048_576);
    await delay();
  }
  if (previewFlag("updateerror")) {
    report("failed", 100 * 1_048_576, "The download did not match its checksum; nothing was installed");
    throw new Error(mockUpdateProgress.v?.error ?? "Update failed");
  }
  report("verifying", 100 * 1_048_576);
  await delay();
  report("opening", 100 * 1_048_576);
  return "Installing Duskie_0.2.0_x64-setup.exe";
}

const CUE_BY_STATE: Partial<Record<MascotState, Cue>> = {
  idle: "settle",
  sleeping: "yawn",
  noticing: "chirp",
  suggesting: "pop",
  listening: "open",
  success: "ding",
  error: "boop",
};

export function setServers(directServers: Settings["directServers"]) {
  settings.v = { ...settings.v, directServers };
  emit("settings://changed", settings.v);
}

export function later(ms: number, fn: () => void) {
  const at = epoch.v;
  setTimeout(() => {
    if (epoch.v === at) fn();
  }, ms);
}

export function go(state: MascotState) {
  const previous = mascot.v;
  mascot.v = state;
  epoch.v += 1;
  emit("mascot://state", { previous, state, cue: CUE_BY_STATE[state] ?? null });
  if (state === "success") later(4000, () => go("idle"));
  if (state === "error") later(4000, () => go("idle"));
}

export const cloudKeys: Record<CloudId, boolean> = {
  gemini: previewFlag("gemini"),
  groq: false,
  openrouter: false,
  openai: false,
  xai: false,
};

export function saveSettings(next: Settings): Settings {
  if (settings.v.codeFolders.some((p) => !next.codeFolders.includes(p))) {
    next = { ...next, savedProjects: next.savedProjects.filter((p) => next.codeFolders.includes(p)) };
  }
  localStorage.setItem(
    "sidekick.mock.savedFolders",
    JSON.stringify({ codeFolders: next.codeFolders, savedProjects: next.savedProjects }),
  );
  settings.v = next;
  emit("settings://changed", settings.v);
  emit("voice://state", call("voice_status"));
  return settings.v;
}
