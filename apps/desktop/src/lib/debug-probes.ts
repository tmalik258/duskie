import type { Entry } from "./agents";

export interface Probes {
  probes: { at: string; what: string }[];
  logs: string[];
  cause: string | null;
  removed: boolean;
}

const PROBE = /^\s*[-*]?\s*PROBE\s+(\S+:\d+)\s*[-:]?\s*(.*)$/;
const CAUSE = /^\s*[-*]?\s*CAUSE:\s*(.+)$/;

/** What a Debug session reported: probes added, their log lines, the cause. */
export function readProbes(entries: Entry[]): Probes {
  const out: Probes = { probes: [], logs: [], cause: null, removed: false };
  for (const e of entries) {
    if (e.kind === "text") {
      for (const line of e.text.split("\n")) {
        const p = PROBE.exec(line);
        if (p && !out.probes.some((x) => x.at === p[1])) out.probes.push({ at: p[1], what: p[2].trim() });
        const c = CAUSE.exec(line);
        if (c) out.cause = c[1].trim();
        if (/^\s*PROBES REMOVED/.test(line)) out.removed = true;
      }
    } else if (e.kind === "step" && e.step.output) {
      for (const line of e.step.output.split("\n")) if (line.includes("[dbg")) out.logs.push(line.trim());
    }
  }
  out.logs = out.logs.slice(-40);
  return out;
}
