"use client";

// What hovering the island shows about agents and things that finished:
// a line per agent (the one waiting for you first, answered right there),
// and, after you were away, what finished or is waiting meanwhile.

import { answerQuestion, interruptSession, type Session } from "@/lib/agents";
import { useNow } from "@/lib/hooks";
import { limitNote } from "./agents/session/format";
import { agentRow, liveSessions, openSession, useKeys } from "./island-agents/away-ms";
import { CardChips, CardHead, CardList, CardNote, type CardRow } from "./island-card";

/** Agents on the glance: permission first, otherwise the working list. */
export function NeedsYouSection({ sessions }: { sessions: Session[] }) {
  const now = useNow(1000);
  const live = liveSessions(sessions);
  const waiting = sessions.find((s) => s.question);
  const question = waiting?.question;
  const allow = question ? () => answerQuestion(waiting.id, "allow") : undefined;
  const always = question ? () => answerQuestion(waiting.id, "always") : undefined;
  const deny = question ? () => answerQuestion(waiting.id, "deny") : undefined;
  const lead = waiting ?? live[0];
  const open = lead ? () => openSession(lead.id) : undefined;
  const cancelAll = () => {
    for (const s of live) interruptSession(s.id);
  };
  useKeys({
    Enter: allow ?? open,
    "Alt Y": always,
    "Alt N": deny,
    "Alt O": open,
    "Alt X": live.length > 0 && !question ? cancelAll : undefined,
  });
  if (waiting && question) {
    const others = live.filter((s) => s !== waiting);
    const othersAsk = others.some((s) => s.question);
    const limited = sessions.find((x) => x.limit);
    const rows: CardRow[] = [
      {
        key: waiting.id,
        dot: "wait",
        title: waiting.title,
        detail: `Wants to ${question.label.toLowerCase()}${question.detail ? ` ${question.detail}` : ""}`,
        right: "Waiting",
        onClick: () => openSession(waiting.id),
      },
      ...others.map((s) => agentRow(s, now)),
    ];
    return (
      <div className="mt-3 flex flex-col">
        <CardHead title={`${waiting.agent} needs you`} detail={`${waiting.title} \u00b7 ${waiting.project}`} />
        <CardList rows={rows} />
        {limited?.limit && <CardNote>{limitNote(limited.agent, limited.limit)}</CardNote>}
        {others.length > 0 && (
          <p
            className="px-3 pt-1 text-[12px] text-[rgb(235_235_245/0.45)]"
            style={{ marginLeft: "calc(var(--orb-indent, 0px) * -1)" }}
          >
            {others.length} more {othersAsk ? "running" : "working · nothing else needs you"}
          </p>
        )}
        <CardChips
          options={[
            {
              label: `Allow ${question.detail || question.label.toLowerCase()}`,
              keys: "Enter",
              run: () => answerQuestion(waiting.id, "allow"),
            },
            { label: "Allow this session", keys: "Alt Y", run: () => answerQuestion(waiting.id, "always") },
            { label: "Deny", keys: "Alt N", run: () => answerQuestion(waiting.id, "deny") },
            { label: "Open in Agents", keys: "Alt O", run: () => openSession(waiting.id) },
          ]}
        />
      </div>
    );
  }
  const first = live[0];
  if (!first) return null;
  const limited = live.find((x) => x.limit);
  const title = live.length === 1 ? `${first.agent} is working` : `${live.length} agents working`;
  const detail =
    live.length === 1 ? `${first.title} \u00b7 ${first.project}` : live.map((s) => s.agent).join(" \u00b7 ");
  return (
    <div className="mt-3 flex flex-col">
      <CardHead title={title} detail={detail} />
      <CardList label="Running" rows={live.map((s) => agentRow(s, now))} />
      {limited?.limit && <CardNote>{limitNote(limited.agent, limited.limit)}</CardNote>}
      <CardChips
        options={[
          {
            label: live.length === 1 ? "Open in Agents" : "Open Agents",
            keys: "Enter",
            run: () => openSession(first.id),
          },
          { label: live.length === 1 ? "Cancel" : "Cancel all", keys: "Alt X", run: cancelAll },
        ]}
      />
    </div>
  );
}

/** @deprecated Prefer NeedsYouSection inside the unified glance. */
export function AgentsGlance({ sessions }: { sessions: Session[] }) {
  return <NeedsYouSection sessions={sessions} />;
}
