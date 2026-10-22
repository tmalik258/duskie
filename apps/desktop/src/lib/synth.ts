// The "Duskie" sound kit's sound names. The tones themselves are rendered
// and played in Rust (crates/voice/src/fx/synth.rs), from Duskie's own
// process, so they follow the voice's speaker.

export type SynthSound =
  | "chirp"
  | "pop"
  | "coo"
  | "cooSoft"
  | "sparkle"
  | "mwah"
  | "hello"
  | "hmm"
  | "hmmUp"
  | "gasp"
  | "tada"
  | "fanfare"
  | "sad"
  | "uhoh"
  | "yawn"
  | "snore"
  | "focus"
  | "open"
  | "disconnect"
  | "reconnect"
  | "buzz"
  | "click"
  | "tap"
  | "down";
