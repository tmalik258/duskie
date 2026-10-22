// Renders assets/social-preview.html to assets/social-preview.png (1280x640) with
// headless Edge (or Chrome). Windows only. Run from apps/desktop:
//   node scripts/export-social-preview.mjs

import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..", "..", "..");
const html = join(root, "assets", "social-preview.html");
const out = join(root, "assets", "social-preview.png");

const browsers = [
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
];
const browser = browsers.find((p) => existsSync(p));
if (!browser) {
  console.error("No Edge or Chrome found to render the social preview.");
  process.exit(1);
}

const r = spawnSync(
  browser,
  [
    "--headless=new",
    "--disable-gpu",
    "--hide-scrollbars",
    "--force-device-scale-factor=1",
    "--window-size=1280,640",
    "--default-background-color=0a0a0cff",
    `--screenshot=${out}`,
    pathToFileURL(html).href,
  ],
  { encoding: "utf8", timeout: 60000 },
);
if (r.error) {
  console.error(r.error.message);
  process.exit(1);
}
if (r.status !== 0 || !existsSync(out)) {
  process.stderr.write(r.stderr ?? "");
  process.exit(r.status ?? 1);
}
console.log(`wrote ${out} (1280x640)`);
