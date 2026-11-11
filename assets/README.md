# Assets

Images for the repository: `icon.png` (the app icon, the Duskie creature) and
`social-preview.png` (the GitHub social preview, 1280 by 640).

Regenerate from the live full-body mascot in
`docs/internal/Duskie Mascot Prototype.html` (sizes section **120 px** -
do not use the smaller bust crops):

```bash
cd apps/desktop
node scripts/make-icon.mjs
pnpm tauri icon app-icon.png
node scripts/apply-small-icons.mjs
node scripts/sync-brand-assets.mjs
node scripts/export-social-preview.mjs
```

The social preview is `social-preview.html` (edit that, then export it to `social-preview.png`
with the last command; it renders through headless Edge or Chrome).

The live face in the app is the WebGL creature (`apps/desktop/src/components/creature.tsx`);
sounds come from the SND kits (`snd-lib` on npm, see the README credits).
