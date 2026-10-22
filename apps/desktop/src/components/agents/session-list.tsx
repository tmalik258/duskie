"use client";

// Sessions as chips and as a list grouped by what they need from you.

import { cancelQueued, type Session, SLOTS, useAgents } from "@/lib/agents";
import { useNow } from "@/lib/hooks";
import { Ic } from "../icon";
import { Tip } from "../tip";
import { AgentMark } from "./marks";

type Group = "Needs you" | "Running" | "Ready to review" | "Done" | "Stopped";
// Oldest news at the top; what needs you sits next to the composer.
const GROUPS: (Group | "Queued")[] = ["Stopped", "Done", "Queued", "Ready to review", "Running", "Needs you"];

function groupOf(s: Session): Group {
  if (s.status === "waiting" || s.question || s.choose) return "Needs you";
  if (s.status === "working") return "Running";
  if (s.status === "failed") return "Stopped";
  if (!s.finished && s.changes > 0) return "Ready to review";
  return "Done";
}

const MODE_WORD: Record<string, string> = { plan: "Plan", ask: "Ask", edit: "Edit", debug: "Debug", full: "Full" };

function ago(ms: number): string {
  const m = Math.max(0, Math.round(ms / 60_000));
  if (m < 60) return `${m} min`;
  const h = Math.round(m / 60);
  return h < 24 ? `${h} h` : `${Math.round(h / 24)} d`;
}

/** Agents home: every session grouped by what it needs, newest first. */
export function SessionList({ sessions }: { sessions: Session[] }) {
  const now = useNow(30_000);
  const running = sessions.filter((s) => s.status === "working").length;
  const need = sessions.filter((s) => groupOf(s) === "Needs you").length;
  const queued = useAgents((st) => st.queued);
  return (
    <div className="ag-home">
      <div className="ag-bar">
        <span className="ag-count" title={`Up to ${SLOTS} agents work at once; more wait in a queue.`}>
          {running === 0
            ? "Nothing running"
            : running >= SLOTS
              ? `${running} running, all slots busy`
              : `${running} running, room for ${SLOTS - running} more`}
          {queued.length > 0 && <> · {queued.length} queued</>}
          {need > 0 && <span className="ag-need"> · {need} need you</span>}
        </span>
        <button
          type="button"
          className="ag-new"
          onClick={() => document.querySelector<HTMLTextAreaElement>(".ag-comp textarea")?.focus()}
        >
          <Ic name="plus" size={12} /> New
        </button>
      </div>
      {GROUPS.map((g) => {
        if (g === "Queued")
          return queued.length === 0 ? null : (
            <div key={g} className="ag-group">
              <p className="ak-group">
                {g} <span className="ag-n">{queued.length}</span>
              </p>
              {queued.map((q) => (
                <div key={q.id} className="ag-row ag-qrow">
                  <AgentMark agent={q.agent} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate">{q.prompt}</span>
                    <span className="ag-sub block truncate">
                      {q.path.split(/[\\/]/).pop()} · {MODE_WORD[q.mode] ?? q.mode} · starts when a slot frees
                    </span>
                  </span>
                  <span className="ag-st" data-g={g}>
                    Queued
                  </span>
                  <Tip label="Remove from the queue">
                    <button
                      type="button"
                      aria-label="Remove from the queue"
                      onClick={() => cancelQueued(q.id)}
                      className="ak-ibtn chip"
                    >
                      <Ic name="x" size={12} />
                    </button>
                  </Tip>
                </div>
              ))}
            </div>
          );
        const list = sessions.filter((s) => groupOf(s) === g).sort((a, b) => a.turnAt - b.turnAt);
        if (list.length === 0) return null;
        return (
          <div key={g} className="ag-group">
            <p className="ak-group">
              {g} <span className="ag-n">{list.length}</span>
            </p>
            {list.map((s) => (
              <button
                key={s.id}
                type="button"
                className="ag-row chip"
                onClick={() => useAgents.setState({ current: s.id })}
              >
                <AgentMark agent={s.agent} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate">{s.title}</span>
                  <span className="ag-sub block truncate">
                    {s.project} · {MODE_WORD[s.mode] ?? s.mode} · {ago(now - s.turnAt)}
                  </span>
                </span>
                {g === "Running" && s.plan.length > 0 && (
                  <span className="ag-prog" aria-hidden="true">
                    <i
                      style={{
                        width: `${Math.round((s.plan.filter((p) => p.status === "completed").length / s.plan.length) * 100)}%`,
                      }}
                    />
                  </span>
                )}
                <span className="ag-st" data-g={g}>
                  {g === "Needs you"
                    ? "Needs you"
                    : g === "Running"
                      ? "Working"
                      : g === "Ready to review"
                        ? "Ready to review"
                        : g}
                </span>
              </button>
            ))}
          </div>
        );
      })}
      {sessions.length > 0 && <p className="ag-hint">Enter opens · Alt B puts them on the Board</p>}
    </div>
  );
}
