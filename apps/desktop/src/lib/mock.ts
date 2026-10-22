// Browser-only stand-in for the Rust core, used when the UI runs outside
// Tauri. It mimics the app loosely; the real rules live in Rust.

import { commands } from "./mock/focus-commands";
import { emit, type Handler, handlers, suggestion } from "./mock/handler";
import { go } from "./mock/mock-install-update";
import { CUES, type Suggestion } from "./types";

export const mock = {
  async invoke<T>(cmd: string, args: Record<string, unknown> = {}): Promise<T> {
    const fn = commands[cmd];
    if (!fn) throw new Error(`mock: unknown command ${cmd}`);
    return fn(args) as T;
  },
  listen(event: string, handler: Handler): () => void {
    let set = handlers.get(event);
    if (!set) {
      set = new Set();
      handlers.set(event, set);
    }
    set.add(handler);
    return () => set.delete(handler);
  },
};

// Exposed for console debugging in the browser preview.
if (typeof window !== "undefined") {
  (window as unknown as { duskieMock: unknown }).duskieMock = { go, cues: CUES, invoke: mock.invoke, emit };
}

// Preview only (browser mock, never in the app): lets the parity script put
// the island in any state.
if (typeof window !== "undefined") {
  Object.assign(window, {
    __mockEmit: emit,
    __mockGo: go,
    __mockCall: (name: string, args: Record<string, unknown> = {}) => commands[name]?.(args),
    __mockAgents: async (calm = false) => {
      const { useAgents } = await import("./agents");
      const now = Date.now();
      const mk = (
        id: string,
        agent: string,
        project: string,
        title: string,
        status: string,
        mode: string,
        mins: number,
        extra = {},
      ) => ({
        id,
        agent,
        project,
        branch: null,
        reviewable: true,
        mode,
        title,
        status,
        entries: [{ kind: "you", text: `${title}. Keep the change small and run the tests.` }],
        plan: [],
        usage: null,
        question: null,
        error: null,
        startedAt: now - mins * 60_000,
        turnAt: now - mins * 60_000,
        tookMs: null,
        changes: 0,
        ...extra,
      });
      useAgents.setState({
        sessions: [
          mk("a1", "Codex", "duskie", "Migrate tests to Vitest", "idle", "full", 22, { finished: true }),
          mk("a2", "Claude Code", "duskie", "Compact label wraps on narrow screens", "idle", "edit", 10, {
            changes: 3,
          }),
          mk("a3", "Claude Code", "falconxoft-portal", "Add CSV export to invoices", "idle", "edit", 14, {
            changes: 5,
          }),
          mk("a4", "Codex", "api-gateway", "Fix missing rate limit headers", calm ? "idle" : "waiting", "ask", 3, {
            waitingSince: now - 3 * 60_000,
            choose: {
              id: "q1",
              questions: [
                {
                  question: "Which limit should the headers report?",
                  header: "Limit",
                  multiSelect: false,
                  options: [
                    { label: "Per key", description: "Each API key has its own limit" },
                    { label: "Per account", description: "One limit for the whole account" },
                  ],
                },
              ],
            },
          }),
          mk("a5", "Claude Code", "duskie", "Writing tests for the wash controller", "working", "edit", 1, {
            branch: "agent/claude-voice-settings",
            plan: ["Read the controller", "List the cases", "Write the tests", "Run them", "Open a review"].map(
              (text, i) => ({ text, status: i < 2 ? "completed" : i === 2 ? "in_progress" : "pending" }),
            ),
            entries: [
              {
                kind: "step",
                step: { id: "s1", tool: "edit", label: "Edited lib/wash.ts", detail: "+42 -6", state: "done" },
              },
              {
                kind: "step",
                step: {
                  id: "s2",
                  tool: "bash",
                  label: "Ran pnpm test --filter desktop",
                  detail: "38 passed",
                  state: "done",
                },
              },
            ],
          }),
        ] as never,
        current: null,
      });
    },
    __mockStore: async (patch: Record<string, unknown>) => {
      const { useDuskie } = await import("./store");
      useDuskie.setState(patch as never);
    },
    __mockWork: async (label: string) => {
      const { beginActivity } = await import("./activities");
      beginActivity(label);
      go("working");
    },
    __mockSuggest: (raw: Suggestion) => {
      // Mock suggestions come from Slack, raised a few minutes back.
      const s = { source: "Slack", at: Date.now() - 4 * 60_000, ...raw };
      suggestion.v = s;
      emit("suggestion://new", s);
    },
  });
}
