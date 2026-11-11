"use client";

// Part of board: Tile, ago, PICK_NOTE.

import { useState } from "react";
import { answerQuestion, resumeSession, type Session, useAgents } from "@/lib/agents";
import { agoText } from "@/lib/time-text";
import { AgentMark, agentMarkId } from "../marks";
import { NameField } from "../session/name-field";
import { firstAsk, lastSay, lastSteps, plain, state } from "./state";

export function Tile({ s, n, focused }: { s: Session; n: number; focused: boolean }) {
  const [st, label] = state(s);
  const planDone = s.plan.filter((p) => p.status === "completed").length;
  const ctx = s.usage ? Math.round(Math.min(1, s.usage.used / s.usage.window) * 100) : null;
  const [note, setNote] = useState<string | null>(null);
  const say = st === "done" || st === "off" ? lastSay(s) : null;
  const progress = s.plan.length ? Math.round((planDone / s.plan.length) * 100) : (ctx ?? 0);
  const foot =
    st === "ask"
      ? "Waiting for you"
      : st === "done" || st === "off"
        ? s.localModel
          ? `${label} · ${s.localModel}`
          : label
        : [s.plan.length ? `${planDone} of ${s.plan.length}` : null, ctx !== null ? `${ctx}% context` : null]
            .filter(Boolean)
            .join(" · ") || "Starting";
  const open = () => useAgents.setState({ current: s.id, layout: "one" });
  return (
    // biome-ignore lint/a11y/useSemanticElements: a tile holds buttons, so it cannot be one
    <div
      role="button"
      tabIndex={0}
      className="ak-tile"
      data-s={st}
      data-agent={agentMarkId(s.agent)}
      data-focus={focused}
      onClick={() => useAgents.setState({ focus: s.id })}
      onDoubleClick={(e) => !(e.target as HTMLElement).closest("button, input") && open()}
      onKeyDown={(e) => e.key === "Enter" && e.target === e.currentTarget && open()}
    >
      <div className="ak-th">
        <AgentMark agent={s.agent} />
        <span className="min-w-0">
          <NameField id={s.id} title={s.title} />
          <span className="ak-tm">
            {s.agent}
            {s.project ? ` · ${s.project}` : ""}
            {s.branch ? ` · ⎇ ${s.branch}` : ""}
          </span>
        </span>
        <span className="ak-pill" data-s={st}>
          <i className="ak-pdot" aria-hidden="true" />
          {label}
        </span>
      </div>
      {s.question ? (
        <>
          <p className="ak-tsay">
            {s.question.label}
            {s.question.detail && (
              <>
                {" "}
                <code>{s.question.detail}</code>
              </>
            )}
          </p>
          <div className="ak-tacts">
            <button type="button" className="ak-chip primary chip" onClick={() => answerQuestion(s.id, "allow")}>
              Allow
            </button>
            <button type="button" className="ak-chip chip" onClick={() => answerQuestion(s.id, "always")}>
              Allow this session
            </button>
            <button type="button" className="ak-chip chip" onClick={() => answerQuestion(s.id, "deny")}>
              No
            </button>
          </div>
        </>
      ) : say ? (
        <>
          <p className="ak-tsay ak-tclamp">{plain(say)}</p>
          <div className="ak-tacts">
            <button type="button" className="ak-chip chip" onClick={open}>
              Open
            </button>
            {st === "off" && (
              <button
                type="button"
                className="ak-chip chip"
                onClick={() => void resumeSession(s.id).catch((e) => setNote(String(e)))}
              >
                Resume
              </button>
            )}
          </div>
        </>
      ) : lastSteps(s).length === 0 && firstAsk(s) ? (
        <p className="ak-tsay ak-tclamp ak-tasked">{plain(firstAsk(s))}</p>
      ) : (
        <ul className="ak-tlog">
          {lastSteps(s).map((t, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: short fixed list
            <li key={i}>
              <span className="k">{t.tag}</span>
              <span className={t.live ? "live" : undefined}>{t.text}</span>
            </li>
          ))}
        </ul>
      )}
      {note && <p className="ak-tnote">{note}</p>}
      <div className="ak-tf">
        {st === "run" || st === "ask" ? (
          <span className="ak-tbar">
            <i className="ak-tfill" style={{ width: `${Math.max(4, progress)}%` }} />
          </span>
        ) : null}
        <span className={st === "run" || st === "ask" ? undefined : "flex-1"}>{foot}</span>
        {n <= 9 && <span className="ak-tkey">Ctrl {n}</span>}
      </div>
    </div>
  );
}

export const ago = (t: number) => agoText(t, { suffix: true, atLeastOne: true, days: true });

export const PICK_NOTE: Record<string, string> = {
  claude_code: "Cloud",
  codex: "Cloud",
  local: "This PC",
};
