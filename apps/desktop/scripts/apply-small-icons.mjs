// After `pnpm tauri icon`, overwrite small PNGs from the 120px full-body
// capture so tray/extension sizes are not clipped bust crops or muddy
// downscales of the large photo.
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const desktop = join(here, "..");
const r = spawnSync(
  "python",
  [join(here, "render-small-icons.py"), join(desktop, "mascot-120.png")],
  { encoding: "utf8", cwd: desktop },
);
if (r.stdout) process.stdout.write(r.stdout);
if (r.stderr) process.stderr.write(r.stderr);
process.exit(r.status ?? 1);
