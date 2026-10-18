import { expect, test } from "@playwright/test";
import { openLive, openSettings } from "./helpers";

test.describe("settings parity", () => {
  test("settings shell width matches prototype (~660px)", async ({ page }) => {
    await openLive(page);
    await openSettings(page);

    const width = await page
      .locator(".island-shell")
      .first()
      .evaluate((el) => el.getBoundingClientRect().width);
    expect(width).toBeGreaterThanOrEqual(640);
    expect(width).toBeLessThanOrEqual(680);
  });
});
