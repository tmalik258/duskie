// Part of sound: SndSound, CUE_SOUND, SYNTH_KIT, SYNTH_CUE, SYNTH_FOR, SND_FOR, checkKit, preloadSounds, cueVolume.

import { invoke } from "../bridge/invoke";
import type { SynthSound } from "../synth";
import type { Cue, Settings } from "../types";

/** Sound names inside an SND sprite. */
export type SndSound =
  | "button"
  | "caution"
  | "celebration"
  | "disabled"
  | "notification"
  | "select"
  | "toggle_on"
  | "toggle_off"
  | "transition_up"
  | "transition_down";

/** Which designed sound plays for each mascot cue. */
export const CUE_SOUND: Record<Cue, SndSound> = {
  chirp: "notification",
  pop: "transition_up",
  open: "toggle_on",
  ding: "celebration",
  boop: "caution",
  yawn: "transition_down",
  settle: "button", // unused: settle is synthesized, see powerUp
};

/** The kit made of synthesized sounds, see synth.ts. */
export const SYNTH_KIT = "sidekick";

/** The Duskie kit's sound for each cue and each SND sound name. */
export const SYNTH_CUE: Record<Cue, SynthSound | null> = {
  chirp: "chirp",
  pop: "pop",
  open: "open",
  ding: "coo",
  boop: "uhoh",
  yawn: "yawn",
  settle: null,
};

export const SYNTH_FOR: Record<SndSound, SynthSound> = {
  button: "tap",
  caution: "uhoh",
  celebration: "tada",
  disabled: "buzz",
  notification: "chirp",
  select: "click",
  toggle_on: "pop",
  toggle_off: "down",
  transition_up: "reconnect",
  transition_down: "disconnect",
};

/** The closest SND sound for each mood sound, when the SND kit is picked. */
export const SND_FOR: Partial<Record<SynthSound, SndSound>> = {
  hello: "transition_up",
  sparkle: "celebration",
  tada: "celebration",
  fanfare: "celebration",
  mwah: "notification",
  cooSoft: "select",
  coo: "toggle_on",
  gasp: "caution",
  uhoh: "caution",
  disconnect: "transition_down",
  reconnect: "transition_up",
  click: "select",
};

/** Decodes a kit and reports why it could not load, for the settings screen. */
export async function checkKit(id: string): Promise<string | null> {
  if (id === SYNTH_KIT) return null;
  try {
    return await invoke<string | null>("check_kit", { kit: id });
  } catch (e) {
    return String(e);
  }
}

/** Starts decoding a kit ahead of the first cue so playback is instant. */
export function preloadSounds(kitId: string): void {
  if (typeof window !== "undefined" && kitId !== SYNTH_KIT) void checkKit(kitId);
}

export function cueVolume(settings: Settings, cue: Cue): number {
  if (settings.muted) return 0;
  return settings.masterVolume * (settings.cueVolumes[cue] ?? 1);
}
