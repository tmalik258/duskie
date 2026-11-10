// Syncs app-icon.png into repo / extension / Next favicon sizes.
// The social preview is rendered separately from assets/social-preview.html by
// scripts/export-social-preview.mjs. Requires Windows (System.Drawing). Run from apps/desktop:
//   node scripts/make-icon.mjs && node scripts/sync-brand-assets.mjs

import { spawnSync } from "node:child_process";
import { copyFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const desktop = join(here, "..");
const root = join(desktop, "..", "..");
const src = join(desktop, "app-icon.png");
const tauri = join(desktop, "src-tauri", "icons");

const jobs = [
  { out: join(root, "assets", "icon.png"), size: 512 },
  { out: join(desktop, "src", "app", "icon.png"), size: 256 },
  { out: join(root, "apps", "extension", "icons", "32.png"), size: 32 },
  { out: join(root, "apps", "extension", "icons", "128.png"), size: 128 },
];

// Prefer Tauri-generated sizes when they match exactly.
copyFileSync(join(tauri, "32x32.png"), join(root, "apps", "extension", "icons", "32.png"));
copyFileSync(join(tauri, "128x128.png"), join(root, "apps", "extension", "icons", "128.png"));

const ps = `
Add-Type -AssemblyName System.Drawing
$ErrorActionPreference = 'Stop'
$src = ${JSON.stringify(src)}
$srcImg = [System.Drawing.Image]::FromFile($src)

function Save-Resized([string]$path, [int]$size) {
  $dir = Split-Path $path -Parent
  if (!(Test-Path $dir)) { New-Item -ItemType Directory -Path $dir | Out-Null }
  $bmp = New-Object System.Drawing.Bitmap $size, $size
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
  $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  $g.Clear([System.Drawing.Color]::Transparent)
  $g.DrawImage($srcImg, 0, 0, $size, $size)
  $bmp.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
  $g.Dispose(); $bmp.Dispose()
  Write-Host "wrote $path ($size)"
}

Save-Resized ${JSON.stringify(jobs[0].out)} 512
Save-Resized ${JSON.stringify(jobs[1].out)} 256

$srcImg.Dispose()
`;

const r = spawnSync("powershell.exe", ["-NoProfile", "-Command", ps], {
  encoding: "utf8",
  maxBuffer: 10 * 1024 * 1024,
});
if (r.stdout) process.stdout.write(r.stdout);
if (r.stderr) process.stderr.write(r.stderr);
if (r.status !== 0) process.exit(r.status ?? 1);

mkdirSync(dirname(join(desktop, "src", "app", "icon.png")), { recursive: true });
console.log("brand assets synced");
