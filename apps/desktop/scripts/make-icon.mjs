// Builds app-icon.png from the live full-body mascot in
// docs/internal/Sidekick Mascot Prototype.html.
// Uses the sizes-section 120px mode (full body). Never use HTML sizes <40
// (those are clipped bust crops).
//
//   node scripts/make-icon.mjs
//   pnpm tauri icon app-icon.png
//   node scripts/apply-small-icons.mjs   # overwrite 32/64/128 from 120px
//   node scripts/sync-brand-assets.mjs
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const desktop = join(here, "..");

function run(cmd, args) {
  const r = spawnSync(cmd, args, { encoding: "utf8", cwd: desktop, shell: false });
  if (r.stdout) process.stdout.write(r.stdout);
  if (r.stderr) process.stderr.write(r.stderr);
  if (r.status !== 0) process.exit(r.status ?? 1);
}

run("node", [join(here, "capture-mascot-120.mjs")]);
run("python", [
  join(here, "render-app-icon.py"),
  join(desktop, "mascot-512.png"),
  join(desktop, "app-icon.png"),
]);
