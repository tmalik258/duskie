import { describe, expect, it } from "vitest";
import { readProbes } from "./debug-probes";

describe("readProbes", () => {
  it("reads probes, logs, cause and removal", () => {
    const r = readProbes([
      { kind: "text", text: "Adding logs.\nPROBE Island.tsx:612 - state change\nPROBE agents.ts:140 - session update" },
      {
        kind: "step",
        step: {
          id: "1",
          tool: "Bash",
          label: "Run",
          detail: "",
          state: "done",
          output: "ok\n[dbg Island.tsx:612] idle -> working",
        },
      },
      { kind: "text", text: "CAUSE: text is measured before scaling.\nPROBES REMOVED" },
    ]);
    expect(r.probes.map((p) => p.at)).toEqual(["Island.tsx:612", "agents.ts:140"]);
    expect(r.logs).toEqual(["[dbg Island.tsx:612] idle -> working"]);
    expect(r.cause).toBe("text is measured before scaling.");
    expect(r.removed).toBe(true);
  });
});
