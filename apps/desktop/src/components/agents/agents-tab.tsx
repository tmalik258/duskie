"use client";

// The Agents tab: start Claude Code or Codex in a project, watch it work
// step by step, answer its questions here, steer it, and keep or undo each
// change when it is done.

import { useEffect, useState } from "react";
import { type Session, useAgents } from "@/lib/agents";
import { api } from "@/lib/bridge";
import { Markdown } from "@/lib/markdown";
import type { CursorChat } from "@/lib/types";
import { Board } from "./board";
import { NewSession } from "./new-session";
import { CURSOR, SessionChips } from "./session-chips";
import { SessionView } from "./session-view";

/** Chats started in Cursor, refreshed while Agents is visible. */
function useCursorChats(active: boolean): CursorChat[] {
  const [chats, setChats] = useState<CursorChat[]>([]);
  useEffect(() => {
    if (!active) return;
    let live = true;
    let busy = false;
    const load = () => {
      if (busy) return;
      busy = true;
      void api
        .cursorChats()
        .then((c) => {
          if (live) setChats(c);
        })
        .catch(() => {})
        .finally(() => {
          busy = false;
        });
    };
    load();
    const t = setInterval(load, 30_000);
    return () => {
      live = false;
      clearInterval(t);
    };
  }, [active]);
  return chats;
}

export function AgentsTab({
  maxHeight,
  active = true,
}: {
  maxHeight: number;
  /** False while Ask is closed but Agents is kept warm, skip background work. */
  active?: boolean;
}) {
  const sessions = useAgents((s) => s.sessions);
  const current = useAgents((s) => s.current);
  const layout = useAgents((s) => s.layout);
  const cursor = useCursorChats(active);
  const session = sessions.find((s) => s.id === current) ?? null;
  if (layout === "board") return <Board sessions={sessions} maxHeight={maxHeight} active={active} />;
  const watched = current?.startsWith(CURSOR) ? cursor.find((c) => CURSOR + c.id === current) : undefined;
  if (watched) return <CursorView chat={watched} sessions={sessions} cursor={cursor} />;
  return session ? (
    <SessionView key={session.id} session={session} maxHeight={maxHeight} active={active} />
  ) : (
    <NewSession sessions={sessions} cursor={cursor} />
  );
}

/** A chat started in Cursor: status and last reply; replies happen in Cursor. */
function CursorView({ chat, sessions, cursor }: { chat: CursorChat; sessions: Session[]; cursor: CursorChat[] }) {
  const [error, setError] = useState<string | null>(null);
  return (
    <>
      <div className="ak-head">
        <span className="ak-title truncate">{chat.title}</span>
        <span className="ak-mi">Watching</span>
      </div>
      <SessionChips sessions={sessions} current={CURSOR + chat.id} cursor={cursor} />
      <div className="ak-meta">
        <span className="ak-mi b">Cursor</span>
        {chat.project && <span className="ak-mi">{chat.project}</span>}
        <span className="ak-mi">{chat.status === "working" ? "Working" : "Idle"}</span>
      </div>
      {chat.lastReply ? (
        <div className="ak-in text-[13px]">
          <Markdown text={chat.lastReply} />
        </div>
      ) : (
        <p className="ak-note">No reply yet.</p>
      )}
      <div className="ak-composer justify-center">
        <button
          type="button"
          disabled={!chat.path}
          onClick={() => chat.path && void api.cursorOpen(chat.path).catch((e: unknown) => setError(String(e)))}
          className="ak-chip chip"
        >
          Open in Cursor
        </button>
      </div>
      {error && <p className="ak-err">{error}</p>}
    </>
  );
}
