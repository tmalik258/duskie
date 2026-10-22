// Part of sound: playMood, playSound.

import { playSynth, type SynthSound } from "../synth";
import { audio, fallbackTone, loadKit, SND_FOR, type SndSound, SYNTH_FOR, SYNTH_KIT } from "./snd-sound";

/** A mascot sound (hello, sparkle, mwah...): its own voice in the Duskie
 * kit, the closest designed sound otherwise. */
export function playMood(sound: SynthSound, volume: number, kitId: string): void {
  if (volume <= 0 || typeof window === "undefined") return;
  if (kitId === SYNTH_KIT) {
    const { ac, out } = audio();
    playSynth(ac, out, sound, volume);
    return;
  }
  const snd = SND_FOR[sound];
  if (snd) playSound(snd, volume, kitId);
}

/** Plays one sound from a kit. Used for cues and for chip presses. */
export function playSound(sound: SndSound, volume: number, kitId: string): void {
  if (volume <= 0 || typeof window === "undefined") return;
  if (kitId === SYNTH_KIT) {
    playMood(SYNTH_FOR[sound], volume, kitId);
    return;
  }
  void loadKit(kitId).then((kit) => {
    const { ac, out } = audio();
    const slice = kit?.map[sound];
    if (!kit || !slice) return fallbackTone(ac, out, volume);
    const src = ac.createBufferSource();
    const gain = ac.createGain();
    src.buffer = kit.buffer;
    gain.gain.value = volume;
    src.connect(gain).connect(out);
    src.start(0, slice.start, slice.end - slice.start);
  });
}
