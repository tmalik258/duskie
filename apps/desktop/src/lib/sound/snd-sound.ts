// Part of sound: SndSound, CUE_SOUND, SYNTH_KIT, SYNTH_CUE, SYNTH_FOR, SND_FOR, Kit, ctx, out, kits, audio, kitErrors, decodeFirst, fetchSpriteMap, loadKit, checkKit, preloadSounds, cueVolume, fallbackTone.

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

interface Kit {
  buffer: AudioBuffer;
  map: Record<string, { start: number; end: number }>;
}

let ctx: AudioContext | null = null;

export let out: GainNode | null = null;

const kits = new Map<string, Promise<Kit | null>>();

export function audio(): { ac: AudioContext; out: GainNode } {
  if (!ctx || !out) {
    ctx = new AudioContext();
    out = ctx.createGain();
    out.connect(ctx.destination);
  }
  if (ctx.state === "suspended") void ctx.resume();
  return { ac: ctx, out };
}

/** Last load error per kit, shown in settings so failures are never silent. */
export const kitErrors = new Map<string, string>();

async function decodeFirst(ac: AudioContext, id: string): Promise<AudioBuffer> {
  let lastError: unknown;
  for (const ext of ["m4a", "mp3", "ogg"]) {
    try {
      const res = await fetch(`/sounds/${id}/sprite.${ext}`);
      if (!res.ok) throw new Error(`HTTP ${res.status} for sprite.${ext}`);
      return await ac.decodeAudioData(await res.arrayBuffer());
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError;
}

async function fetchSpriteMap(id: string): Promise<Record<string, { start: number; end: number }>> {
  const res = await fetch(`/sounds/${id}/sprite.json`);
  if (!res.ok) {
    throw new Error(
      `HTTP ${res.status} for /sounds/${id}/sprite.json (run pnpm install or pnpm --filter desktop dev to sync kits)`,
    );
  }
  const json: { spritemap: Record<string, { start: number; end: number }> } = await res.json();
  return json.spritemap;
}

export function loadKit(id: string): Promise<Kit | null> {
  if (id === SYNTH_KIT) return Promise.resolve(null);
  let kit = kits.get(id);
  if (!kit) {
    const { ac } = audio();
    kit = Promise.all([fetchSpriteMap(id), decodeFirst(ac, id)])
      .then(([map, buffer]) => {
        kitErrors.delete(id);
        return { buffer, map };
      })
      .catch((err) => {
        kitErrors.set(id, String(err));
        console.warn(`sound kit ${id} unavailable, using fallback tone`, err);
        kits.delete(id); // retry on the next play
        return null;
      });
    kits.set(id, kit);
  }
  return kit;
}

/** Loads a kit and reports whether it decoded, for the settings screen. */
export async function checkKit(id: string): Promise<string | null> {
  if (id === SYNTH_KIT) return null;
  const kit = await loadKit(id);
  return kit ? null : (kitErrors.get(id) ?? "unknown error");
}

/** Starts decoding a kit ahead of the first cue so playback is instant. */
export function preloadSounds(kitId: string): void {
  if (typeof window !== "undefined" && kitId !== SYNTH_KIT) void loadKit(kitId);
}

export function cueVolume(settings: Settings, cue: Cue): number {
  if (settings.muted) return 0;
  return settings.masterVolume * (settings.cueVolumes[cue] ?? 1);
}

export function fallbackTone(ac: AudioContext, out: AudioNode, volume: number) {
  const now = ac.currentTime;
  const osc = ac.createOscillator();
  const amp = ac.createGain();
  osc.frequency.value = 880;
  amp.gain.setValueAtTime(0.0001, now);
  amp.gain.exponentialRampToValueAtTime(Math.max(0.15 * volume, 0.0002), now + 0.005);
  amp.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);
  osc.connect(amp).connect(out);
  osc.start(now);
  osc.stop(now + 0.2);
}
