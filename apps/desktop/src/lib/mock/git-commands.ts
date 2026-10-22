// Mock git, attention, recipe, merge and Do Not Disturb commands.

import type { Settings } from "../types";
import { emit, gitParityLog, gitParityStatus, mockDnd, previewFlag, settings } from "./handler";
import { mockStashes } from "./repo-commands";

export const gitCommands: Record<string, (args: Record<string, unknown>) => unknown> = {
  merge_state: () => ({
    branch: "feat/finish",
    main: "main",
    stashed: true,
    files: [
      {
        file: "apps/desktop/src/lib/store.ts",
        spots: 2,
        mine: 'const last = turns.findLast((t) => t.role === "user");\nconst localOnly = last?.localOnly ?? settings.ai.localOnly;',
        theirs: "const meta = await api.chatMeta(id);\nconst localOnly = meta.localOnly;",
      },
      {
        file: "crates/core/src/settings.rs",
        spots: 1,
        mine: "pub local_only: bool,",
        theirs: "pub git_watch: GitWatch,",
      },
      {
        file: "apps/desktop/src/components/settings/AiTab.tsx",
        spots: 3,
        mine: 'title="Privacy"\nhint="Chats on this PC only use Ollama."',
        theirs: 'title="Repos"\nhint="Where clones go and how often to check."',
      },
    ],
    // The Git dock preview shows the Merge tab only with ?conflicts.
    ...(previewFlag("git") && !previewFlag("conflicts") ? { files: [] } : {}),
  }),
  merge_keep: () => null,
  merge_end: (a) => ({
    ok: true,
    message: a.finish ? "Merged main, your changes are back" : "Back exactly as before the update",
    path: null,
    auto: false,
    undoId: a.finish ? 7 : null,
  }),
  codex_add_notify: () => "C:\\Users\\you\\.codex\\config.toml.sidekick-backup-20261002",
  codex_add_mcp: () => null,
  guide_keys: () => null,
  dnd_get: () => mockDnd.v,
  dnd_set: (a) => {
    mockDnd.v = Boolean(a.on);
    return `Done. Do Not Disturb is ${mockDnd.v ? "on" : "off"}`;
  },
  recipe_save: (args) => {
    const r = args.recipe as Settings["recipes"][number];
    const recipe = { ...r, id: r.id || `r${Date.now()}`, name: r.name || r.prompt.split(" ").slice(0, 6).join(" ") };
    settings.v = { ...settings.v, recipes: [...settings.v.recipes.filter((x) => x.id !== recipe.id), recipe] };
    emit("settings://changed", settings.v);
    return `Saved recipe ${recipe.name}`;
  },
  recipe_delete: (args) => {
    settings.v = { ...settings.v, recipes: settings.v.recipes.filter((x) => x.id !== args.id) };
    emit("settings://changed", settings.v);
    return "Deleted";
  },
  recipe_run: () => "Running",
  know_how_clear: () => null,
  attention_lessons: () =>
    Object.entries(settings.v.notifications.lessons.entries).map(([key, l]) => ({
      key,
      shift: Math.max(-45, Math.min(20, Math.round(l.acted * 6 - l.showLess * 14))),
      updated: l.updated,
    })),
  attention_acted: () => null,
  attention_show_less: () => null,
  attention_undo_show_less: () => null,
  attention_set_level: () => null,
  attention_reset: (args) => {
    const entries = { ...settings.v.notifications.lessons.entries };
    const scope = String(args.scope);
    for (const k of Object.keys(entries)) {
      if (scope === "all" || k === scope || (scope.startsWith("group:") && k.startsWith(scope.slice(6))))
        delete entries[k];
    }
    settings.v = { ...settings.v, notifications: { ...settings.v.notifications, lessons: { entries } } };
    return null;
  },
  git_status: () =>
    previewFlag("git")
      ? gitParityStatus()
      : [
          { path: "src/app.ts", kind: "M", staged: true, unstaged: false },
          { path: "src/util.ts", kind: "M", staged: false, unstaged: true },
          { path: "README.md", kind: "?", staged: false, unstaged: true },
        ],
  git_stage: () => "Staged",
  git_unstage: () => "Unstaged",
  git_discard: () => "Discarded your changes. They are in Stashes if you need them.",
  git_commit: () => "Committed",
  git_write_message: () => "Tidy the util helpers",
  git_amend: () => "Amended the last commit",
  git_last_commit_pushed: () => false,
  git_log: () =>
    previewFlag("git")
      ? gitParityLog()
      : [
          {
            hash: "b56ca02",
            subject: "Proposals card with Skip and Approve per row",
            author: "You",
            when: "2 hours ago",
          },
          { hash: "509e408", subject: "Agent card on hover", author: "You", when: "3 hours ago" },
          { hash: "a5e488a", subject: "Meeting card on hover", author: "Ayesha", when: "yesterday" },
        ],
  git_stashes: () => mockStashes.v,
  git_stash_apply: (a) => {
    if (a.pop) mockStashes.v = mockStashes.v.filter((x) => x.name !== a.name);
    return a.pop ? "Popped the stash" : "Applied the stash. A copy stays in Stashes.";
  },
};
