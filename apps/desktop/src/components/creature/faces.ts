// @ts-nocheck
// biome-ignore-all lint: ported as is from the Mascot Lab prototype; keep the two in step.

// ---------- Faces (shader units) ----------
// The app's eye shapes, exactly as in the current orb (20 x 30 box).
export const APP_EYES = {
  pill: '<rect x="5" y="3" width="10" height="24" rx="5"/>',
  wide: '<rect x="3.5" y="1" width="13" height="28" rx="6.5"/><circle class="gl" cx="12.4" cy="7.2" r="2.2"/>',
  big: '<rect x="4" y="2" width="12" height="26" rx="6"/>',
  small: '<rect x="6" y="9" width="8" height="15" rx="4"/>',
  half: '<rect x="5" y="14" width="10" height="11" rx="5"/>',
  focus: '<rect x="4" y="11" width="12" height="9" rx="4.5"/>',
  closed: '<path class="ln" d="M4 16 Q10 19 16 16" stroke-width="3"/>',
  happy: '<path class="ln" d="M4 18.5 Q10 8.5 16 18.5" stroke-width="3.4"/>',
  dot: '<circle cx="10" cy="16" r="3.8"/>',
  squintL: '<path class="ln" d="M5.5 10 L14.5 15 L5.5 20" stroke-width="3.2"/>',
  squintR: '<path class="ln" d="M14.5 10 L5.5 15 L14.5 20" stroke-width="3.2"/>',
  worriedL: '<path d="M5 12 L15 8.5 L15 23 a5 5 0 0 1 -10 0 Z"/>',
  worriedR: '<path d="M15 12 L5 8.5 L5 23 a5 5 0 0 0 10 0 Z"/>',
  sleepyL: '<path d="M5 17.6 L15 15.4 L15 21 a5 5 0 0 1 -10 0 Z"/>',
  sleepyR: '<path d="M5 15.4 L15 17.6 L15 21 a5 5 0 0 1 -10 0 Z"/>',
  yawnL: '<path class="ln" d="M3.5 17 Q10 12.5 16.5 15.5" stroke-width="3.4"/>',
  yawnR: '<path class="ln" d="M3.5 15.5 Q10 12.5 16.5 17" stroke-width="3.4"/>',
};
// Eye ink and glow per fur, as in the app's themes.
export const EYE_INK = {
  atelier: ["#fff3dc", "255 206 140", 0.95],
  onyx: ["#ffffff", "205 225 255", 0.9],
  pearl: ["#1c1c1e", "0 0 0", 0],
  aurora: ["#1b1630", "0 0 0", 0],
  chrome: ["#0f1116", "0 0 0", 0],
  peach: ["#3a1716", "0 0 0", 0],
  mint: ["#0e2a23", "0 0 0", 0],
  lilac: ["#1d1440", "0 0 0", 0],
};
export const E = {
  pill: [0, 0.064, 0.108, 0],
  wide: [0, 0.075, 0.124, 0],
  big: [0, 0.07, 0.116, 0],
  small: [0, 0.048, 0.08, 0],
  half: [0, 0.066, 0.104, 0],
  focus: [0, 0.07, 0.045, 0],
  dot: [0, 0.045, 0.05, 0],
  worriedL: [0, 0.064, 0.108, 0.55],
  worriedR: [0, 0.064, 0.108, 0.55],
  happy: [1, 0, 0.025, 0.085],
  closed: [2, 0, 0.022, 0.095],
  squintL: [3, 0, 0.02, 0],
  squintR: [3, 0, 0.02, 0],
};
export const LID = { half: 0.012, worriedL: 0.05, worriedR: 0.05 };
export const M = {
  none: [0, 0, 0],
  smile: [1, 0.08, 0.02],
  grin: [2, 0.09, 0.07],
  o: [3, 0.042, 0.052],
  small: [3, 0.034, 0.024],
  flat: [4, 0.055, 0.018],
  frown: [5, 0.075, 0.02],
  cat: [6, 0.1, 0.018],
  talk: [3, 0.07, 0.085],
};
export const AI = "#d6a8ff";
// Arm poses: [left, right], each a point the paw reaches toward in the creature's own space,
// [x, y, z], with x pointing away from the body on that side and z toward you.
// Only the direction matters: the arm points from the shoulder toward that point.
export const REST = [0.9, -0.48, 0.14];
export const both = (a) => [a, a];
export const ARMS = {
  rest: both(REST),
  out: both([1.0, -0.06, 0.3]),
  in: both([0.4, -0.3, 0.75]),
  up: both([0.84, 0.66, 0.2]),
  ear: [REST, [0.66, 0.6, 0.18]],
  chin: [REST, [0.12, -0.08, 0.9]],
  wave: [REST, [0.92, 0.56, 0.24]],
  shy: both([0.3, -0.16, 0.9]),
  pillow: [
    [0.12, 0.3, 0.9],
    [-0.02, 0.24, 0.9],
  ],
};
