// Mock git branches, MCP servers and limits commands.

import type { DirectServer } from "../types";
import { gitParityBranches, gitParityFileDiff, mailStatus, previewFlag, settings } from "./handler";
import { setServers } from "./mock-install-update";
import { mockStashes } from "./repo-commands";

export const serverCommands: Record<string, (args: Record<string, unknown>) => unknown> = {
  git_stash_push: () => {
    mockStashes.v = [
      { name: "stash@{0}", message: "On main: Stashed from Duskie", when: "just now" },
      ...mockStashes.v.map((x, i) => ({ ...x, name: `stash@{${i + 1}}` })),
    ];
    return "Stashed your changes. They are in Stashes.";
  },
  git_stash_drop: (a) => {
    mockStashes.v = mockStashes.v.filter((x) => x.name !== a.name);
    return "Dropped the stash";
  },
  git_fetch: () => "Fetched from the remote",
  git_push: () => "Pushed to the remote",
  git_sync: () => "Synced: pulled the new commits and pushed yours",
  git_branches: () =>
    previewFlag("git")
      ? gitParityBranches()
      : [
          { name: "main", current: false, ahead: 0, behind: 2, upstream: true },
          { name: "feat/git-dock", current: true, ahead: 3, behind: 0, upstream: true },
          { name: "fix/island-width", current: false, ahead: 1, behind: 0, upstream: true },
        ],
  git_switch_branch: (a) => `Switched to ${String(a.name)}`,
  git_create_branch: (a) => `Created and switched to ${String(a.name)}`,
  git_file_diff: (a) => {
    const file = String(a.file);
    const staged = Boolean(a.staged);
    if (previewFlag("git")) return gitParityFileDiff(file, staged);
    return {
      path: file,
      status: "modified" as const,
      added: staged ? 2 : 1,
      removed: 1,
      hunks: [
        {
          header: "@@ -12,4 +12,5 @@ export function resolveIslandState(",
          lines: [
            "   const dock = settings.git?.dockOpen ?? false;",
            '-  return dock ? "wide" : "idle";',
            '+  return dock ? "wide" : settings.island?.compact ? "compact" : "idle";',
            "+  // keep in sync with Island.tsx",
          ],
        },
      ],
    };
  },
  git_stage_hunk: () => "Staged that hunk",
  island_width: () => undefined,
  gpu_memory: () => (new URLSearchParams(location.search).has("cpu") ? 0 : 8192),
  limits_paused: () =>
    new URLSearchParams(location.search).has("limited") ? [{ name: "Anthropic", pausedSecs: 42 }] : [],
  servers_save: (a) => {
    const given = a.server as DirectServer;
    const server: DirectServer = {
      ...given,
      id: given.id || `srv${Date.now()}`,
      confirmed: false,
      writesAllowed: [],
      envNames: Object.keys((a.env as Record<string, string>) ?? {}),
    };
    setServers([...settings.v.directServers.filter((s) => s.id !== server.id), server]);
    return server.id;
  },
  servers_command: (a) => {
    const s = settings.v.directServers.find((x) => x.id === a.id);
    if (!s) throw new Error("That server is gone.");
    return s.kind === "stdio" ? [s.command, ...s.args].join(" ") : s.url;
  },
  servers_confirm: (a) =>
    setServers(settings.v.directServers.map((s) => (s.id === a.id ? { ...s, confirmed: true } : s))),
  servers_test: (a) => {
    const s = settings.v.directServers.find((x) => x.id === a.id);
    if (!s?.confirmed) throw new Error("Confirm the command first.");
    return [
      { name: "list_issues", description: "List issues in a repo", writes: false, allowed: false },
      {
        name: "create_issue",
        description: "Open a new issue",
        writes: true,
        allowed: s.writesAllowed.includes("create_issue"),
      },
    ];
  },
  servers_allow_write: (a) =>
    setServers(
      settings.v.directServers.map((s) =>
        s.id === a.id
          ? {
              ...s,
              writesAllowed: [...s.writesAllowed.filter((t) => t !== a.tool), ...(a.allow ? [String(a.tool)] : [])],
            }
          : s,
      ),
    ),
  servers_sign_in: (a) =>
    setServers(
      settings.v.directServers.map((s) =>
        s.id === a.id ? { ...s, envNames: [...s.envNames.filter((n) => n !== "Authorization"), "Authorization"] } : s,
      ),
    ),
  servers_remove: (a) => setServers(settings.v.directServers.filter((s) => s.id !== a.id)),
  git_message_diff: () => ({ text: "diff --git a/src/app.ts b/src/app.ts", covered: 1, total: 1 }),
  mail_status: () => mailStatus.v,
};
