import { describe, expect, it } from "vitest";
import { followUp } from "./follow-up";

const asked = { role: "user", content: "why is Cursor not updating?" };

describe("follow-ups", () => {
  it("do it runs the top offer that has not run yet", () => {
    const answer = {
      role: "assistant",
      content: "Its updater is stuck.",
      proposals: [{ id: "a", ran: {} }, { id: "b" }],
    };
    expect(followUp("do it", [asked, answer])).toEqual({ kind: "run", id: "b" });
    expect(followUp("Okay, fix it!", [asked, answer])).toEqual({ kind: "run", id: "b" });
  });

  it("do it picks the top option when there is no button", () => {
    const answer = { role: "assistant", content: "Its updater is stuck.\nOPTION: Restart Cursor\nOPTION: Update it" };
    expect(followUp("go ahead", [asked, answer])).toEqual({ kind: "send", text: "Restart Cursor" });
  });

  it("is it fixed now checks the last question again", () => {
    const answer = { role: "assistant", content: "Done." };
    const done = { role: "user", content: "do it" };
    expect(followUp("is it fixed now?", [asked, answer, done, answer])).toEqual({
      kind: "send",
      text: "Check again now, from scratch: why is Cursor not updating?",
    });
  });

  it("leaves other questions alone", () => {
    expect(followUp("do it tomorrow at 5", [asked])).toBeNull();
    expect(followUp("what is the weather", [asked])).toBeNull();
  });
});
