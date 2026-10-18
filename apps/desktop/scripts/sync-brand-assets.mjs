// Syncs app-icon.png into repo / extension / Next favicon sizes, and draws
// assets/social-preview.png (1280×640) with the mascot + "Duskie" wordmark.
// Requires Windows (System.Drawing). Run from apps/desktop:
//   node scripts/make-icon.mjs && node scripts/sync-brand-assets.mjs
import { copyFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

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

# Social preview: dark field, mascot left, Duskie wordmark right.
$w = 1280; $h = 640
$social = ${JSON.stringify(join(root, "assets", "social-preview.png"))}
$bmp = New-Object System.Drawing.Bitmap $w, $h
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
$g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
$g.Clear([System.Drawing.Color]::FromArgb(255, 10, 10, 12))

# Soft radial glow behind the face.
$glowBrush = New-Object System.Drawing.Drawing2D.PathGradientBrush (
  ,(
    [System.Drawing.Point]::new(220, 120),
    [System.Drawing.Point]::new(540, 120),
    [System.Drawing.Point]::new(540, 520),
    [System.Drawing.Point]::new(220, 520)
  )
)
$glowBrush.CenterPoint = New-Object System.Drawing.PointF 380, 320
$glowBrush.CenterColor = [System.Drawing.Color]::FromArgb(70, 255, 231, 184)
$glowBrush.SurroundColors = @([System.Drawing.Color]::FromArgb(0, 10, 10, 12))
$g.FillEllipse($glowBrush, 200, 100, 360, 420)
$glowBrush.Dispose()

$face = 360
$g.DrawImage($srcImg, [int](380 - $face/2), [int](320 - $face/2), $face, $face)

$font = New-Object System.Drawing.Font 'Segoe UI Semibold', 72, ([System.Drawing.FontStyle]::Bold)
$brush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 245, 240, 230))
$dim = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(180, 180, 170, 155))
$g.DrawString('Duskie', $font, $brush, 620, 230)
$sub = New-Object System.Drawing.Font 'Segoe UI', 22, ([System.Drawing.FontStyle]::Regular)
$g.DrawString('A proactive desktop companion', $sub, $dim, 628, 330)

$bmp.Save($social, [System.Drawing.Imaging.ImageFormat]::Png)
$g.Dispose(); $bmp.Dispose(); $font.Dispose(); $sub.Dispose(); $brush.Dispose(); $dim.Dispose()
$srcImg.Dispose()
Write-Host "wrote $social"
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
