"use client";

// The top of a session: its mark, name, project and branch, and the
// review, terminal, pause and stop buttons.

import { closeSession, interruptSession, pauseSession, resumePaused, type Session } from "@/lib/agents";
import { api } from "@/lib/bridge";
import { Ic, type IcName } from "../../icon";
import { Tip } from "../../tip";
import { AgentMark } from "../marks";
import { ContextRing, SessionMemory } from "./context-ring";
import { NameField } from "./name-field";
import { TrialBar } from "./trial-bar";

export function SessionHeader({
  session: s,
  active,
  working,
  onReview,
}: {
  session: Session;
  active: boolean;
  working: boolean;
  onReview: () => void;
}) {
  return (
    <>
      <div className="ag-sh">
        <AgentMark agent={s.agent} />
        <div className="min-w-0 flex-1">
          <NameField id={s.id} title={s.title} />
          <p className="ag-sh-sub">
            {s.agent}
            <span className="sep" />
            {s.project}
            {s.branch && (
              <>
                <span className="sep" />
                <span className="mono truncate">{s.branch}</span>
              </>
            )}
          </p>
        </div>
        {s.usage && s.usage.window > 0 && <ContextRing used={s.usage.used} window={s.usage.window} />}
        <span className="ag-acts">
          <SessionMemory id={s.id} live={active && s.status !== "ended" && s.status !== "failed" && !s.restored} />
          {s.changes > 0 && <HeaderButton tip="Diff (Alt 1)" label="Diff" icon="diff" size={14} onClick={onReview} />}
          <HeaderButton
            tip="Continue in a terminal (Alt 2)"
            label="Continue in a terminal"
            icon="term"
            size={14}
            onClick={() => void api.agentTerminal(s.id)}
          />
          {working && (
            <HeaderButton
              tip={s.paused ? "Resume" : "Pause"}
              label={s.paused ? "Resume" : "Pause"}
              icon={s.paused ? "play" : "pause"}
              onClick={() => (s.paused ? resumePaused(s.id) : pauseSession(s.id))}
            />
          )}
          {working ? (
            <HeaderButton tip="Stop (Esc)" label="Stop" icon="stop" danger onClick={() => interruptSession(s.id)} />
          ) : (
            <HeaderButton tip="Close session" label="Close session" icon="x" onClick={() => closeSession(s.id)} />
          )}
        </span>
      </div>
      <TrialBar session={s} working={working} />
      {working && s.activeMode !== s.mode && <p className="ak-note ag-sh-note">New mode applies to the next message</p>}
    </>
  );
}

function HeaderButton({
  tip,
  label,
  icon,
  size = 13,
  danger,
  onClick,
}: {
  tip: string;
  label: string;
  icon: IcName;
  size?: number;
  danger?: boolean;
  onClick: () => void;
}) {
  return (
    <Tip label={tip}>
      <button type="button" aria-label={label} onClick={onClick} className={`ak-ibtn chip${danger ? " danger" : ""}`}>
        <Ic name={icon} size={size} />
      </button>
    </Tip>
  );
}
