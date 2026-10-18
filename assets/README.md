# Assets

Images for the repository: `icon.png` (the app icon, the Duskie creature) and
`social-preview.png` (the GitHub social preview, 1280 by 640).

Regenerate from the live full-body mascot in
`docs/internal/Sidekick Mascot Prototype.html` (sizes section **120 px** —
do not use the smaller bust crops):

```bash
cd apps/desktop
node scripts/make-icon.mjs
pnpm tauri icon app-icon.png
node scripts/apply-small-icons.mjs
node scripts/sync-brand-assets.mjs
```

The live face in the app is the WebGL creature (`apps/desktop/src/components/Creature.tsx`);
sounds come from the SND kits (`snd-lib` on npm, see the README credits).
