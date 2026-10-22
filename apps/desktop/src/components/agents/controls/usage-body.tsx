"use client";

// Part of controls: UsageBody.

import { useEffect, useState } from "react";
import type { Session } from "@/lib/agents";
import { api } from "@/lib/bridge";
import type { LimitState } from "@/lib/types";
import { idOf } from "./levels";
import { ago, resetText, windowName } from "./mode-chip";

/** Ticks only while the usage popover is open (this component mounts with the pop). */
export function UsageBody({
  usage,
  ctxPct,
  plans,
  now,
  agent,
  onCompact,
  onRefresh,
}: {
  usage?: Session["usage"];
  ctxPct: number | null;
  plans: { used: number; window: string; resetsAt: number | null; at: number }[];
  now: number;
  agent: string;
  onCompact?: () => void;
  onRefresh?: () => void;
}) {
  const [, tick] = useState(0);
  const [paused, setPaused] = useState<LimitState[]>([]);
  useEffect(() => {
    const read = () => void api.limitsPaused().then(setPaused, () => {});
    read();
    const timer = setInterval(() => {
      tick((n) => n + 1);
      read();
    }, 1000);
    return () => clearInterval(timer);
  }, []);
  return (
    <>
      {paused.length > 0 && (
        <>
          <div className="ak-pop-h">
            <span>Paused after errors</span>
          </div>
          {paused.map((p) => (
            <p key={p.name} className="ak-note">
              {p.name} is tried again in {p.pausedSecs} s
            </p>
          ))}
          <div className="ak-pop-sep" />
        </>
      )}
      {!usage && <p className="ak-note">Context capacity: Not reported</p>}
      {usage && ctxPct !== null && (
        <>
          <div className="ak-pop-h">
            <span>Context window</span>
            <span className="ak-pop-m">
              {Math.round(usage.used / 1000)}k / {Math.round(usage.window / 1000)}k ({ctxPct}%)
            </span>
          </div>
          <div className="ak-pbar">
            <i className="ak-pfill" style={{ width: `${ctxPct}%` }} />
          </div>
          <p className="ak-note">
            {Math.max(0, usage.window - usage.used).toLocaleString()} tokens remaining {"\u00b7"} {100 - ctxPct}%
            remaining
          </p>
          <p className="ak-note">
            Latest usage: {usage.used.toLocaleString()} tokens. Session total:{" "}
            {usage.total?.toLocaleString() ?? "Not reported"}. {usage.at ? `Reported ${ago(usage.at)}` : "Cached"}
          </p>
        </>
      )}
      {usage && plans.length > 0 && <div className="ak-pop-sep" />}
      {plans.length > 0 && (
        <>
          <div className="ak-pop-h">
            <span>Account allowance</span>
          </div>
          {plans.map((p) => {
            const pPct = Math.round(p.used <= 1 ? p.used * 100 : p.used);
            return (
              <div key={p.window} className="ak-lim">
                <div className="ak-pop-h">
                  <span className="font-normal">{windowName(p.window)}</span>
                  <span className="ak-pop-m">
                    {`${100 - pPct}% remaining \u00b7 ${resetText(p.resetsAt) || "Reset not reported"}`}
                  </span>
                </div>
                <p className="ak-note">
                  {p.resetsAt ? new Date(p.resetsAt * 1000).toLocaleString() : "Reset timestamp: Not reported"}{" "}
                  {"\u00b7"}{" "}
                  {p.resetsAt && p.resetsAt * 1000 <= now ? "Expired; refresh required" : `Cached report ${ago(p.at)}`}
                </p>
                <div className="ak-pbar">
                  <i
                    className="ak-pfill"
                    style={{ width: `${pPct}%`, background: pPct > 65 ? "#ff9f0a" : undefined }}
                  />
                </div>
              </div>
            );
          })}
        </>
      )}
      <div className="ak-pop-h">
        <span className="ak-pop-m">
          {idOf(agent) === "codex" && plans.length === 0
            ? "Account allowance: Not reported (API-key accounts may not report this)"
            : plans.length > 0
              ? `Sent with ${agent}'s usage warnings; last seen ${ago(Math.max(...plans.map((p) => p.at)))}`
              : "Plan limits show once the agent reports them"}
        </span>
        {onCompact && (
          <button type="button" className="chip ak-pop-btn" onClick={onCompact}>
            Compact
          </button>
        )}
        {onRefresh && (
          <button type="button" className="chip ak-pop-btn" onClick={onRefresh}>
            Refresh allowance
          </button>
        )}
      </div>
      <p className="ak-note">
        Context capacity is what one turn can hold. Account allowance limits service usage over a time window.
        Compaction summarizes earlier messages to free context; it does not reset allowance.
      </p>
    </>
  );
}
