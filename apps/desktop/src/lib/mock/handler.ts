// Part of mock: Handler, Commands, registry, call, handlers, settings, mailStatus, library, mockFiles, previewFlag, GIT_PARITY_REPO, gitParityStatus, gitParityBranches, gitParityLog, gitParityFileDiff, gitParityReposOverview, mascot, suggestion, epoch, mockDnd, mockUpdateProgress, mockActivitySnapshot, activitySnapshot, emit.

import type { LibrarySkill, MailStatus } from "../types";
import {
  type ActivitySnapshot,
  DEFAULT_SETTINGS,
  type MascotState,
  type Settings,
  type Suggestion,
  type UpdateProgress,
} from "../types";

export type Handler = (payload: unknown) => void;

export type Commands = Record<string, (args: Record<string, unknown>) => unknown>;

/** Every command, filled in once all groups exist, so one command can run another. */
export const registry: Commands = {};

export function call(name: string, args: Record<string, unknown> = {}) {
  return registry[name]?.(args);
}

export const handlers = new Map<string, Set<Handler>>();

export const settings: { v: Settings } = { v: structuredClone(DEFAULT_SETTINGS) };

export const mailStatus: { v: MailStatus } = {
  v: { state: "disconnected", configured: true, lastOk: null, error: null, provider: null },
};

export const library: { v: LibrarySkill[] } = { v: [] };

export const mockFiles: Record<string, string> = {
  "src/main.ts": 'console.log("hello");\nexport {};\n',
  "README.md": "# Demo\n",
};
if (typeof localStorage !== "undefined") {
  try {
    Object.assign(settings.v, JSON.parse(localStorage.getItem("sidekick.mock.savedFolders") ?? "{}"));
  } catch {}
}

/** Preview switches: `?nomodel` has no AI set up, `?offline` no internet. */
export const previewFlag = (name: string) =>
  typeof location !== "undefined" && new URLSearchParams(location.search).has(name);

// `?onboarded` in the preview URL skips the welcome; `?color=smoke` and
// `?theme=onyx` pick the island and mascot colours (for visual checks).
if (typeof location !== "undefined") {
  const q = new URLSearchParams(location.search);
  if (q.has("onboarded")) settings.v.onboarded = true;
  settings.v.islandColor = (q.get("color") as Settings["islandColor"] | null) ?? settings.v.islandColor;
  settings.v.theme = (q.get("theme") as Settings["theme"] | null) ?? settings.v.theme;
  if (q.get("voice") === "full") settings.v.voice.listeningStyle = "full";
  if (q.has("live")) settings.v.voice.live = true;
  if (q.has("git")) {
    settings.v.codeFolders = ["C:/code/shop"];
    settings.v.savedProjects = ["C:/code/shop"];
  }
}

const GIT_PARITY_REPO = "C:/code/shop";

export const gitParityStatus = () => [
  { path: "apps/desktop/src/components/agents/GitDock.tsx", kind: "M", staged: true, unstaged: false },
  { path: "apps/desktop/src/lib/mock.ts", kind: "M", staged: false, unstaged: true },
  { path: "apps/desktop/tests/parity/helpers.ts", kind: "?", staged: false, unstaged: true },
];

export const gitParityBranches = () => [
  { name: "main", current: false, ahead: 0, behind: 2, upstream: true },
  { name: "feat/git-dock", current: true, ahead: 3, behind: 0, upstream: true },
  { name: "fix/island-width", current: false, ahead: 1, behind: 0, upstream: true },
];

export const gitParityLog = () => [
  { hash: "b56ca02", subject: "Git dock parity fixtures", author: "You", when: "2 hours ago" },
  { hash: "509e408", subject: "Prototype-aligned git bar", author: "You", when: "3 hours ago" },
  { hash: "a5e488a", subject: "Repos tab seam", author: "Ayesha", when: "yesterday" },
];

export const gitParityFileDiff = (file: string, staged: boolean) => ({
  path: file,
  status: "modified" as const,
  added: staged ? 2 : 1,
  removed: 1,
  hunks: [
    {
      header: "@@ -1,4 +1,5 @@",
      lines: [
        " export function GitDock() {",
        "-  return null;",
        '+  return <section className="gd-dock-panel" />;',
        "+  // parity mock hunk",
      ],
    },
  ],
});

export const gitParityReposOverview = () => ({
  via: "gh" as const,
  repos: [
    {
      name: "shop",
      path: GIT_PARITY_REPO,
      slug: "acme/shop",
      branch: "feat/git-dock",
      ahead: 3,
      behind: 0,
      changed: 3,
      ci: "fail" as const,
      reviews: 1,
      prs: [
        {
          number: 42,
          title: "Fix login redirect",
          url: "https://github.com/acme/shop/pull/42",
          branch: "feat/git-dock",
          mine: true,
          ci: "fail" as const,
          failing: ["test (windows)"],
          reviewRequested: false,
        },
      ],
    },
  ],
});

export const mascot: { v: MascotState } = { v: previewFlag("orphan") ? "working" : "idle" };

export const suggestion: { v: Suggestion | null } = { v: null };

export const epoch = { v: 0 };

export const mockDnd = { v: false };

export const mockUpdateProgress: { v: UpdateProgress | null } = { v: null };

const mockActivitySnapshot: { v: ActivitySnapshot | null } = { v: null };

export function activitySnapshot(): ActivitySnapshot {
  if (mockActivitySnapshot.v) return mockActivitySnapshot.v;
  const query = new URLSearchParams(typeof window === "undefined" ? "" : window.location.search);
  const mode = query.get("activity");
  const now = Date.now();
  const activities: ActivitySnapshot["activities"] = mode
    ? [
        {
          id: "preview-download",
          source: mode === "action" ? "action" : "browser",
          parentId: null,
          label: mode === "action" ? "Opening sidekick in Cursor" : "Downloading report.zip in Chrome",
          phase:
            mode === "paused"
              ? "awaitingUser"
              : mode === "failed"
                ? "failed"
                : mode === "action"
                  ? "running"
                  : "downloading",
          startedAt: now - 12_000,
          lastProgressAt: now - (mode === "stale" ? 120_000 : 0),
          transferred: mode === "action" ? null : 18_000_000,
          total: query.has("knownTotal") ? 36_000_000 : null,
          outcome: mode === "failed" ? "NETWORK_FAILED" : null,
          dismissed: false,
          revision: 1,
          destination: null,
        },
      ]
    : [];
  if (mode === "group")
    activities.push({ ...activities[0], id: "second-download", label: "Downloading photo.zip in Chrome" });
  mockActivitySnapshot.v = { revision: 1, activities };
  return mockActivitySnapshot.v;
}

export function emit(event: string, payload: unknown) {
  for (const h of handlers.get(event) ?? []) h(payload);
}
