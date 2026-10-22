import { expect, test } from "@playwright/test";
import { openAsk, openLive } from "./helpers";

test.describe("ask parity", () => {
  test("composer on top, natural height, send chrome, larger orb", async ({ page }) => {
    await openLive(page);
    await openAsk(page);

    const composer = page.locator(".ak-field").first();
    await expect(composer).toBeVisible({ timeout: 15_000 });

    const input = composer.locator("input.ak-q, textarea.ak-q").first();
    await input.fill("parity draft text");
    await page.waitForTimeout(400);
    await expect(input).toHaveValue(/parity draft/);

    await page.keyboard.press("Escape");
    await page.waitForTimeout(400);
    await openAsk(page);

    const composerAgain = page.locator(".ak-field").first();
    const inputAgain = composerAgain.locator("input.ak-q, textarea.ak-q").first();
    await expect(inputAgain).toHaveValue(/parity draft/);

    const boxed = await composerAgain.evaluate((el) => {
      const s = getComputedStyle(el);
      return {
        radius: Number.parseFloat(s.borderRadius),
        bg: s.backgroundColor,
      };
    });
    expect(boxed.radius).toBeGreaterThanOrEqual(10);
    expect(boxed.bg === "rgba(0, 0, 0, 0)" || boxed.bg === "transparent").toBe(false);

    await expect(page.locator(".ak-send").first()).toBeVisible();

    await inputAgain.fill("/");
    await page.waitForTimeout(500);

    const scroll = page.locator(".ak-scroll").first();
    await expect(scroll).toBeVisible({ timeout: 10_000 });
    const scrollCss = await scroll.evaluate((el) => ({
      height: el.style.height,
      maxHeight: el.style.maxHeight,
    }));
    expect(scrollCss.height).toBe("");
    expect(scrollCss.maxHeight).toMatch(/\d+px/);

    const composerBox = await composerAgain.boundingBox();
    const scrollBox = await scroll.boundingBox();
    expect(composerBox).not.toBeNull();
    expect(scrollBox).not.toBeNull();
    if (composerBox && scrollBox) {
      expect(composerBox.y).toBeLessThan(scrollBox.y);
    }

    const creature = page.locator(".creature, .creature-still").first();
    await expect(creature).toBeVisible({ timeout: 10_000 });
    const size = await creature.evaluate((el) => {
      const r = el.getBoundingClientRect();
      return { w: r.width, h: r.height };
    });
    expect(size.w).toBeGreaterThanOrEqual(40);
    expect(size.h).toBeGreaterThanOrEqual(40);
  });
});
