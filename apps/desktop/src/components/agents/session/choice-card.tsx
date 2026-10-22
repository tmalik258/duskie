"use client";

import { useState } from "react";
import { answerText, type OpenChoice } from "@/lib/agent-questions";

/** The agent's own multiple-choice question: tap an option to answer. With
 * several questions, each is answered in turn; "Several" questions allow
 * more than one pick. */
export function ChoiceCard({
  open,
  agent,
  onAnswer,
}: {
  open: OpenChoice;
  agent: string;
  onAnswer: (text: string) => void;
}) {
  const [picks, setPicks] = useState<string[][]>([]);
  const at = picks.length;
  const [multi, setMulti] = useState<string[]>([]);
  const q = open.questions[at];
  if (!q) return null;
  const next = (chosen: string[]) => {
    const all = [...picks, chosen];
    setMulti([]);
    if (all.length >= open.questions.length) onAnswer(answerText(open, all));
    else setPicks(all);
  };
  return (
    <section className="ak-ask ak-in" aria-label={`${agent} asks`}>
      <p>
        {agent} asks: <span className="font-medium text-white">{q.question}</span>
      </p>
      <div className="ak-chips">
        {q.options.map((o) => {
          const on = multi.includes(o.label);
          return (
            <button
              key={o.label}
              type="button"
              title={o.description}
              aria-pressed={q.multiSelect ? on : undefined}
              onClick={() =>
                q.multiSelect
                  ? setMulti(on ? multi.filter((m) => m !== o.label) : [...multi, o.label])
                  : next([o.label])
              }
              className={`ak-chip chip ${on ? "primary" : ""}`}
            >
              {o.label}
            </button>
          );
        })}
        {q.multiSelect && (
          <button type="button" onClick={() => next(multi)} className="ak-chip primary chip">
            Done
          </button>
        )}
      </div>
    </section>
  );
}
