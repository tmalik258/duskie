import { expect, test } from "@playwright/test";
import { contract, openGitDock, openLive, openPrototype } from "./helpers";

test.describe("git dock parity", () => {
  test("git dock opens with bar and tabs", async ({ page, context }) => {
    await openLive(page, "git");
    await openGitDock(page);

    await expect(page.locator(".gwin").first()).toBeVisible();
    await expect(page.locator(".gbar").first()).toBeVisible();
    await expect(page.locator(".gtabs").first()).toBeVisible();

    const protoPage = await context.newPage();
    try {
      await openPrototype(protoPage, "git");
      const barProto = protoPage.locator(".gbar").first();
      const barLive = page.locator(".gbar").first();
      if ((await barProto.count()) > 0 && (await barLive.count()) > 0) {
        await contract(barProto, barLive, ["height", "borderRadius"]);
      }
    } finally {
      await protoPage.close();
    }
  });
});
