"use client";

// One agent at work, opened from its pill: which agent and project, what it
// is on, how far along the plan, its latest steps, and a way to open, pause
// or stop it.

import { useEffect } from "react";
import { answerText } from "@/lib/agent-questions";
import {
  answerQuestion,
  interruptSession,
  laterCard,
  pauseSession,
  resumePaused,
  type Session,
  type Step,
  sendToSession,
  useAgents,
} from "@/lib/agents";
import { api } from "@/lib/bridge";
import { useNow } from "@/lib/hooks";
import { Ic } from "./icon";

export function AgentCard({ id }: { id: string }) {
  const s = useAgents((st) => st.sessions.find((x) => x.id === id));
  const now = useNow(30_000);
  // Enter opens the session while the card is up.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Enter" || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
      if ((e.target as HTMLElement | null)?.closest("input, textarea, button")) return;
      e.preventDefault();
      useAgents.setState({ tab: "agents", current: id });
      void api.askOpen();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [id]);
  if (!s) return null;
  const waiting = s.status === "waiting";
  const waited = waiting && s.waitingSince ? Math.floor((now - s.waitingSince) / 60_000) : null;
  // One single-choice question can be answered right here; more opens the session.
  const choice = s.choose?.questions.length === 1 && !s.choose.questions[0].multiSelect ? s.choose : null;
  const plan = s.plan;
  const at = plan.findIndex((p) => p.status === "in_progress");
  const step = at >= 0 ? at : plan.filter((p) => p.status === "completed").length;
  const steps = s.entries
    .filter((e): e is { kind: "step"; step: Step } => e.kind === "step")
    .map((e) => e.step)
    .slice(-2);
  const open = () => {
    useAgents.setState({ tab: "agents", current: s.id });
    void api.askOpen();
  };
  return (
    <div className="rd-glance flex flex-col gap-3">
      <div className="rd-card-head">
        <p className="rd-eyebrow flex items-center gap-1.5">
          <span className="rd-dot" style={{ background: s.status === "waiting" ? "var(--warn)" : "#a8c0cc" }} />
          {s.agent} in {s.project}
          {waited !== null && <span className="rd-wait">· Waiting {waited < 1 ? "just now" : `${waited} min`}</span>}
        </p>
        <p className="rd-title">{s.title}</p>
        <p className="rd-detail">{choice ? choice.questions[0].question : detail(s, step)}</p>
      </div>
      {choice && (
        <div className="rd-answers">
          {choice.questions[0].options.slice(0, 4).map((o) => (
            <button
              key={o.label}
              type="button"
              className="rd-opt"
              title={o.description}
              onClick={() => sendToSession(s.id, answerText(choice, [[o.label]]))}
            >
              {o.label}
            </button>
          ))}
        </div>
      )}
      {s.question && (
        <div className="rd-answers">
          <button type="button" className="rd-opt" onClick={() => answerQuestion(s.id, "allow")}>
            Allow
          </button>
          <button type="button" className="rd-opt" onClick={() => answerQuestion(s.id, "deny")}>
            Deny
          </button>
        </div>
      )}
      {(plan.length > 1 || steps.length > 0) && (
        <div className="flex flex-col gap-1.5">
          {plan.length > 1 && (
            <div className="rd-steps" aria-hidden>
              {plan.map((p, i) => (
                <i key={p.text} data-s={p.status === "completed" ? "done" : i === step ? "now" : undefined} />
              ))}
            </div>
          )}
          {steps.map((st) => (
            <div key={st.id} className="rd-list-row mg-row">
              <span style={{ color: st.state === "failed" ? "var(--err)" : "var(--ink-3)", display: "inline-flex" }}>
                <Ic name={st.state === "failed" ? "x" : st.state === "running" ? "dot" : "check"} size={12} />
              </span>
              <span className="t mono">{st.label}</span>
              {st.detail && <span className="r">{st.detail}</span>}
            </div>
          ))}
        </div>
      )}
      <div className="flex items-center gap-2">
        <button type="button" className="rd-btn primary" onClick={open}>
          Open session <kbd className="rd-kbd">Enter</kbd>
        </button>
        <button type="button" className="rd-btn ghost" onClick={() => laterCard(s.id)}>
          Later
        </button>
        {(s.status === "working" || s.paused) && (
          <button
            type="button"
            className="rd-btn ghost chip-s ic-only"
            aria-label={s.paused ? "Resume" : "Pause"}
            title={s.paused ? "Resume" : "Pause"}
            onClick={() => (s.paused ? resumePaused(s.id) : pauseSession(s.id))}
          >
            <Ic name={s.paused ? "play" : "pause"} size={12} />
          </button>
        )}
        {s.status === "working" && (
          <button
            type="button"
            className="rd-btn ghost ml-auto chip-s ic-only"
            aria-label="Stop"
            style={{ color: "var(--err)" }}
            onClick={() => interruptSession(s.id)}
          >
            <Ic name="stop" size={12} />
          </button>
        )}
      </div>
    </div>
  );
}

function detail(s: Session, step: number): string {
  const where = s.branch;
  if (s.status === "waiting") return s.question?.label ?? "Waiting for your answer.";
  if (s.plan.length > 1)
    return `Step ${Math.min(step + 1, s.plan.length)} of ${s.plan.length}${where ? `, on ${where}` : ""}`;
  return where ? `On ${where}` : "Working";
}
