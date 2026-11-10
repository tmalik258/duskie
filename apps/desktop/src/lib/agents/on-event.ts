// Agent events from the core, folded into each session.

import { parseChoose } from "../agent-questions";
import { EVENTS, listen } from "../bridge";
import { mask } from "../mask";
import type { AgentMode } from "../types";
import { type AgentEvent, planDocSeen, stepEntry, turnDone, usageSeen } from "./event-reducers";
import { type Session, update, useAgents } from "./session";
import { appendReview, type Entry, entriesCancelRunning, noteUsage, type PlanItem } from "./timeline";

function onEvent(e: AgentEvent) {
  const id = e.session;
  switch (e.kind) {
    case "working":
      return update(id, (s) => ({
        ...s,
        status: s.question ? "waiting" : "working",
        activeMode: (e.mode as AgentMode) ?? s.activeMode ?? s.mode,
      }));
    case "control_error":
      return update(id, (s) => ({ ...s, error: String(e.error) }));
    case "compaction":
      return update(id, (s) => ({ ...s, compaction: e.state as Session["compaction"] }));
    case "text":
      return update(id, (s) => {
        const last = s.entries.at(-1);
        const text = String(e.text ?? "");
        const entries: Entry[] =
          last?.kind === "text"
            ? [...s.entries.slice(0, -1), { kind: "text", text: mask(last.text + text) }]
            : [...s.entries, { kind: "text", text: mask(text) }];
        return { ...s, entries };
      });
    case "cancel_steps":
      return update(id, (s) => ({ ...s, entries: entriesCancelRunning(s.entries) }));
    case "step":
      return update(id, (s) => stepEntry(s, e));
    case "stuck":
      return update(id, (s) => ({ ...s, stuck: true }));
    case "model":
      return update(id, (s) => ({ ...s, localModel: String(e.name ?? "") }));
    case "plan": {
      const items = (e.items as PlanItem[]) ?? [];
      return update(id, (s) => {
        const planDoc = s.planDoc?.markdown
          ? { ...s.planDoc, items: items.length > 0 ? items : s.planDoc.items }
          : s.planDoc;
        return { ...s, plan: items, planDoc };
      });
    }
    case "plan_doc":
      return update(id, (s) => planDocSeen(s, e));
    case "usage":
      return update(id, (s) => usageSeen(s, e));
    case "limit":
      if (typeof e.used === "number") {
        const agent = useAgents.getState().sessions.find((x) => x.id === id)?.agent;
        if (agent)
          noteUsage(agent, {
            used: e.used,
            window: String(e.window ?? ""),
            resetsAt: typeof e.resetsAt === "number" ? e.resetsAt : null,
            at: Date.now(),
          });
      }
      return update(id, (s) => ({
        ...s,
        limit:
          e.status === "allowed"
            ? null
            : {
                status: String(e.status),
                window: String(e.window ?? ""),
                resetsAt: typeof e.resetsAt === "number" ? e.resetsAt : null,
                used: typeof e.used === "number" ? e.used : null,
              },
      }));
    case "ask":
      return update(id, (s) => ({
        ...s,
        status: "waiting",
        question: { id: String(e.question), label: String(e.label ?? ""), detail: String(e.detail ?? "") },
      }));
    case "choose": {
      const choose = parseChoose(e);
      return choose ? update(id, (s) => ({ ...s, choose })) : undefined;
    }
    case "answered":
      return update(id, (s) => (s.question?.id === e.question ? { ...s, question: null } : s));
    case "turn_diff": {
      const diff = String(e.diff ?? "");
      if (!diff.trim()) return;
      return update(id, (s) => ({ ...s, changes: Math.max(s.changes, 1) }));
    }
    case "turn":
      return update(id, (s) => turnDone(s, e));
    case "ended":
      return update(id, (s) => ({
        ...s,
        status: e.error ? "failed" : "ended",
        tookMs: s.tookMs ?? Date.now() - s.turnAt,
        error: e.error ? String(e.error) : s.error,
        changes: Number(e.changes ?? 0),
        question: null,
        entries: appendReview(s.entries, e.review),
      }));
  }
}

let started = false;

/** Listens for agent events once, for the island window. */
export function listenToAgents() {
  if (started) return;
  started = true;
  void listen(EVENTS.agentEvent, onEvent);
}
