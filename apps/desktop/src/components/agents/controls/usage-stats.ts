import { type Session, seenUsage, seenWindows } from "@/lib/agents";
import { windowName } from "./mode-chip";

/** Plan windows (this session's warning plus every window Duskie has seen) and the chip text. */
export function usageStats(agent: string, usage?: Session["usage"], limit?: Session["limit"]) {
  const now = Date.now();
  const byWindow = new Map<string, { used: number; window: string; resetsAt: number | null; at: number }>();
  for (const u of seenWindows(agent)) {
    byWindow.set(u.window, u);
  }
  if (limit && limit.used !== null) {
    byWindow.set(limit.window, {
      used: limit.used,
      window: limit.window,
      resetsAt: limit.resetsAt,
      at: now,
    });
  }
  const plans = [...byWindow.values()].sort((a, b) => {
    const rank = (w: string) => (w === "five_hour" ? 0 : w.startsWith("seven_day") ? 1 : 2);
    return rank(a.window) - rank(b.window);
  });
  const top = seenUsage(agent);
  const planPct = top ? Math.round(top.used <= 1 ? top.used * 100 : top.used) : null;
  const ctxPct = usage && usage.window > 0 ? Math.round(Math.min(1, usage.used / usage.window) * 100) : null;
  const ringPct = ctxPct ?? planPct ?? 0;
  const usageText = [
    ctxPct !== null ? `${ctxPct}% context` : null,
    top && planPct !== null ? `${planPct}% ${windowName(top.window).toLowerCase()}` : null,
  ]
    .filter(Boolean)
    .join(" \u00b7 ");
  return { now, plans, ctxPct, ringPct, usageText };
}
