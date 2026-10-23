import { describe, expect, it } from "vitest";
import { wordWindows } from "./spoken-caption";

describe("wordWindows", () => {
  it("keeps short lines whole", () => {
    expect(wordWindows("Yes.")).toEqual(["Yes."]);
    expect(wordWindows("a b c")).toEqual(["a b c"]);
  });

  it("splits into groups of three", () => {
    expect(wordWindows("one two three four five six seven")).toEqual(["one two three", "four five six", "seven"]);
  });
});
