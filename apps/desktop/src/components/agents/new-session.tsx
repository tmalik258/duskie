"use client";

// Starting a session: pick an agent, a project and a mode, with a note
// for agents that are not ready yet.

import { useEffect, useRef } from "react";
import { type Session, SLOTS } from "@/lib/agents";
import type { CursorChat } from "@/lib/types";
import { Ic } from "../icon";
import { ChatControls } from "./controls";
import { ModeChip } from "./controls/mode-chip";
import { AgentMark } from "./marks";
import { MODES, nextAgentMode } from "./modes";
import { FixLine, NewSessionLoading, NoAgentsReady, pickerNote, ready } from "./new-session/agent-status";
import { useNewSession } from "./new-session/use-new-session";
import { ProjectPicker } from "./project-picker";
import { SessionChips } from "./session-chips";
import { SessionList } from "./session-list";

export function NewSession({ sessions, cursor }: { sessions: Session[]; cursor: CursorChat[] }) {
  const n = useNewSession(sessions);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    requestAnimationFrame(() => inputRef.current?.focus({ preventScroll: true }));
  }, []);
  return (
    <>
      {sessions.length > 0 ? (
        <SessionList sessions={sessions} />
      ) : (
        <>
          <div className="ak-head">
            <span className="ak-title">New session</span>
          </div>
          <SessionChips sessions={sessions} current={null} cursor={cursor} />
        </>
      )}
      {!n.agents || (n.refreshing && n.choices.length === 0) ? (
        <NewSessionLoading />
      ) : n.choices.length === 0 ? (
        <NoAgentsReady sessions={sessions.length} cursor={cursor.length} missing={n.missing} />
      ) : (
        <>
          {n.picked && !ready(n.picked) && <FixLine agent={n.picked} />}
          {n.picked?.local && ready(n.picked) && (
            <p className="ak-local">
              <strong>On this PC.</strong> Nothing leaves it. Slower; best for small, clear changes. Every edit waits in
              Review.
            </p>
          )}
          <div className="ag-comp">
            <div className="ag-comp-top">
              <fieldset className="ag-tabs" aria-label="Agent">
                {n.choices.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    aria-pressed={n.pickedAgent === c.id}
                    onClick={() => n.pickAgent(c.id)}
                    title={pickerNote(c) || c.name}
                  >
                    <AgentMark agent={c.name} sm />
                    {c.name === "Local (Ollama)" ? "Local" : c.name}
                  </button>
                ))}
              </fieldset>
              <span className="ag-proj">
                <ProjectPicker projects={n.projects ?? []} path={n.pickedPath} onChange={n.pickPath} />
              </span>
            </div>
            <textarea
              ref={inputRef}
              rows={2}
              value={n.prompt}
              onChange={(e) => n.setPrompt(e.target.value)}
              onKeyDown={(e) => {
                if (e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey && e.key === ".") {
                  e.preventDefault();
                  n.pickMode(nextAgentMode(n.mode));
                  return;
                }
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  n.go();
                }
              }}
              placeholder="What should it do? / for commands, @ for files"
            />
            <div className="ag-comp-foot">
              <ChatControls
                agent={n.pickedAgent}
                model={n.model}
                effort={n.effort}
                onModel={n.pickModel}
                onEffort={n.pickEffort}
                lead={<ModeChip mode={n.mode} onChange={n.pickMode} />}
                tail={
                  <>
                    <span className="ag-note">
                      {n.busy
                        ? "Starting..."
                        : n.full
                          ? `${SLOTS} running, this one queues`
                          : MODES.find((m) => m.id === n.mode)?.note}
                    </span>
                    <button
                      type="button"
                      className="ag-send"
                      aria-label={n.full ? "Queue" : "Start"}
                      title={n.full ? "Queue (Enter)" : "Start (Enter)"}
                      disabled={n.busy || !n.prompt.trim()}
                      onClick={n.go}
                    >
                      <Ic name="send" size={13} />
                    </button>
                  </>
                }
              />
            </div>
          </div>
          {n.error && <p className="ak-err">{n.error}</p>}
        </>
      )}
    </>
  );
}
