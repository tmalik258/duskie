// Karaoke captions while Duskie speaks: a few words at a time, timed to TTS.

/** How many words show in the island at once. */
export const CAPTION_WORDS = 3;

/** Windows of `CAPTION_WORDS` from a spoken piece. */
export function wordWindows(text: string, size = CAPTION_WORDS): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];
  if (words.length <= size) return [words.join(" ")];
  const out: string[] = [];
  for (let i = 0; i < words.length; i += size) {
    out.push(words.slice(i, i + size).join(" "));
  }
  return out;
}
