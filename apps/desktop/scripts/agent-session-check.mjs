// Execute the production store and command dispatcher without a Tauri window.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";

const source = readFileSync(new URL("../src/lib/agents.ts", import.meta.url), "utf8");
const commandsSource = readFileSync(new URL("../src/lib/agent-commands.ts", import.meta.url), "utf8");
function boot(saved, storage = new Map(), rejectMode = false) {
  if (saved) storage.set("sidekick.agents", JSON.stringify(saved));
  const handlers = {};
  let timer;
  let event;
  const exports = {};
  const api = new Proxy(
    {},
    {
      get:
        (_, key) =>
        (..._args) =>
          key === "agentSetMode" && rejectMode ? Promise.reject("mode rejected") : Promise.resolve(),
    },
  );
  const create = (init) => {
    let state = init();
    const subscriptions = [];
    const store = () => state;
    store.getState = () => state;
    store.setState = (patch) => {
      state = { ...state, ...(typeof patch === "function" ? patch(state) : patch) };
      subscriptions.forEach((f) => {
        f(state);
      });
    };
    store.subscribe = (fn) => subscriptions.push(fn);
    return store;
  };
  vm.runInNewContext(
    ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } })
      .outputText,
    {
      exports,
      require: (name) =>
        name === "zustand"
          ? { create }
          : name === "./mask"
            ? { mask: (s) => s }
            : {
                api,
                EVENTS: { agentEvent: "agent" },
                listen: (_, fn) => {
                  event = fn;
                },
              },
      localStorage: { getItem: (k) => storage.get(k) ?? null, setItem: (k, v) => storage.set(k, v) },
      window: {
        screen: { height: 1080 },
        addEventListener: (name, fn) => {
          handlers[name] = fn;
        },
      },
      setTimeout: (fn) => {
        timer = fn;
        return 1;
      },
      clearTimeout() {},
      Date,
      crypto: { randomUUID: () => "step" },
    },
  );
  exports.listenToAgents();
  return { ...exports, storage, flush: () => timer?.(), event: (e) => event(e), unload: () => handlers.pagehide() };
}
const session = (id, status) => ({
  id,
  agent: "Codex",
  mode: "edit",
  status,
  entries: [],
  plan: [],
  changes: 0,
  startedAt: 1,
  turnAt: 1,
});
for (const status of ["idle", "working", "waiting", "failed", "ended"]) {
  const app = boot({
    version: 2,
    sessions: [session("a", status), session("b", "idle")],
    current: "a",
    focus: "a",
    tab: "agents",
    layout: "board",
  });
  assert.equal(app.useAgents.getState().current, "a");
  assert.equal(app.useAgents.getState().layout, "board");
  app.setTab("ask");
  app.setTab("agents");
  assert.equal(app.useAgents.getState().current, "a");
  assert.equal(app.useAgents.getState().sessions[0].status, ["working", "waiting"].includes(status) ? "ended" : status);
  app.sessionView("a", { draft: "first draft", scroll: 100, follow: false, reviewing: true, reviewTurn: "turn-1" });
  app.sessionView("b", { draft: "second draft" });
  app.unload();
  const restored = boot(null, app.storage);
  const state = restored.useAgents.getState();
  assert.equal(state.focus, "a");
  assert.equal(state.current, "a");
  assert.equal(state.sessions[0].view.draft, "first draft");
  assert.equal(state.sessions[1].view.draft, "second draft");
  assert.equal(state.sessions[0].view.follow, false);
  assert.equal(state.sessions[0].view.scroll, 100);
  assert.equal(state.sessions[0].view.reviewTurn, "turn-1");
  restored.closeSession("a");
  assert.equal(restored.useAgents.getState().current, null);
  assert.equal(restored.useAgents.getState().focus, null);
}
const legacy = boot([session("old", "idle")]);
assert.equal(legacy.useAgents.getState().sessions.length, 1);
assert.equal(legacy.useAgents.getState().current, null);
const invalid = boot({ sessions: [session("a", "idle")], current: "gone", focus: "gone" });
assert.equal(invalid.useAgents.getState().current, null);
const app = boot({ sessions: [session("a", "working")], current: "a" });
app.startHere("project");
assert.equal(app.useAgents.getState().current, null);
app.event({ session: "a", kind: "usage", used: 500, window: 1000, total: 9000 });
assert.equal(app.useAgents.getState().sessions[0].usage.used, 500);
assert.equal(app.useAgents.getState().sessions[0].usage.total, 9000);
for (const mode of ["plan", "ask", "edit", "full"]) {
  await app.setSessionMode("a", mode);
  assert.equal(app.useAgents.getState().sessions[0].mode, mode);
  assert.equal(app.useAgents.getState().sessions[0].status, "ended");
}
app.event({ session: "a", kind: "turn", changes: 2, review: { id: "turn", files: 2, error: null } });
app.event({ session: "a", kind: "ended", changes: 2, review: { id: "turn", files: 2, error: null } });
assert.equal(app.useAgents.getState().sessions[0].changes, 2);
assert.equal(app.useAgents.getState().sessions[0].entries.length, 1);
for (const window of ["five_hour", "seven_day"])
  app.event({ session: "a", kind: "limit", window, status: "allowed", used: 0.2, resetsAt: 9999999999 });
assert.equal(app.seenWindows("Codex").length, 2);
const failure = boot({ sessions: [session("a", "idle")] }, new Map(), true);
await failure.setSessionMode("a", "full");
assert.equal(failure.useAgents.getState().sessions[0].mode, "edit");
assert.equal(failure.useAgents.getState().sessions[0].error, "mode rejected");
const catalog = {};
vm.runInNewContext(
  ts.transpileModule(commandsSource, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  }).outputText,
  { exports: catalog },
);
const codex = catalog.commandCatalog("Codex", []);
assert.equal(codex.find((c) => c.name === "/review").execution, "terminal");
assert.equal(codex.find((c) => c.name === "/diff").execution, "control");
assert.equal(codex.filter((c) => c.name.startsWith("/re")).length, 4);
assert.equal(
  catalog
    .commandCatalog("Claude Code", [{ name: "/project", execution: "provider" }])
    .find((c) => c.name === "/project").execution,
  "provider",
);
console.log("Agent restoration, drafts, view state, modes, telemetry, and command catalog checks passed");
