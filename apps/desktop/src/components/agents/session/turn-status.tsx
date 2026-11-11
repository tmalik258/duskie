"use client";

// While a turn runs: what the agent is doing now, or the permission it asks for.

import { useMemo } from "react";
import { activityLabel, useActivities } from "@/lib/activities";
import { answerQuestion, type Session } from "@/lib/agents";
import { useNow } from "@/lib/hooks";
import { clock } from "./format";

/** The running step (or the last activity) with a timer for this turn. */
export function WorkingStatus({ session: s, active }: { session: Session; active: boolean }) {
  const activity = useActivities((state) => state.activities.find((a) => a.parentId === s.id && !a.dismissed));
  const now = useNow(active ? 250 : 60_000);
  const current = useMemo(() => {
    const step = [...s.entries].reverse().find((e) => e.kind === "step" && e.step.state === "running");
    return step && step.kind === "step" ? step.step.label : null;
  }, [s.entries]);
  return (
    <p className="ak-status" role="status" aria-live="polite">
      <span className="shimmer-text text-[rgb(235_235_245/0.6)]">
        {activity
          ? activityLabel(activity, now, { elapsed: false })
          : current
            ? `${current}...`
            : "Waiting for the next agent step"}
      </span>
      <span className="ak-timer mono">{clock(now - s.turnAt)}</span>
    </p>
  );
}

/** "Claude Code wants to: ..." with Allow, Allow this session and Deny. */
export function QuestionCard({ session: s }: { session: Session }) {
  const q = s.question;
  if (!q) return null;
  const answers = [
    { answer: "allow", label: "Allow", key: "A", primary: true },
    { answer: "always", label: "Allow this session", key: "Y", primary: false },
    { answer: "deny", label: "Deny", key: "N", primary: false },
  ] as const;
  return (
    <div className="ak-ask ak-in" role="alertdialog" aria-label={`${s.agent} asks`}>
      <p>
        {s.agent} wants to: <span className="font-medium text-white">{q.label}</span>
      </p>
      {q.detail && <code className="mono ak-scroll">{q.detail.replace(/\\\\/g, "\\")}</code>}
      <div className="ak-chips">
        {answers.map((a) => (
          <button
            key={a.answer}
            type="button"
            onClick={() => answerQuestion(s.id, a.answer)}
            className={a.primary ? "ak-chip primary chip" : "ak-chip chip"}
          >
            {a.label}{" "}
            <kbd>
              <i className="alt-pre">Alt </i>
              {a.key}
            </kbd>
          </button>
        ))}
      </div>
    </div>
  );
}
