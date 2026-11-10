import { describe, expect, it } from "vitest";
import { agoText, clockText, minutesText } from "./time-text";

describe("minutesText", () => {
  it("keeps each caller's style", () => {
    expect(minutesText(0.2, { suffix: true, justNow: "just now" })).toBe("just now");
    expect(minutesText(5, { suffix: true })).toBe("5 min ago");
    expect(minutesText(0, { atLeastOne: true })).toBe("1 min");
    expect(minutesText(60 * 50, { days: true })).toBe("2 d");
    expect(minutesText(60 * 50)).toBe("50 h");
    expect(minutesText(119, { floorHours: true })).toBe("1 h");
    expect(minutesText(0.4, { justNow: "now" })).toBe("now");
  });
  it("measures from a moment", () => {
    expect(agoText(0, {}, 10 * 60_000)).toBe("10 min");
  });
});

describe("clockText", () => {
  it("formats minutes and seconds", () => {
    expect(clockText(72_500)).toBe("1:12");
    expect(clockText(-5)).toBe("0:00");
  });
});
