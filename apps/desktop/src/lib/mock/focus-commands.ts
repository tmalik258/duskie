// Mock voice enrollment, learned, focus and freeze commands.

import { agentCommands } from "./agent-commands";
import { appCommands } from "./app-commands";
import { askCommands } from "./ask-commands";
import { connectCommands } from "./connect-commands";
import { editorCommands } from "./editor-commands";
import { gitCommands } from "./git-commands";
import { type Commands, emit, previewFlag, registry } from "./handler";
import { libraryCommands } from "./library-commands";
import { mailCommands } from "./mail-commands";
import { enroll, GB, mockFocusUntil, speakWelcome } from "./other-apps";
import { repoCommands } from "./repo-commands";
import { serverCommands } from "./server-commands";
import { setupCommands } from "./setup-commands";
import { voiceCommands } from "./voice-commands";

const focusCommands: Record<string, (args: Record<string, unknown>) => unknown> = {
  voice_welcome_step: (a) => speakWelcome(Number(a.step) || 0),
  voice_say: () => undefined,
  voice_read: () => undefined,
  voice_test: () => undefined,
  voice_enroll_state: () => ({ ...enroll }),
  voice_enroll_record: async (a) => {
    await new Promise((r) => setTimeout(r, 600));
    if (a.more) enroll.moreTakes = Math.min(enroll.sentences.length, enroll.moreTakes + 1);
    else if (a.sentence == null) enroll.nameTakes = Math.min(enroll.namesNeeded, enroll.nameTakes + 1);
    else enroll.sentenceTakes = Math.min(enroll.sentences.length, enroll.sentenceTakes + 1);
    return { ...enroll };
  },
  voice_enroll_finish: async (a) => {
    await new Promise((r) => setTimeout(r, 900));
    if (a?.more) {
      enroll.samples = Math.min(12, enroll.samples + enroll.moreTakes);
      enroll.moreTakes = 0;
    } else {
      Object.assign(enroll, { taught: true, taughtFor: "Duskie", nameTakes: 0, sentenceTakes: 0, samples: 3 });
    }
    return { ...enroll };
  },
  voice_enroll_cancel: () => {
    Object.assign(enroll, { nameTakes: 0, sentenceTakes: 0, moreTakes: 0 });
    return { ...enroll };
  },
  voice_enroll_reset: () => {
    Object.assign(enroll, { taught: false, taughtFor: null, nameTakes: 0, sentenceTakes: 0, samples: 0, moreTakes: 0 });
    return { ...enroll };
  },
  search: (a) => [
    {
      source: "file",
      reference: "C:/Users/you/notes/acme.md",
      title: "acme.md",
      snippet: `Invoice for [${a.query}] Corp, due Friday ... rate 45 USD per hour`,
      ts: "2026-10-01T09:00:00Z",
    },
    {
      source: "chat",
      reference: "c1",
      title: "How do I free port 3000",
      snippet: `Use netstat -ano to find the [${a.query}] process`,
      ts: "2026-10-01T10:00:00Z",
    },
  ],
  search_reindex: () => undefined,
  open_reference: () => undefined,
  time_today: () => [
    { app: "Visual Studio Code", project: "sidekick", secs: 9420 },
    { app: "Google Chrome", project: "", secs: 4310 },
    { app: "Windows Terminal", project: "", secs: 2200 },
    { app: "Visual Studio Code", project: "falconxoft-api", secs: 1500 },
    { app: "Slack", project: "", secs: 640 },
  ],
  browser_info: () => ({ token: "browser-preview-pairing-code", port: 47822 }),
  action_undo: () => "Moved photo.webp to the Recycle Bin",
  disk_groups: () =>
    [
      {
        id: "build",
        label: "Build folders",
        what: "node_modules, target and .next in your projects. The next install or build makes them again.",
        bytes: 18.4 * GB,
        partial: false,
        items: [
          { path: "C:\\Users\\you\\code\\sidekick\\target", bytes: 11.2 * GB },
          { path: "C:\\Users\\you\\code\\shop\\node_modules", bytes: 4.1 * GB },
          { path: "C:\\Users\\you\\code\\blog\\node_modules", bytes: 3.1 * GB },
        ],
        clearable: true,
      },
      {
        id: "games",
        label: "Games",
        what: "Steam and Epic libraries. Uninstall a game from its launcher.",
        bytes: 96 * GB,
        partial: false,
        items: [{ path: "D:\\SteamLibrary\\steamapps\\common\\Cyberpunk 2077", bytes: 70 * GB }],
        clearable: false,
      },
      {
        id: "installers",
        label: "Old installers",
        what: "Setup files in Downloads, already installed or not needed.",
        bytes: 2.3 * GB,
        partial: false,
        items: [{ path: "C:\\Users\\you\\Downloads\\Docker Desktop Installer.exe", bytes: 0.6 * GB }],
        clearable: true,
      },
    ].sort((a, b) => b.bytes - a.bytes),
  disk_clean: () => "Moved 2 items to the Recycle Bin, 7.2 GB freed",
  user_guess_name: () => "Taimoor",
  focus_start: (args) => {
    const minutes = Number((args as { minutes?: number } | undefined)?.minutes ?? 25);
    mockFocusUntil.v = Date.now() + minutes * 60_000;
    emit("island://focus", { until: mockFocusUntil.v, held: 0 });
    return `Focusing for ${minutes} minutes`;
  },
  focus_stop: () => {
    mockFocusUntil.v = null;
    emit("island://focus", { until: null, held: [], ended: true });
    return "Focus done. Nothing came in.";
  },
  focus_status: () => ({ until: mockFocusUntil.v, held: 0 }),
  suggestion_rates: () => [
    { skill: "files.screenshot", taken: 12, dismissed: 3 },
    { skill: "dev.port-in-use", taken: 2, dismissed: 7 },
  ],
  agent_usual: () => null,
};

const freezeCommands: Record<string, (args: Record<string, unknown>) => unknown> = {
  learned_list: () => [
    {
      kind: "choice",
      key: "url:localhost",
      label: "Chrome, private",
      text: "For links from localhost, you pick Chrome, private",
      why: "9 times",
    },
    {
      kind: "routine",
      key: "slack",
      label: "app",
      text: "You open Slack as part of your day",
      why: "On 5 of the last days",
    },
  ],
  learned_forget: () => undefined,
  learned_forget_all: () => undefined,
  freeze_report: () => [],
  freeze_summary: () => ({ commands: 0, stalls: 0, worstMs: 0 }),
  ai_status: () =>
    previewFlag("nomodel")
      ? []
      : [
          { id: "claude_code", available: true, local: false, configured: true },
          { id: "codex", available: true, local: false, configured: true },
          { id: "anthropic", available: false, local: false, configured: false },
          { id: "local", available: true, local: true, configured: true },
          { id: "semif", available: false, local: true, configured: false },
        ],
};

export const commands: Commands = Object.assign(registry, {
  ...appCommands,
  ...editorCommands,
  ...libraryCommands,
  ...repoCommands,
  ...gitCommands,
  ...serverCommands,
  ...mailCommands,
  ...agentCommands,
  ...askCommands,
  ...setupCommands,
  ...connectCommands,
  ...voiceCommands,
  ...focusCommands,
  ...freezeCommands,
});
