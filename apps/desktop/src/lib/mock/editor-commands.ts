// Mock editor, terminal, update and suggestion commands.

import { activitySnapshot, emit, library, mockFiles, mockUpdateProgress, previewFlag, suggestion } from "./handler";
import { go, later, mockInstallUpdate } from "./mock-install-update";

export const editorCommands: Record<string, (args: Record<string, unknown>) => unknown> = {
  activity_reconcile: () => {
    go("idle");
    return true;
  },
  activity_check: ({ id }) => {
    const snapshot = activitySnapshot();
    if (previewFlag("activityrecover")) {
      const activity = snapshot.activities.find((a) => a.id === id);
      if (activity) {
        activity.transferred = (activity.transferred ?? 0) + 1_000_000;
        activity.lastProgressAt = Date.now();
        activity.phase = "downloading";
        activity.dismissed = false;
        snapshot.revision++;
        emit("activity://changed", structuredClone(snapshot));
      }
    }
    return structuredClone(snapshot);
  },
  activity_dismiss: ({ id }) => {
    const snapshot = activitySnapshot();
    const activity = snapshot.activities.find((a) => a.id === id);
    if (activity) {
      activity.dismissed = true;
      snapshot.revision++;
      emit("activity://changed", structuredClone(snapshot));
    }
  },
  update_progress: () => mockUpdateProgress.v,
  // The preview pretends a release is out, so the update UI can be seen.
  update_check: () => {
    const update = {
      version: "0.2.0",
      current: "0.1.0",
      url: "https://github.com/tmalik258/duskie/releases",
      summary: "Faster wash, Git review and activities",
    };
    emit("update://available", update);
    return update;
  },
  update_install: mockInstallUpdate,
  net_check: () => !previewFlag("offline") && (typeof navigator === "undefined" || navigator.onLine),
  suggestion_current: () => suggestion.v,
  suggestion_choose: (a) => {
    const index = a.index as number;
    const updating = suggestion.v?.actions[index] === "install_update";
    suggestion.v = null;
    emit("suggestion://clear", a.id);
    if (updating) return mockInstallUpdate();
    go("working");
    later(1400, () => {
      emit("action://result", {
        ok: index !== 2,
        message: index === 2 ? "Simulated failure" : "Opened in Zen",
        path: null,
        auto: false,
      });
      go(index === 2 ? "error" : "success");
    });
  },
  suggestion_dismiss: (a) => {
    suggestion.v = null;
    emit("suggestion://clear", a.id);
    go("idle");
  },
  events_recent: () => [],
  term_open: () => {
    setTimeout(() => emit("term://data", { id: 1, data: "PS C:\\code\\app> ", done: false }), 50);
    return 1;
  },
  term_write: (a) => {
    const data = (a as { data: string }).data;
    emit("term://data", { id: 1, data: data === "\r" ? "\r\nPS C:\\code\\app> " : data, done: false });
  },
  term_resize: () => undefined,
  term_close: () => undefined,
  editor_tree: () => [
    { path: "src", dir: true },
    { path: "src/main.ts", dir: false },
    { path: "README.md", dir: false },
  ],
  editor_read: (a) => ({ text: mockFiles[(a as { path: string }).path] ?? "", stamp: "s1" }),
  editor_write: (a) => {
    const { path, text } = a as { path: string; text: string };
    mockFiles[path] = text;
    return "s2";
  },
  editor_changed: () => false,
  editor_head: (a) => ((a as { path: string }).path === "src/main.ts" ? 'console.log("hi");\n' : ""),
  editor_search: (a) =>
    Object.entries(mockFiles).flatMap(([path, text]) =>
      text
        .split("\n")
        .map((line, i) => ({ path, line: i + 1, text: line }))
        .filter((h) => h.text.toLowerCase().includes((a as { query: string }).query.toLowerCase())),
    ),
  library_review: () =>
    library.v.some((l) => l.name === "pdf")
      ? []
      : [
          {
            name: "pdf",
            description: "Read and fill PDF forms.",
            origin: "claude",
            dir: "~/.claude/skills/pdf",
            hash: "a1",
            files: ["SKILL.md"],
            hasScripts: false,
          },
        ],
};
