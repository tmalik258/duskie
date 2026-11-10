import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { expect, type Locator, type Page } from "@playwright/test";

/** Parity runs with cwd = apps/desktop. */
const DESKTOP_ROOT = process.cwd();
export const PARITY_DIR = join(DESKTOP_ROOT, ".parity");
const PROTO_HTML = join(DESKTOP_ROOT, "../../docs/internal/Duskie Island Redesign.html");

mkdirSync(PARITY_DIR, { recursive: true });

function fileUrl(path: string) {
  const normalized = path.replace(/\\/g, "/");
  if (/^[A-Za-z]:/.test(normalized)) {
    return `file:///${normalized}`;
  }
  return `file://${normalized}`;
}

export async function openLive(page: Page, query?: string) {
  const q = query ? (query.startsWith("&") ? query : `&${query}`) : "";
  await page.goto(`http://localhost:3002/island/?onboarded&color=atelier${q}`, {
    waitUntil: "domcontentloaded",
    timeout: 120_000,
  });
  await page.locator(".island-shell").first().waitFor({ state: "attached", timeout: 120_000 });
  await page.waitForTimeout(600);
}

export async function openPrototype(page: Page, view?: string) {
  await page.goto(fileUrl(PROTO_HTML), { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.waitForTimeout(400);
  if (view) {
    await page.evaluate((v) => {
      const w = window as Window & { show?: (name: string) => void; openGit?: () => void };
      if (v === "git" && w.openGit) w.openGit();
      else w.show?.(v);
    }, view);
    await page.waitForTimeout(400);
  }
}

type StyleNums = Record<string, number>;

async function styleNums(el: Locator, props: string[]): Promise<StyleNums | null> {
  if ((await el.count()) === 0) return null;
  return el.first().evaluate((node, keys) => {
    const s = getComputedStyle(node);
    const out: Record<string, number> = {};
    for (const key of keys) {
      const raw = s[key as keyof CSSStyleDeclaration];
      const n = Number.parseFloat(String(raw));
      out[key] = Number.isFinite(n) ? n : 0;
    }
    return out;
  }, props);
}

/** Compare numeric computed-style props within 0.5px. */
export async function contract(protoEl: Locator, liveEl: Locator, props: string[]) {
  const proto = await styleNums(protoEl, props);
  const live = await styleNums(liveEl, props);
  if (!proto || !live) return;
  for (const key of props) {
    expect(Math.abs((proto[key] ?? 0) - (live[key] ?? 0)), `${key} proto vs live`).toBeLessThanOrEqual(0.5);
  }
}

/** Screenshot both locators, pixelmatch, fail if >2% mismatched; write diff to `.parity/`. */
export async function diff(protoLocator: Locator, liveLocator: Locator, name: string) {
  const [{ default: pixelmatch }, { PNG }] = await Promise.all([import("pixelmatch"), import("pngjs")]);

  const protoPath = join(PARITY_DIR, `${name}-proto.png`);
  const livePath = join(PARITY_DIR, `${name}-live.png`);
  const diffPath = join(PARITY_DIR, `${name}-diff.png`);

  await protoLocator.first().screenshot({ path: protoPath });
  await liveLocator.first().screenshot({ path: livePath });

  const a = PNG.sync.read(await protoLocator.first().screenshot());
  const b = PNG.sync.read(await liveLocator.first().screenshot());
  const w = Math.min(a.width, b.width);
  const h = Math.min(a.height, b.height);
  const out = new PNG({ width: w, height: h });
  const mismatched = pixelmatch(a.data, b.data, out.data, w, h, { threshold: 0.1 });
  writeFileSync(diffPath, PNG.sync.write(out));
  const ratio = mismatched / (w * h);
  expect(ratio, `${name} pixel mismatch`).toBeLessThanOrEqual(0.02);
}

export async function openAsk(page: Page) {
  await page.evaluate(() => {
    const w = window as Window & { __mockCall?: (name: string, args?: Record<string, unknown>) => unknown };
    w.__mockCall?.("ask_open");
  });
  await page.locator(".ak").first().waitFor({ state: "visible", timeout: 15_000 });
}

export async function openSettings(page: Page) {
  await page.evaluate(() => {
    const w = window as Window & { __mockCall?: (name: string) => unknown };
    w.__mockCall?.("open_settings");
  });
  await page.locator(".island-settings").first().waitFor({ state: "visible", timeout: 15_000 });
}

export async function openGitDock(page: Page) {
  await openAsk(page);
  const input = page.locator(".ak-q").first();
  if ((await input.count()) > 0) await input.focus();
  await page.keyboard.press("Control+g");
  const dock = page.locator(".gwin").first();
  try {
    await dock.waitFor({ state: "visible", timeout: 8_000 });
  } catch {
    // Fallback when the global shortcut isn't bound in the browser mock.
    await page
      .getByRole("button", { name: /open git|git/i })
      .first()
      .click({ timeout: 5_000 })
      .catch(() => {});
    await dock.waitFor({ state: "visible", timeout: 20_000 });
  }
}
