"use client";

// What Ask shows while it listens: the bars and the words heard so far.

/** The voice's rainbow bars. */
export function VoiceBars() {
  return (
    <span className="voice-bars shrink-0" role="img" aria-label="Listening">
      <i />
      <i />
      <i />
      <i />
      <i />
      <i />
    </span>
  );
}

/** Live transcript while listening: the bars, then your words a size
 * larger, or "Listening..." until the first one. */
export function Hearing({ text }: { text: string }) {
  return (
    <div className="flex min-w-0 flex-1 items-center gap-2.5" aria-live="polite">
      <VoiceBars />
      <span
        className={`min-w-0 flex-1 truncate font-display text-[17px] tracking-[-0.015em] ${
          text ? "text-white" : "text-[rgb(235_235_245/0.45)]"
        }`}
      >
        {text || "Listening..."}
      </span>
    </div>
  );
}
