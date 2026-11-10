"use client";

// Session chips: + New, each session, then Cursor chats.

import type { CSSProperties } from "react";
import { type Session, useAgents } from "@/lib/agents";
import type { CursorChat } from "@/lib/types";
import { markFor } from "./marks";

/** Cursor chats share the session list under ids with this prefix. */
export const CURSOR = "cursor:";

/** Session chips with + New first when viewing one (to leave it), then Cursor chats. */
export function SessionChips({
  sessions,
  current,
  cursor = [],
}: {
  sessions: Session[];
  current: string | null;
  cursor?: CursorChat[];
}) {
  if (sessions.length === 0 && cursor.length === 0 && current === null) return null;
  return (
    <div className="ak-sess">
      {current !== null && (
        <button
          type="button"
          onClick={() => useAgents.setState({ current: null })}
          className="ak-sp chip text-[rgb(235_235_245/0.45)]"
        >
          + New
        </button>
      )}
      {sessions.map((s) => {
        const color = markFor(s.agent)[1];
        return (
          <button
            key={s.id}
            type="button"
            aria-pressed={s.id === current}
            onClick={() => useAgents.setState({ current: s.id })}
            className="ak-sp chip max-w-56"
            style={{ "--sp": color } as CSSProperties}
          >
            <span className="ak-sd" data-s={s.status} role="img" aria-label={s.status} />
            <span className="truncate">{s.title}</span>
            <em>
              {s.agent}
              {s.project ? ` · ${s.project}` : ""}
            </em>
          </button>
        );
      })}
      {cursor.map((c) => {
        const color = markFor("Cursor")[1];
        return (
          <button
            key={c.id}
            type="button"
            aria-pressed={CURSOR + c.id === current}
            onClick={() => useAgents.setState({ current: CURSOR + c.id })}
            className="ak-sp chip max-w-56"
            style={{ "--sp": color } as CSSProperties}
          >
            <span className="ak-sd" data-s={c.status} role="img" aria-label={c.status} />
            <span className="truncate">{c.title}</span>
            <em>{c.project ? `${c.project} · Cursor` : "Cursor"}</em>
          </button>
        );
      })}
    </div>
  );
}
