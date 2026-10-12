// Regression checks for persisted empty results and updates to mounted panels.
// Run with: node apps/desktop/scripts/cache-check.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";

let current;
const react = {
  useState(initial) {
    const panel = current;
    const index = panel.states.length;
    panel.states.push(typeof initial === "function" ? initial() : initial);
    return [
      panel.states[index],
      (value) => {
        panel.states[index] = value;
      },
    ];
  },
  useRef(value) {
    return { current: value };
  },
  useCallback(callback) {
    return callback;
  },
  useEffect(effect) {
    current.effects.push(effect);
  },
};
const storage = new Map();
const exports = {};
const source = readFileSync(new URL("../src/lib/cache.ts", import.meta.url), "utf8");
vm.runInNewContext(
  ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText,
  {
    exports,
    require: (name) => {
      assert.equal(name, "react");
      return react;
    },
    localStorage: { getItem: (key) => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value) },
    setInterval,
    clearInterval,
  },
);

function mount(key, load, revalidate = false) {
  const panel = { states: [], effects: [] };
  current = panel;
  // biome-ignore lint/correctness/useHookAtTopLevel: this test supplies an isolated hook runner.
  panel.api = exports.useCached(key, load, undefined, revalidate);
  const cleanups = panel.effects.map((effect) => effect());
  panel.close = () =>
    cleanups.forEach((cleanup) => {
      cleanup?.();
    });
  return panel;
}
const flush = () => new Promise((resolve) => setImmediate(resolve));

// A production cache created before code folders were selected must recover.
storage.set("sidekick:cache:projects", "[]");
let loads = 0;
const projects = mount(
  "projects",
  async () => {
    loads++;
    return [{ name: "app", path: "C:/code/app" }];
  },
  true,
);
assert.equal(projects.states[0].length, 0);
await flush();
assert.equal(loads, 1);
assert.equal(projects.states[0][0].name, "app");
projects.close();
const reopened = mount(
  "projects",
  async () => {
    loads++;
    return [{ name: "other", path: "C:/code/other" }];
  },
  true,
);
await flush();
assert.equal(loads, 2);
assert.equal(reopened.states[0][0].name, "other");
reopened.close();

// Welcome's background check must update a checklist that is already mounted.
exports.putCached("setup", { connected: false });
const checklist = mount("setup", async () => {
  throw new Error("unexpected fetch");
});
exports.revalidate("setup", async () => ({ connected: true }));
await flush();
assert.equal(checklist.states[0].connected, true);
const secondPanel = mount("setup", async () => {
  throw new Error("unexpected fetch");
});
checklist.api.set({ connected: false });
assert.equal(checklist.states[0].connected, false);
assert.equal(secondPanel.states[0].connected, false);
checklist.close();
secondPanel.close();
exports.putCached("setup", { connected: true });
assert.equal(checklist.states[0].connected, false, "unmounted panels must unsubscribe");

// Opening two views together should share the same native probe.
let release;
let probes = 0;
const probe = () => {
  probes++;
  return new Promise((resolve) => {
    release = resolve;
  });
};
const one = mount("shared", probe, true);
const two = mount("shared", probe, true);
await flush();
assert.equal(probes, 1);
release(["repo"]);
await flush();
assert.equal(one.states[0][0], "repo");
assert.equal(two.states[0][0], "repo");
one.close();
two.close();
const failed = mount(
  "retry",
  async () => {
    throw new Error("temporary failure");
  },
  true,
);
await flush();
failed.close();
const retry = mount("retry", async () => ["recovered"], true);
await flush();
assert.equal(retry.states[0][0], "recovered");
retry.close();

// A code-folder change during discovery must get a probe after the old one.
let finishOld;
const changing = mount(
  "changing",
  () =>
    new Promise((resolve) => {
      finishOld = resolve;
    }),
  true,
);
await flush();
exports.revalidate("changing", async () => ["new folder"]);
finishOld(["old folder"]);
await flush();
assert.equal(changing.states[0][0], "new folder");
changing.close();
console.log("Cache regression checks passed");
