// Mock Composio, held suggestions and Claude setup commands.

import { call, emit, previewFlag, settings } from "./handler";
import { folder } from "./mail-commands";
import { COMPOSIO_APPS } from "./mock-chat";
import { later } from "./mock-install-update";
import { browsersSeen, connected, laterItems, OTHER_APPS, signedInNow } from "./other-apps";

export const connectCommands: Record<string, (args: Record<string, unknown>) => unknown> = {
  setup_run: () => undefined,
  composio_import: () => {
    settings.v = {
      ...settings.v,
      composio: { ...settings.v.composio, enabled: true, url: "https://mcp.composio.dev/example" },
    };
    emit("settings://changed", settings.v);
    return settings.v;
  },
  composio_status: () => {
    const signedIn = Boolean(settings.v.composio.account);
    return {
      signedIn,
      account: settings.v.composio.account,
      apps: [
        ...COMPOSIO_APPS.map(([slug, name, why]) => ({ slug, name, why, connected: signedIn && connected.has(slug) })),
        ...(signedIn ? OTHER_APPS.map(([slug, name]) => ({ slug, name, why: "", connected: true })) : []),
      ],
      error: null,
    };
  },
  composio_sign_in: () => {
    later(2500, () => signedInNow("Composio Connect"));
    return "Composio opened in your browser";
  },
  composio_use_key: () => {
    later(300, () => signedInNow("Composio key"));
    return "Composio connected";
  },
  composio_sign_out: () => {
    settings.v = { ...settings.v, composio: { ...settings.v.composio, enabled: false, account: "", userId: "" } };
    emit("settings://changed", settings.v);
    emit("composio://changed", { ok: true, message: "Signed out" });
  },
  composio_connect: (a) => {
    later(2000, () => {
      connected.add(a.slug as string);
      emit("composio://changed", { ok: true, message: "Connected" });
    });
  },
  setup_detect: () => ({
    codeFolders: [
      folder("C:\\Users\\you\\code", "code", 12),
      folder("\\\\wsl.localhost\\Ubuntu-22.04\\home\\you\\projects", "projects (WSL Ubuntu-22.04)", 5),
    ],
    searchFolders: [
      folder("C:\\Users\\you\\Documents", "Documents"),
      folder("C:\\Users\\you\\Desktop", "Desktop"),
      folder("C:\\Users\\you\\Downloads", "Downloads"),
    ],
    chatModels: ["qwen2.5:3b-instruct-q4_K_M"],
    embedModels: [],
    claudeInstalled: true,
    claudeHooks: false,
    claudeMcp: false,
    composioSignedIn: Boolean(settings.v.composio.account),
    composioInClaude: true,
    browsers: ["Chrome", "Edge", "Zen"],
    installable: [],
  }),
  setup_apply: () => {
    return ["Picked 2 code folders", "Added Claude Code hooks", "Installing the search model"];
  },
  claude_add_hooks: () => "C:/Users/you/.claude/settings.json.sidekick-backup-20261002-101500",
  claude_add_mcp: () => undefined,
  // Accepts any command with a name; the real check also looks for it on PATH.
  mcp_validate_stdio: (a) => {
    const spec = a.spec as { command?: string } | undefined;
    if (!spec?.command?.trim()) throw new Error("Enter a command to run.");
  },
  browsers_status: () => [
    { id: "chrome", name: "Chrome", connected: browsersSeen.has("chrome") },
    { id: "edge", name: "Edge", connected: browsersSeen.has("edge") },
    { id: "zen", name: "Zen", connected: browsersSeen.has("zen") },
  ],
  extension_install: (a) => {
    later(4000, () => browsersSeen.add(a.browser as string));
    return {
      copied: "C:\\Users\\you\\AppData\\Local\\app.duskie.desktop\\extension",
      page: "chrome://extensions/",
      steps: [
        "If the extensions page is not showing, paste its address into the address bar and press Enter (it is copied).",
        "Turn on Developer mode (top right), then click Load unpacked.",
        "Copy folder path below (or its Alt key), paste it into the folder box and press Enter, then Select Folder.",
        "Press Allow on Duskie's island when it asks.",
      ],
    };
  },
  local_models: () => ({
    reachable: !previewFlag("nomodel"),
    chat: ["qwen2.5:3b-instruct-q4_K_M", "llama3.2:3b"],
    vision: ["moondream:latest"],
    embed: ["nomic-embed-text"],
  }),
  running_apps: () => ["code.exe", "chrome.exe", "slack.exe", "windowsterminal.exe", "keepassxc.exe"],
  suggestion_always: (a) => call("suggestion_choose", a),
  later_list: () => laterItems.v,
  later_open: (a) => {
    laterItems.v = laterItems.v.filter((l) => l.id !== a.id);
    emit("suggestion://later", laterItems.v.length);
  },
  later_clear: () => {
    laterItems.v = [];
    emit("suggestion://later", 0);
  },
  later_dismiss: (a) => {
    laterItems.v = laterItems.v.filter((l) => l.id !== a.id);
    emit("suggestion://later", laterItems.v.length);
  },
  skill_unmute: () => undefined,
};
