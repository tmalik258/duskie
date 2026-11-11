import type { CalendarToday, MascotState, Settings } from "@/lib/types";
import { PALETTES, type WashEvent } from "@/lib/wash";

/** Wash palette colour as "r g b" for the tint gradient. */
export function tintRgb(e: WashEvent): string {
  const h = PALETTES[e].a;
  return [1, 3, 5].map((i) => Number.parseInt(h.slice(i, i + 2), 16)).join(" ");
}

/** Halo colour and strength follow the mascot's mood. */
export function haloFace(m: MascotState): string {
  if (m === "listening") return "listen";
  if (m === "success") return "happy";
  if (m === "error") return "sad";
  if (m === "working") return "work";
  if (m === "sleeping") return "sleep";
  return "idle";
}

/** First clause of an error, short enough for the compact line. */
export function shortError(msg: string | null): string {
  const first = (msg ?? "").split(/[.\n]/)[0]?.trim() ?? "";
  if (!first) return "That did not work";
  return first.length > 42 ? `${first.slice(0, 41)}…` : first;
}

export function clockTime(ms: number): string {
  return new Date(ms).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

export function pauseDim(p: Settings["pause"]): string | undefined {
  return p.kind === "until" ? `until ${clockTime(Date.parse(p.until))}` : undefined;
}

/** A meeting starting within ten minutes (or just started), for the notify pill. */
export function soonMeeting(now: number, cal: CalendarToday | null | undefined) {
  for (const m of cal?.meetings ?? []) {
    const [h, mm] = m.start.split(":").map(Number);
    const d = new Date(now);
    d.setHours(h ?? 0, mm ?? 0, 0, 0);
    const mins = Math.round((d.getTime() - now) / 60_000);
    if (mins >= -2 && mins <= 10)
      return { title: m.title, mins: Math.max(0, mins), join: m.joinUrl, notes: m.notes ?? null };
  }
  return null;
}
