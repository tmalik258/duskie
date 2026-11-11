// UI sounds from SND (https://snd.dev/), professionally designed interface
// sound kits by Dentsu Inc. and Starryworks Inc. Free to use; copyright of
// the audio stays with the credited sound designers. Each kit is one audio
// sprite (copied into public/sounds by scripts/sync-sounds.mjs), decoded
// once and sliced per sound in Rust (crates/voice/src/fx). If a kit cannot
// load, a quiet synthesized tone plays instead so feedback never disappears.

import { playMood, playSfx, playSound } from "./sound/play-mood";
import { CUE_SOUND, SYNTH_CUE, SYNTH_KIT } from "./sound/snd-sound";
import type { Cue } from "./types";

export function playCue(cue: Cue, volume: number, kitId: string): void {
  // Settle is a machine powering on, synthesized in Rust for every kit.
  if (cue === "settle") {
    playSfx("settle", "settle", kitId, volume);
    return;
  }
  if (kitId === SYNTH_KIT) {
    const sound = SYNTH_CUE[cue];
    if (sound) playMood(sound, volume, kitId);
    return;
  }
  playSound(CUE_SOUND[cue], volume, kitId);
}
