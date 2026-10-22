// Short time text shared by the panels: "5 min ago", "2 h", "1:12".

export interface AgoStyle {
  /** Adds " ago" ("5 min ago"). */
  suffix?: boolean;
  /** Text under a minute ("just now", "now"); otherwise minutes start at 1 or 0. */
  justNow?: string;
  /** Under a minute reads "1 min", not "0 min". */
  atLeastOne?: boolean;
  /** Past 24 hours reads in days ("2 d"). */
  days?: boolean;
  /** Hours round down instead of to nearest. */
  floorHours?: boolean;
}

/** Minutes as "5 min", "2 h" or "3 d", styled per caller. */
export function minutesText(minutes: number, style: AgoStyle = {}): string {
  const tail = style.suffix ? " ago" : "";
  const mins = Math.max(style.atLeastOne ? 1 : 0, Math.round(minutes));
  if (style.justNow && minutes < 1) return style.justNow;
  if (mins < 60) return `${mins} min${tail}`;
  const h = style.floorHours ? Math.floor(mins / 60) : Math.round(mins / 60);
  if (style.days && h >= 24) return `${Math.round(h / 24)} d${tail}`;
  return `${h} h${tail}`;
}

/** Time since a moment in ms, as minutesText. */
export function agoText(at: number, style: AgoStyle = {}, now = Date.now()): string {
  return minutesText((now - at) / 60_000, style);
}

/** "1:12" for a duration in ms. */
export function clockText(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}
