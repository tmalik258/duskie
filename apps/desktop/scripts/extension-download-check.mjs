import assert from "node:assert/strict";
import { webcrypto } from "node:crypto";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const handlers = {};
const event = (name) => ({
  addListener(fn) {
    handlers[name] = fn;
  },
});
let paired = false;
let available = true;
let items = [];
const saved = {};
const records = [];
const searches = [];
const chrome = {
  storage: {
    local: {
      async get(key) {
        return key === "token" ? { token: paired ? "secret" : "" } : saved;
      },
      async set(value) {
        Object.assign(saved, value);
      },
      async remove() {},
    },
  },
  downloads: {
    onCreated: event("created"),
    onChanged: event("changed"),
    async search(query) {
      searches.push(query);
      return items.filter((i) => (query.id !== undefined ? i.id === query.id : i.state === query.state));
    },
  },
  runtime: { onInstalled: event("install"), onStartup: event("startup"), onMessage: event("message") },
  tabs: Object.fromEntries(["onCreated", "onRemoved", "onActivated", "onUpdated"].map((name) => [name, event(name)])),
  alarms: { create() {}, onAlarm: event("alarm") },
};
const context = {
  chrome,
  crypto: webcrypto,
  navigator: { userAgent: "Chrome/130" },
  setInterval() {},
  URL,
  async fetch(url, init) {
    if (!available) throw new Error("Desktop offline");
    if (url.endsWith("/browser/download")) {
      records.push(JSON.parse(init.body));
      return { ok: true, status: 204 };
    }
    return { status: 503 };
  },
};
vm.runInNewContext(
  readFileSync(new URL("../../extension/background.js", import.meta.url), "utf8") +
    "\nthis.scan = scanDownloads; this.send = sendDownload; this.runCommand = run;",
  context,
);
const item = {
  id: 7,
  incognito: false,
  filename: "C:/Downloads/report.zip",
  url: "https://example.com/file",
  bytesReceived: 10,
  totalBytes: -1,
  paused: false,
  state: "in_progress",
};
items = [item];
await context.scan();
assert.equal(searches.length, 0, "unpaired extensions do not read download history");
paired = true;
await context.scan();
assert.equal(records.length, 1);
assert.equal(records[0].total, null);
assert.ok(records[0].instance);
const instance = records[0].instance;
await context.send({ ...item, incognito: true });
await context.send({ ...item, incognito: undefined });
assert.equal(records.length, 1);
item.bytesReceived = 20;
item.totalBytes = 100;
await context.scan();
assert.equal(records.at(-1).bytes, 20);
assert.equal(records.at(-1).total, 100);
assert.equal(records.at(-1).instance, instance);
item.paused = true;
await context.scan();
assert.equal(records.at(-1).paused, true);
available = false;
item.bytesReceived = 30;
await context.scan();
available = true;
item.paused = false;
await context.runCommand({ type: "check_downloads" });
assert.equal(records.at(-1).bytes, 30, "reconnection checks recover progress without starting a download");
item.state = "complete";
await context.scan();
assert.equal(records.at(-1).state, "complete");
const completedCount = records.length;
await context.scan();
assert.equal(records.length, completedCount, "completion leaves the active polling set");
const second = { ...item, id: 8, state: "interrupted", error: "NETWORK_FAILED" };
await context.send(second);
assert.equal(records.at(-1).error, "NETWORK_FAILED");
console.log(
  "PASS: extension pairing/privacy, unknown/known totals, pause/resume, reconnection, source query, interruption, completion polling cleanup",
);
