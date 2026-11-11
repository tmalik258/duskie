// Short spoken or typed follow-ups after an answer: "do it" takes the top
// offer, "is it fixed now?" runs the same check again.

import { extractChoices } from "./options";

export type FollowUp = { kind: "run"; id: string } | { kind: "send"; text: string } | null;

const DO_IT =
  /^(ok(ay)?[, ]+)?(do it|fix it|go ahead|yes,? do (it|that)|do that|run it|try (it|that)|go for it)[.!]*$/i;
const RECHECK = /^(is it (fixed|working|better|done)( now)?|did (it|that) work|check again|is it ok now)[?.!]*$/i;

interface Turn {
  role: string;
  content: string;
  proposals?: { id: string; ran?: unknown }[];
}

/** What a follow-up means given the conversation so far; null to send it as is. */
export function followUp(q: string, turns: Turn[]): FollowUp {
  const text = q.trim();
  const answer = turns.findLast((t) => t.role === "assistant");
  if (DO_IT.test(text) && answer) {
    const offer = answer.proposals?.find((p) => !p.ran);
    if (offer) return { kind: "run", id: offer.id };
    const option = extractChoices(answer.content).options[0];
    if (option) return { kind: "send", text: option };
    return null;
  }
  if (RECHECK.test(text)) {
    const asked = turns.findLast((t) => t.role === "user" && !DO_IT.test(t.content.trim()));
    if (asked) return { kind: "send", text: `Check again now, from scratch: ${asked.content}` };
  }
  return null;
}
