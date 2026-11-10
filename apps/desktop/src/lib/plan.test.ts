import { describe, expect, it } from "vitest";
import { claimsPlanReady, parsePlanDocument, planFromSession } from "./plan";

describe("parsePlanDocument", () => {
  it("does not treat a plain bullet list as a plan", () => {
    expect(parsePlanDocument("Notes:\n- tidy the cache\n- rename the flag")).toBeNull();
  });

  it("reads numbered steps as a plan and keeps raw markdown", () => {
    const raw = "Plan: Fix login\n1. Add the test.\n2. Fix the handler.\nThe plan is ready.";
    const doc = parsePlanDocument(raw);
    expect(doc?.items.map((i) => i.text)).toEqual(["Add the test.", "Fix the handler."]);
    expect(doc?.markdown).toBe(raw.trim());
    expect(claimsPlanReady("The plan is ready.")).toBe(true);
  });

  it("does not truncate long step titles", () => {
    const long =
      "This is a very long first sentence that should stay complete without an ellipsis even when it exceeds one hundred and twenty characters total for the step title.";
    const doc = parsePlanDocument(`1. ${long}\n2. Second step.`);
    expect(doc?.items[0]?.text).toBe(long);
    expect(doc?.items[0]?.text.includes("…")).toBe(false);
  });
});

describe("planFromSession", () => {
  it("prefers the newest parseable plan over an older richer one", () => {
    const older =
      "1. Read the controller carefully and list every case.\n2. Write the tests with fixtures.\n3. Run them.\n4. Open a review.";
    const newer = "1. Fix the bug.\n2. Add a regression test.";
    const { items, doc } = planFromSession(
      [],
      [
        { kind: "text", text: older },
        { kind: "you", text: "revise" },
        { kind: "text", text: newer },
      ],
    );
    expect(items.map((i) => i.text)).toEqual(["Fix the bug.", "Add a regression test."]);
    expect(doc?.markdown).toBe(newer);
  });
});
