// Hand off, resume, rewind and answer a session's question.

import { api } from "../bridge";
import { handOff, type Session, update, useAgents } from "./session";

/** Hands a stuck session to the agent that gets handoffs, with what was
 * said so far. */
export function handOffSession(s: Session) {
  const messages = s.entries.flatMap((e): { role: "user" | "assistant"; content: string }[] =>
    e.kind === "you"
      ? [{ role: "user", content: e.text }]
      : e.kind === "text"
        ? [{ role: "assistant", content: e.text }]
        : [],
  );
  update(s.id, (x) => ({ ...x, stuck: false }));
  return handOff(messages, `${s.agent} got stuck in ${s.project}`);
}

/** Starts the agent again in its own earlier session, after it ended or
 * Duskie restarted. */
export async function resumeSession(id: string) {
  await api.agentResume(id);
  update(id, (s) => ({ ...s, status: "idle", restored: false, error: null }));
}

/** Puts the code back to before the user's message at `entry` (an index in
 * entries) and drops what came after; the next message tells the agent. */
export async function rewindSession(id: string, entry: number): Promise<number> {
  const s = useAgents.getState().sessions.find((x) => x.id === id);
  if (!s) return 0;
  const index = s.entries.slice(0, entry).filter((e) => e.kind === "you").length;
  const said = s.entries[entry]?.kind === "you" ? (s.entries[entry] as { text: string }).text : "";
  const n = await api.agentRewind(id, index);
  update(id, (x) => ({
    ...x,
    entries: x.entries.slice(0, entry),
    plan: [],
    planDoc: null,
    planEntry: null,
    planPhase: null,
    note: `(I rewound this conversation to before my message "${said.slice(0, 80)}". The file changes made after it were undone. Ignore everything after that point and work from here.)`,
  }));
  return n;
}

/** Which user message an entry is, counting from 0, for Rewind. */
export function messageIndex(s: Session, entry: number): number {
  return s.entries.slice(0, entry).filter((e) => e.kind === "you").length;
}

export function answerQuestion(id: string, answer: "allow" | "always" | "deny") {
  const s = useAgents.getState().sessions.find((x) => x.id === id);
  if (!s?.question) return;
  void api.agentAnswer(s.question.id, answer);
  update(id, (x) => ({ ...x, question: null, status: "working" }));
}
