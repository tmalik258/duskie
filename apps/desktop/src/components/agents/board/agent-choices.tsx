"use client";

import type { ReactNode } from "react";
import { resumeSession, type Session } from "@/lib/agents";
import { AgentMark } from "../marks";
import { ago, PICK_NOTE } from "./tile";

/** The new-session picker before an agent is chosen: agents, then paused sessions to bring back. */
export function AgentChoices({
  ready,
  recent,
  highlight,
  pickedPath,
  projectPicker,
  onHighlight,
  onAgent,
  onClose,
}: {
  ready: [string, string, boolean][];
  recent: Session[];
  highlight: number;
  pickedPath: string;
  projectPicker: ReactNode;
  onHighlight: (i: number) => void;
  onAgent: (id: string) => void;
  onClose: () => void;
}) {
  return (
    <>
      <div className="ak-pickhead">
        <span className="min-w-0">
          <b>New session</b>
          {projectPicker}
        </span>
        <button type="button" className="ak-pickback" onClick={onClose}>
          Close
        </button>
      </div>
      <div className="ak-tpick" data-n={ready.length}>
        {ready.map(([id, name], i) => (
          <button
            key={id}
            type="button"
            data-agent={id}
            data-focus={i === highlight}
            onMouseEnter={() => onHighlight(i)}
            onClick={() => onAgent(id)}
            disabled={!pickedPath}
          >
            <span className="ak-tpick-mark">
              <AgentMark agent={id} />
            </span>
            <span className="ak-tpick-copy">
              <strong>{name === "Claude Code" ? "Claude" : name}</strong>
              <em>{PICK_NOTE[id] ?? ""}</em>
            </span>
            <span className="ak-tpick-key">{i + 1}</span>
          </button>
        ))}
      </div>
      <p className="ak-pickhint">
        {pickedPath ? "1–3 agent · [ ] project · Enter · Esc" : "Select a folder above first"}
      </p>
      {recent.length > 0 && (
        <div className="ak-trec">
          <p className="ak-tlab">Bring back</p>
          {recent.slice(0, 2).map((r) => (
            <button key={r.id} type="button" onClick={() => void resumeSession(r.id)}>
              <AgentMark agent={r.agent} sm />
              <span className="truncate">{r.title}</span>
              <small>
                {r.agent} · {ago(r.startedAt)}
              </small>
            </button>
          ))}
        </div>
      )}
    </>
  );
}
