"use client";

// What the new-session form shows about agents: loading, none ready, the
// note under each one, and the one step that makes an agent ready.

import { useState } from "react";
import { usageLine } from "@/lib/agents";
import { setAsk } from "@/lib/store";
import type { AgentInfo } from "@/lib/types";

/** No CLI is ready: past sessions can still be opened; setup goes through Settings. */
export function NoAgentsReady({
  sessions,
  cursor,
  missing,
}: {
  sessions: number;
  cursor: number;
  missing: AgentInfo[];
}) {
  const hasPast = sessions > 0 || cursor > 0;
  return (
    <div className="ak-group flex flex-col gap-2 py-1 text-[13px]">
      {hasPast ? (
        <p>
          No coding agent is ready on this PC right now. Open a session above to review it, or set one up in Settings.
        </p>
      ) : (
        <p>Add Claude Code, Codex, Copilot, or Cursor to start a session here.</p>
      )}
      {missing.slice(0, 3).map((a) => (
        <FixLine key={a.id} agent={a} />
      ))}
      <button
        type="button"
        className="ak-chip chip self-start"
        onClick={() => setAsk({ view: "settings", settingsTab: "ai" })}
      >
        Open Settings → AI
      </button>
    </div>
  );
}

/** Skeleton of the new-session form while agents are detected (same idea as ReposLoading). */
export function NewSessionLoading() {
  return (
    <div className="ak-nload" role="status" aria-busy="true" aria-label="Finding coding agents">
      <div className="ak-meta ak-rskel" aria-hidden="true">
        <i className="ak-npill" style={{ width: 92 }} />
        <i className="ak-npill" style={{ width: 108 }} />
        <i className="ak-npill" style={{ width: 74 }} />
      </div>
      <div className="ak-composer ak-two ak-rskel" aria-hidden="true">
        <div className="ak-row">
          <i className="ak-nbar" />
        </div>
        <div className="ak-nctrls">
          <i className="ak-npill" style={{ width: 58 }} />
          <i className="ak-npill" style={{ width: 48 }} />
          <i className="ak-npill" style={{ width: 44 }} />
        </div>
      </div>
      <p className="ak-nload-msg">
        <span className="shimmer-text">Finding coding agents</span>
      </p>
    </div>
  );
}

/** Ready to start: installed, not known signed out, not out of usage. */
export function ready(a: AgentInfo): boolean {
  return a.installed && a.signedIn !== false && !a.limited;
}

/** Where it runs, then the last plan usage seen when it is ready. */
export function pickerNote(a: AgentInfo): string {
  const usage = ready(a) && !a.local ? usageLine(a.name) : null;
  return usage ? `Cloud · ${usage}` : readyNote(a);
}

export function readyNote(a: AgentInfo): string {
  if (!a.installed) {
    // Cursor app on PATH is not the agent CLI Duskie runs.
    if (a.id === "cursor") return "Needs agent CLI";
    return "Not installed";
  }
  if (a.local) return "On this PC. Slower, best for small, clear changes.";
  if (a.signedIn === false) return "Cloud · sign in needed";
  if (a.limited) return "Cloud · out of usage for now";
  return a.signedIn ? "Cloud · ready" : "Cloud · installed";
}

/** The one step that makes an agent ready, with Copy when it is a command. */
export function FixLine({ agent }: { agent: AgentInfo }) {
  const [copied, setCopied] = useState(false);
  const step = agent.limited && !agent.fix ? null : agent.fix;
  const command = step && !/\s(from|then)\s/.test(step) ? step : null;
  return (
    <p className="ak-note ak-in flex items-center gap-2">
      <span className="min-w-0 flex-1">
        {agent.name}: {readyNote(agent).replace(/^Cloud · /, "")}.
        {step && (
          <>
            {" "}
            {command ? "Run " : ""}
            <code className="mono">{step}</code>
          </>
        )}
      </span>
      {command && (
        <button
          type="button"
          className="ak-chip chip"
          onClick={() => {
            void navigator.clipboard?.writeText(command).then(() => setCopied(true));
          }}
        >
          {copied ? "Copied" : "Copy"}
        </button>
      )}
    </p>
  );
}
