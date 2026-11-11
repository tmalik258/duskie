"use client";

// The history list under Ask: chats, agent sessions and live runs.

import { type Session, setTab, useAgents } from "@/lib/agents";
import { openChat } from "@/lib/store";
import type { ChatSummary } from "@/lib/types";
import { Ic } from "../icon";
import { ago, scrollIfActive } from "./parts";

export type HistoryKind = "all" | "chats" | "agents" | "live";

interface HistoryRow {
  id: string;
  group: string;
  agent: boolean;
  title: string;
  meta: string;
  open: () => void;
  remove?: () => void;
}

/** Past chats and agent sessions, newest first, under Today / Yesterday / Earlier. */
export function historyRows(
  chats: ChatSummary[],
  sessions: Session[],
  kind: HistoryKind,
  q: string,
  removeChat: (id: string) => void,
): HistoryRow[] {
  const day = (ms: number) => {
    const d = new Date(ms);
    const today = new Date();
    const start = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
    return ms >= start ? "Today" : ms >= start - 86_400_000 ? "Yesterday" : d.toLocaleDateString();
  };
  const all: (HistoryRow & { at: number })[] = [];
  if (kind !== "agents") {
    for (const c of kind === "live" ? chats.filter((c) => c.live) : chats) {
      const at = Date.parse(c.updated) || 0;
      all.push({
        id: `chat:${c.id}`,
        group: day(at),
        agent: false,
        title: c.title,
        meta: ago(c.updated),
        at,
        open: () => {
          setTab("ask");
          void openChat(c.id);
        },
        remove: () => removeChat(c.id),
      });
    }
  }
  if (kind !== "chats" && kind !== "live") {
    for (const s of sessions) {
      all.push({
        id: `agent:${s.id}`,
        group: day(s.startedAt),
        agent: true,
        title: s.title,
        meta: [
          s.agent,
          s.project.split(/[\\/]/).filter(Boolean).pop(),
          s.changes ? `${s.changes} ${s.changes === 1 ? "change" : "changes"}` : "",
        ]
          .filter(Boolean)
          .join(" · "),
        at: s.startedAt,
        open: () => useAgents.setState({ current: s.id, tab: "agents" }),
      });
    }
  }
  return all
    .filter((r) => !q || r.title.toLowerCase().includes(q))
    .sort((a, b) => b.at - a.at)
    .map(({ at: _, ...r }) => r);
}

export function HistoryList({
  rows,
  active,
  onHover,
  onClear,
}: {
  rows: HistoryRow[];
  active: number;
  onHover: (i: number) => void;
  onClear?: () => void;
}) {
  if (rows.length === 0) return <p className="ak-group py-2">Nothing here yet.</p>;
  return (
    <ul className="ak-list" aria-label="History">
      {rows.map((r, i) => (
        <li key={r.id} ref={scrollIfActive(i === active)}>
          {(i === 0 || rows[i - 1].group !== r.group) && <p className="ak-group">{r.group}</p>}
          <div className="flex items-center gap-1">
            <button
              type="button"
              data-sel={i === active}
              onMouseMove={() => onHover(i)}
              onClick={r.open}
              className="ak-row min-w-0 flex-1"
            >
              <span className="ak-ico">
                <Ic name={r.agent ? "cpu" : "spark"} size={12} />
              </span>
              <span className="min-w-0 flex-1 truncate">{r.title}</span>
              <span className="ak-hint">{r.meta}</span>
            </button>
            {r.remove && (
              <button type="button" aria-label={`Delete ${r.title}`} className="chip ak-del" onClick={r.remove}>
                <Ic name="x" size={12} />
              </button>
            )}
          </div>
        </li>
      ))}
      {onClear && rows.some((r) => r.remove) && (
        <li className="flex justify-end pt-1">
          <button type="button" className="chip" onClick={onClear}>
            Clear chats
          </button>
        </li>
      )}
    </ul>
  );
}
