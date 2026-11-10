// Mock app, settings, sensors and island commands.

import type { CloudId, Settings } from "../types";
import { activitySnapshot, mascot, previewFlag, settings } from "./handler";
import { cloudKeys, go, saveSettings } from "./mock-install-update";

export const appCommands: Record<string, (args: Record<string, unknown>) => unknown> = {
  app_info: () => ({ version: "0.1.0 (browser mock)", dbPath: "-", settingsPath: "-", eventCount: 0 }),
  system_look: () => ({ transparency: !previewFlag("solid"), batterySaver: previewFlag("saver") }),
  cloud_keys: () => ({ ...cloudKeys }),
  cloud_key_set: (a) => {
    const id = a.id as CloudId;
    if (!String(a.key).trim()) throw new Error("Paste the key first.");
    cloudKeys[id] = true;
    return saveSettings({ ...settings.v, ai: { ...settings.v.ai, [id]: { ...settings.v.ai[id], enabled: true } } });
  },
  cloud_key_clear: (a) => {
    const id = a.id as CloudId;
    cloudKeys[id] = false;
    return saveSettings({ ...settings.v, ai: { ...settings.v.ai, [id]: { ...settings.v.ai[id], enabled: false } } });
  },
  openrouter_models: () => [
    {
      id: "openrouter/auto",
      name: "Auto (best for each question)",
      free: false,
      input: 0,
      output: 0,
      context: 2000000,
      tools: true,
    },
    {
      id: "meta-llama/llama-3.3-70b-instruct:free",
      name: "Meta: Llama 3.3 70B Instruct (free)",
      free: true,
      input: 0,
      output: 0,
      context: 131072,
      tools: true,
    },
    {
      id: "qwen/qwen3-coder:free",
      name: "Qwen: Qwen3 Coder (free)",
      free: true,
      input: 0,
      output: 0,
      context: 262144,
      tools: true,
    },
    {
      id: "anthropic/claude-sonnet-4.5",
      name: "Anthropic: Claude Sonnet 4.5",
      free: false,
      input: 3,
      output: 15,
      context: 1000000,
      tools: true,
    },
    {
      id: "openai/gpt-5-mini",
      name: "OpenAI: GPT-5 Mini",
      free: false,
      input: 0.25,
      output: 2,
      context: 400000,
      tools: true,
    },
    {
      id: "deepseek/deepseek-chat-v3.1",
      name: "DeepSeek: V3.1",
      free: false,
      input: 0.2,
      output: 0.8,
      context: 163840,
      tools: true,
    },
  ],
  report_save: () => "C:\\Users\\you\\Downloads\\Duskie report 2026-10-08 0930.txt",
  diagnostics: () => "Duskie 0.1.0 (browser mock)\nWindows 11 Pro 24H2\nModels in order: local, claude_code",
  crash_pending: () => (previewFlag("crash") ? "2026-10-07T09:12:00Z panicked at src/voice.rs:120:9" : null),
  crash_dismiss: () => undefined,
  settings_get: () => settings.v,
  settings_set: (a) => saveSettings(a.settings as Settings),
  sensors_pause: (a) => {
    const minutes = a.minutes as number | null;
    go("sleeping");
    return saveSettings({
      ...settings.v,
      pause:
        minutes == null
          ? { kind: "indefinite" }
          : { kind: "until", until: new Date(Date.now() + minutes * 60_000).toISOString() },
    });
  },
  sensors_resume: () => {
    go("idle");
    return saveSettings({ ...settings.v, pause: { kind: "none" } });
  },
  mascot_get: () => mascot.v,
  island_set_hit_rect: () => undefined,
  island_ready: () => undefined,
  net_status: () => !previewFlag("offline"),
  update_status: () =>
    previewFlag("update")
      ? {
          version: "0.2.0",
          current: "0.1.0",
          url: "https://github.com/tmalik258/duskie/releases",
          summary: "Faster wash, Git review and activities",
        }
      : null,
  activity_open_start: () => undefined,
  activity_open_finish: () => undefined,
  activity_snapshot: activitySnapshot,
};
