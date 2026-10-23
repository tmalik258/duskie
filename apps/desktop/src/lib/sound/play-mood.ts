// Part of sound: playMood, playSound. Every sound plays from Duskie's own
// process (play_sfx), not the WebView, so Windows lists one "Duskie" in the
// volume mixer and the sounds follow the same speaker as the voice.

import { invoke } from "../bridge/invoke";
import type { SynthSound } from "../synth";
import { SND_FOR, type SndSound, SYNTH_FOR, SYNTH_KIT } from "./snd-sound";

/** Plays a sound in Rust; a sound that fails is only logged. */
export function playSfx(kind: "synth" | "settle" | "kit", name: string, kit: string, volume: number): void {
  if (volume <= 0 || typeof window === "undefined") return;
  invoke<void>("play_sfx", { kind, name, kit, volume }).catch((e) => console.warn("sound", name, e));
}

/** A mascot sound (hello, sparkle, mwah...): its own voice in the Duskie
 * kit, the closest designed sound otherwise. */
export function playMood(sound: SynthSound, volume: number, kitId: string): void {
  if (kitId === SYNTH_KIT) {
    playSfx("synth", sound, kitId, volume);
    return;
  }
  const snd = SND_FOR[sound];
  if (snd) playSound(snd, volume, kitId);
}

/** Plays one sound from a kit. Used for cues and for chip presses. */
export function playSound(sound: SndSound, volume: number, kitId: string): void {
  if (kitId === SYNTH_KIT) {
    playSfx("synth", SYNTH_FOR[sound], kitId, volume);
    return;
  }
  playSfx("kit", sound, kitId, volume);
}
