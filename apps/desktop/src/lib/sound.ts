// UI sounds from SND (https://snd.dev/), professionally designed interface
// sound kits by Dentsu Inc. and Starryworks Inc. Free to use; copyright of
// the audio stays with the credited sound designers. Each kit is one audio
// sprite (copied into public/sounds by scripts/sync-sounds.mjs) decoded once
// and sliced per sound. If a kit cannot load, a quiet synthesized tone is
// used instead so feedback never disappears.

import { playMood, playSound } from "./sound/play-mood";
import { audio, CUE_SOUND, SYNTH_CUE, SYNTH_KIT } from "./sound/snd-sound";
import type { Cue } from "./types";

export function playCue(cue: Cue, volume: number, kitId: string): void {
  if (cue === "settle") {
    if (volume > 0 && typeof window !== "undefined") {
      const { ac, out } = audio();
      powerUp(ac, out, volume);
    }
    return;
  }
  if (kitId === SYNTH_KIT) {
    const sound = SYNTH_CUE[cue];
    if (sound) playMood(sound, volume, kitId);
    return;
  }
  playSound(CUE_SOUND[cue], volume, kitId);
}

/**
 * A machine powering on, kept short and quiet: a low hum spins up through an
 * opening filter, a faint FM shimmer climbs over it, and one soft ping lands
 * at the end. Fully synthesized, so it needs no kit and stays original.
 */
function powerUp(ac: AudioContext, out: AudioNode, volume: number) {
  const t = ac.currentTime;
  const peak = Math.max(0.1 * volume, 0.0002);
  const master = ac.createGain();
  master.gain.setValueAtTime(0.0001, t);
  master.gain.exponentialRampToValueAtTime(peak, t + 0.05);
  master.gain.setValueAtTime(peak, t + 0.2);
  master.gain.exponentialRampToValueAtTime(0.0001, t + 0.38);
  master.connect(out);

  // Hum: two detuned saws sweeping up, the filter opening as they rise.
  const filter = ac.createBiquadFilter();
  filter.type = "lowpass";
  filter.Q.value = 5;
  filter.frequency.setValueAtTime(260, t);
  filter.frequency.exponentialRampToValueAtTime(2200, t + 0.24);
  filter.connect(master);
  for (const detune of [-9, 9]) {
    const saw = ac.createOscillator();
    saw.type = "sawtooth";
    saw.detune.value = detune;
    saw.frequency.setValueAtTime(90, t);
    saw.frequency.exponentialRampToValueAtTime(260, t + 0.24);
    saw.connect(filter);
    saw.start(t);
    saw.stop(t + 0.4);
  }

  // Shimmer: FM with a fast modulator gives the metallic, alien edge.
  const carrier = ac.createOscillator();
  const mod = ac.createOscillator();
  const depth = ac.createGain();
  const shimmer = ac.createGain();
  carrier.type = "sine";
  carrier.frequency.setValueAtTime(520, t);
  carrier.frequency.exponentialRampToValueAtTime(1320, t + 0.24);
  mod.type = "sine";
  mod.frequency.setValueAtTime(110, t);
  mod.frequency.exponentialRampToValueAtTime(340, t + 0.24);
  depth.gain.setValueAtTime(100, t);
  depth.gain.linearRampToValueAtTime(320, t + 0.24);
  shimmer.gain.value = 0.25;
  mod.connect(depth).connect(carrier.frequency);
  carrier.connect(shimmer).connect(master);
  for (const o of [carrier, mod]) {
    o.start(t);
    o.stop(t + 0.4);
  }

  // Ready ping once the machine is up.
  const ping = ac.createOscillator();
  const amp = ac.createGain();
  ping.type = "triangle";
  ping.frequency.value = 1760;
  amp.gain.setValueAtTime(0.0001, t + 0.2);
  amp.gain.exponentialRampToValueAtTime(0.35, t + 0.21);
  amp.gain.exponentialRampToValueAtTime(0.0001, t + 0.34);
  ping.connect(amp).connect(master);
  ping.start(t + 0.2);
  ping.stop(t + 0.38);
}
