// Captures the full-body mascot at 120px — same mode as the prototype
// sizes section (bust:false). HTML sizes <40 are clipped bust crops; ignore them.
// Also captures 512px for the large app icon. Eyes are SVG overlays, so we
// screenshot the whole .mz node, not the WebGL canvas alone.
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { chromium } from "playwright";

const here = dirname(fileURLToPath(import.meta.url));
const srcHtml = join(here, "../../../docs/internal/Duskie Mascot Prototype.html");
const out120 = join(here, "../mascot-120.png");
const out512 = join(here, "../mascot-512.png");

const html = readFileSync(srcHtml, "utf8").replace(
  "window.__ready = true;",
  "window.Mascot = Mascot; window.__ready = true;",
);
const tmp = join(mkdtempSync(join(tmpdir(), "duskie-mascot-")), "proto.html");
writeFileSync(tmp, html);

const browser = await chromium.launch({
  headless: false,
  args: ["--use-gl=angle", "--enable-webgl", "--ignore-gpu-blocklist"],
});
const page = await browser.newPage({
  viewport: { width: 1200, height: 900 },
  deviceScaleFactor: 2,
});
await page.goto(pathToFileURL(tmp).href, { waitUntil: "load", timeout: 60_000 });
await page.waitForFunction(() => window.__ready === true && !!window.Mascot, null, {
  timeout: 60_000,
});

async function render(size, path) {
  const id = `cap-${size}`;
  await page.evaluate(
    ({ id, size }) => {
      document.getElementById(id)?.remove();
      const host = document.createElement("div");
      host.id = id;
      host.style.cssText = `position:fixed;left:24px;top:24px;width:${size}px;height:${size}px;z-index:99999;background:#08080a;`;
      document.body.appendChild(host);
      // Match sizes-section 120px: follow/blink off, full body (not bust).
      new window.Mascot(host, { size, follow: false, blink: false, bust: false });
    },
    { id, size },
  );
  const mz = page.locator(`#${id} .mz`).first();
  await mz.waitFor({ state: "visible", timeout: 30_000 });
  await page.waitForFunction(
    (el) => {
      const eye = el?.querySelector(".mz-eye");
      if (!eye) return false;
      const c = getComputedStyle(eye).color;
      return !!c && c !== "rgba(0, 0, 0, 0)";
    },
    await mz.elementHandle(),
    { timeout: 30_000 },
  );
  await page.waitForTimeout(800);
  await mz.screenshot({ path, omitBackground: false, animations: "disabled" });
  console.log("wrote", path, `${size}px full-body`);
  await page.evaluate((id) => document.getElementById(id)?.remove(), id);
}

await render(120, out120);
await render(512, out512);
await browser.close();
