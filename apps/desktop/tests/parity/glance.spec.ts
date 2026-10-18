import { expect, test } from "@playwright/test";
import { contract, diff, openLive, openPrototype } from "./helpers";

test.describe("glance parity", () => {
  test("creature is full-body at idle", async ({ page }) => {
    await openLive(page);
    const bust = await page.evaluate(() => {
      // Headless may fall back to `.creature-still` when WebGL 2 is unavailable.
      const c = document.querySelector(".creature, .creature-still");
      if (!c) return "no-creature";
      const style = getComputedStyle(c);
      return style.maskImage !== "none" && style.maskImage !== "" ? "bust-mask" : "ok";
    });
    expect(bust).toBe("ok");
    const size = await page.evaluate(() => {
      const c = document.querySelector(".creature, .creature-still");
      return c ? { w: c.getBoundingClientRect().width, h: c.getBoundingClientRect().height } : null;
    });
    expect(size).not.toBeNull();
    if (size) {
      expect(size.w).toBeGreaterThanOrEqual(40);
      expect(size.h).toBeGreaterThanOrEqual(40);
    }
  });

  test("glance structure and style contracts when prototype selectors exist", async ({ page, context }) => {
    await openLive(page);
    await page.mouse.move(640, 40);
    await page.waitForTimeout(700);

    await expect(page.locator(".rd-glance, .rd-card-head").first()).toBeVisible({ timeout: 10_000 });

    const row = page.locator(".rd-list-row").first();
    if ((await row.count()) > 0) {
      const minH = await row.evaluate((el) => getComputedStyle(el).minHeight);
      expect(Number.parseFloat(minH)).toBeGreaterThanOrEqual(40);
    }

    const protoPage = await context.newPage();
    try {
      await openPrototype(protoPage, "island");
      await protoPage
        .getByRole("button", { name: /glance/i })
        .first()
        .click({ timeout: 5_000 })
        .catch(() => {});
      await protoPage.waitForTimeout(400);

      const props = ["fontSize", "fontWeight", "paddingTop", "paddingBottom", "borderRadius", "minHeight"];
      const pairs: [string, string][] = [
        [".rd-title", ".rd-title"],
        [".rd-list-row", ".rd-list-row"],
        [".rd-qb", ".rd-qb"],
      ];
      for (const [protoSel, liveSel] of pairs) {
        const proto = protoPage.locator(protoSel);
        const live = page.locator(liveSel);
        if ((await proto.count()) === 0 || (await live.count()) === 0) continue;
        await contract(proto, live, props);
      }

      const protoCard = protoPage.locator(".rd-glance, .island-card").first();
      const liveCard = page.locator(".rd-glance, .island-card").first();
      if ((await protoCard.count()) > 0 && (await liveCard.count()) > 0) {
        await diff(protoCard, liveCard, "glance-card");
      }
    } finally {
      await protoPage.close();
    }

    const glass = await page.evaluate(() => {
      const shell = document.querySelector(".island-shell");
      if (!shell) return 0;
      return [...shell.querySelectorAll("*")].filter((el) => {
        const cls = typeof el.className === "string" ? el.className : "";
        return /\bbg-white(?:\/|\b)/.test(cls);
      }).length;
    });
    expect(glass).toBe(0);
  });
});
