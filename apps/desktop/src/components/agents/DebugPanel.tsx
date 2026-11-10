"use client";

import type { Session } from "@/lib/agents";
import { readProbes } from "@/lib/debug-probes";
import { Ic } from "../Icon";

/** Debug mode: the probes the agent added, what they logged, and the cause. */
export function DebugPanel({ session }: { session: Session }) {
  const { probes, logs, cause, removed } = readProbes(session.entries);
  if (probes.length === 0 && logs.length === 0 && !cause) return null;
  return (
    <div className="dbg">
      <div className="dbg-h">
        <Ic name="bug" size={12} />
        <b>Debug probes</b>
        <span className="dbg-n">
          {removed ? "all removed, nothing left behind" : `${probes.length} added, removed when done`}
        </span>
      </div>
      {probes.map((p) => (
        <div key={p.at} className="dbg-p" data-gone={removed}>
          <span className="font-mono">{p.at}</span>
          <span className="dbg-n">{p.what}</span>
        </div>
      ))}
      {logs.length > 0 && (
        <div className="dbg-log ak-scroll font-mono">
          {logs.map((l, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: log lines repeat
            <div key={i}>{l}</div>
          ))}
        </div>
      )}
      {cause && (
        <div className="dbg-cause">
          <Ic name="check" size={12} /> Cause found: {cause}
        </div>
      )}
    </div>
  );
}
