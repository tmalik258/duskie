// Mock voice, chats, projects and backup commands.

import { emit, previewFlag, settings } from "./handler";
import { later, saveSettings } from "./mock-install-update";
import { chats, connected, soon, speechTimers, welcome } from "./other-apps";

export const voiceCommands: Record<string, (args: Record<string, unknown>) => unknown> = {
  chats_list: () =>
    [...chats.entries()]
      .map(([id, c]) => ({ id, title: c.title, updated: c.updated }))
      .sort((a, b) => b.updated.localeCompare(a.updated)),
  chat_get: (a) => chats.get(a.id as string)?.turns ?? [],
  chat_save: (a) => {
    chats.set(a.id as string, {
      title: a.title as string,
      updated: new Date().toISOString(),
      turns: a.turns as unknown[],
    });
  },
  chat_delete: (a) => {
    chats.delete(a.id as string);
  },
  ai_handoff: () => "C:/Users/you/AppData/Local/Duskie/ai/handoff",
  backup_export: () => "C:/Users/you/Documents/Duskie backup.json",
  backup_import: () => "Restored settings and 2 skills",
  project_pick_folder: () => {
    if (previewFlag("foldercancel")) return null;
    if (previewFlag("folderfail")) throw new Error("Could not save chosen folder");
    const path = "C:\\Users\\you\\Documents\\Other project";
    saveSettings({
      ...settings.v,
      codeFolders: [...new Set([...settings.v.codeFolders, path])],
      savedProjects: [...new Set([...settings.v.savedProjects, path])],
    });
    return path;
  },
  projects_list: () => [
    ...settings.v.savedProjects.map((path) => ({ name: path.split(/[\\/]/).at(-1) ?? path, path })),
    ...(previewFlag("noprojects")
      ? []
      : [
          { name: "sidekick", path: "C:/Users/you/code/sidekick" },
          { name: "falconxoft-api", path: "C:/Users/you/code/falconxoft-api" },
        ]),
  ],
  editors_list: () => ({
    editors: [
      { id: "cursor", name: "Cursor", minutes: 840 },
      { id: "antigravity", name: "Antigravity", minutes: 180 },
      { id: "vscode", name: "VS Code", minutes: 40 },
      { id: "pycharm", name: "PyCharm", minutes: 0 },
    ],
    current: "Cursor",
  }),
  instant_find: (a) => {
    const q = String(a.query ?? "").toLowerCase();
    const apps = [
      { name: "Cursor", id: "cursor", minutes: 840 },
      { name: "Google Chrome", id: "chrome", minutes: 400, browser: "chrome" },
      { name: "Slack", id: "slack", minutes: 120 },
      { name: "Spotify", id: "spotify", minutes: 0 },
    ].filter((x) => x.name.toLowerCase().includes(q.split(" ")[0] ?? ""));
    const files = [
      { name: "cursor-rules.md", path: "C:/Users/you/Documents/cursor-rules.md", folder: false, place: "Documents" },
      { name: "invoice-oct.pdf", path: "C:/Users/you/Downloads/invoice-oct.pdf", folder: false, place: "Downloads" },
    ].filter((x) => x.name.includes(q.split(" ")[0] ?? ""));
    return { apps, files };
  },
  app_launch: () => undefined,
  windows_settings_open: () => undefined,
  pc_switch: (a) => `${String(a?.name)} ${a?.on ? "on" : "off"}`,
  file_open: (a) => {
    const how = a.how as string | null | undefined;
    const path = String(a.path ?? "");
    if (how === "editor" || how === "reveal" || how === "default") return { opened: true };
    // No default for source-like names in the browser mock.
    if (/\.(tsx?|jsx?|rs)$/i.test(path)) return { opened: false };
    return { opened: true };
  },
  project_launch: () => "Opened sidekick in VS Code and a terminal",
  search_status: () => ({ items: 1240, embedded: 1240, embedError: null }),
  calendar_today: () => ({
    meetings: previewFlag("meeting")
      ? [soon()]
      : connected.has("googlecalendar")
        ? [
            { title: "Standup", start: "10:00", end: "10:15", joinUrl: "https://meet.google.com/abc-defg-hij" },
            { title: "Design review", start: "15:00", end: "15:45", joinUrl: null },
          ]
        : [],
    error: null,
    sources: connected.has("googlecalendar") ? ["Google Calendar"] : [],
  }),
  voice_download: () => {
    let done = 0;
    const total = 203_669_641;
    const tick = () => {
      done = Math.min(total, done + 30_000_000);
      emit("voice://download", { label: "Supertonic voice", done, total, finished: done >= total, error: null });
      if (done < total) later(300, tick);
    };
    tick();
  },
  voice_cancel_download: () => undefined,
  voice_typing: () => undefined,
  voice_listen: () => {
    const words = ["What", "What time", "What time is it", "What time is it in London?"];
    for (const [i, w] of words.entries()) {
      later(400 * (i + 1), () => emit("voice://heard", { text: w, final: false, byVoice: false }));
    }
    later(2200, () => emit("voice://heard", { text: words[3], final: true, byVoice: false }));
  },
  voice_stop: () => {
    for (const t of speechTimers.v) clearTimeout(t);
    speechTimers.v = [];
  },
  voice_welcome: () => welcome.v,
};
