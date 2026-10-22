// Mock agent sessions, AI chat and timings commands.

import { call, emit } from "./handler";
import { mockChanges, mockChat, pendingAgentAnswer } from "./mock-chat";

const mockFiles = (a: Record<string, unknown>) =>
  [
    "apps/desktop/src-tauri/src/island.rs",
    "apps/desktop/src-tauri/src/island_tests.rs",
    "apps/desktop/src/components/Island.tsx",
    "apps/desktop/src/components/island/",
  ].filter((f) => f.toLowerCase().includes(String(a.query ?? "").toLowerCase()));

export const agentCommands: Record<string, (args: Record<string, unknown>) => unknown> = {
  ai_chat: (a) => mockChat(a),
  ai_run_proposal: () => ({
    ok: true,
    message: "Moved invoice-sept.pdf to Invoices",
    undoId: 1,
    path: "C:/Users/you/Documents/Invoices/invoice-sept.pdf",
  }),
  ai_cancel: () => undefined,
  ai_release: () => undefined,
  // Kept for the speed check (scripts/speed.mjs).
  timing_record: (a) => {
    const w = window as unknown as { __timings?: { name: string; ms: number }[] };
    w.__timings = [...(w.__timings ?? []), { name: a.name as string, ms: a.ms as number }];
  },
  timings_recent: () => [],
  agent_start: (a) => {
    const id = `s${Date.now()}`;
    const ev = (kind: string, data: Record<string, unknown> = {}) =>
      emit("agent://event", { session: id, kind, ...data });
    const at = (ms: number, f: () => void) => setTimeout(f, ms);
    at(300, () =>
      ev("plan", {
        items: [
          { text: "Read the API client", status: "in_progress" },
          { text: "Add retries with backoff", status: "pending" },
          { text: "Run the tests", status: "pending" },
        ],
      }),
    );
    at(600, () => ev("step", { id: "t1", tool: "Read", label: "Read client.ts", detail: "", state: "running" }));
    at(1100, () => ev("step", { id: "t1", state: "done" }));
    at(1300, () => ev("text", { text: "The client calls fetch once. I'll add three tries with a growing wait." }));
    at(1700, () => ev("step", { id: "t2", tool: "Edit", label: "Edit client.ts", detail: "", state: "running" }));
    at(2200, () => {
      ev("step", { id: "t2", state: "done" });
      ev("plan", {
        items: [
          { text: "Read the API client", status: "completed" },
          { text: "Add retries with backoff", status: "completed" },
          { text: "Run the tests", status: "in_progress" },
        ],
      });
    });
    at(2500, () => ev("ask", { question: `q${id}`, label: "Run a command", detail: "pnpm test src/api" }));
    pendingAgentAnswer.v = () => {
      ev("answered", { question: `q${id}` });
      ev("step", { id: "t3", tool: "Bash", label: "Run a command", detail: "pnpm test src/api", state: "running" });
      at(900, () => {
        ev("step", {
          id: "t3",
          state: "done",
          output:
            "> vitest run src/api\n\n ✓ client.test.ts (1)\n\n Test Files  1 passed (1)\n      Tests  1 passed (1)",
        });
        ev("usage", { used: 46000, window: 200000 });
        ev("text", { text: "\n\nDone. Requests retry up to three times, and a new test covers it." });
        ev("turn", { error: null });
      });
    };
    return {
      id,
      agent: a.agent === "codex" ? "Codex" : "Claude Code",
      project:
        String(a.path ?? "")
          .split(/[\\/]/)
          .pop() ?? "project",
      branch: "main",
      reviewable: true,
    };
  },
  agent_handoff: () => call("agent_start", { agent: "claude_code", path: "handoff" }),
  agent_answer: () => {
    pendingAgentAnswer.v?.();
    pendingAgentAnswer.v = null;
  },
  agent_send: () => undefined,
  agent_set_mode: () => undefined,
  agent_control: () => undefined,
  agent_project: () => "C:/code/sidekick",
  agent_reviews: () => [],
  agent_review_decide: () => undefined,
  agent_stop: () => undefined,
  agent_close: () => undefined,
  agent_terminal: () => undefined,
  agent_resume: () => undefined,
  agent_memory: () => 312 * 1024 * 1024,
  agent_open_editor: () => undefined,
  agent_rewind_preview: () => 1,
  agent_rewind: () => 1,
  agent_files: (a) => mockFiles(a),
  project_files: (a) => mockFiles(a),
  save_attachment: (a) => `C:/Users/you/AppData/Local/Temp/duskie-attachments/01J-${String(a.name)}`,
  agent_commands: () => [
    { name: "/compact", description: "Summarize the chat to free context", group: "Session" },
    { name: "/clear", description: "Start fresh in the same project", group: "Session" },
    { name: "/rewind", description: "Go back to an earlier message, code included", group: "Session" },
    { name: "/release", description: "Cut a release (.claude/commands/release.md)", group: "This project" },
  ],
  agent_changes: (a) => {
    const id = String(a.id ?? "");
    const files = structuredClone(mockChanges.v);
    for (const file of files) emit("review://file", { session: id, file });
    emit("review://done", { session: id });
    return files;
  },
};
