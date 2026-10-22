// Pure updates for the bigger agent events: steps, plan docs, usage and turns.

import { claimsPlanReady, parsePlanDocument } from "../plan";
import type { Session } from "./session";
import { appendReview, COMPACT_AT, lastTextEntry, type Step } from "./timeline";

/** One agent event as the core sends it. */
export type AgentEvent = { session: string; kind: string } & Record<string, unknown>;

export function stepEntry(s: Session, e: AgentEvent): Session {
  const at = s.entries.findIndex((x) => x.kind === "step" && x.step.id === e.id);
  if (at >= 0) {
    const entries = [...s.entries];
    const old = entries[at] as { kind: "step"; step: Step };
    // Prefer the longer text so a completed web search query replaces "Search the web".
    const prefer = (next: unknown, prev: string) => {
      const n = String(next ?? "").trim();
      if (!n) return prev;
      return n.length >= prev.trim().length ? String(next ?? "") : prev;
    };
    entries[at] = {
      kind: "step",
      step: {
        ...old.step,
        state: e.state as Step["state"],
        label: prefer(e.label, old.step.label),
        detail: prefer(e.detail, old.step.detail),
        output: (e.output as string) || old.step.output,
      },
    };
    return { ...s, entries };
  }
  const step: Step = {
    id: String(e.id ?? crypto.randomUUID()),
    tool: String(e.tool ?? ""),
    label: String(e.label ?? ""),
    detail: String(e.detail ?? ""),
    state: (e.state as Step["state"]) ?? "running",
  };
  return { ...s, entries: [...s.entries, { kind: "step", step }] };
}

export function turnDone(s: Session, e: AgentEvent): Session {
  const entries = appendReview(s.entries, e.review);
  // Plan mode often answers in prose without turn/plan/updated, lift the doc.
  let plan = s.plan;
  let planDoc = s.planDoc;
  let planEntry = s.planEntry ?? null;
  if (s.mode === "plan" || s.activeMode === "plan") {
    const last = entries.at(-1);
    if (last?.kind === "text" && claimsPlanReady(last.text)) {
      const raw = last.text;
      const doc = parsePlanDocument(raw);
      const existingLen = planDoc?.markdown?.length ?? 0;
      // Do not replace a fuller file/response plan with shorter chat prose.
      if (doc && doc.items.length > 0 && doc.markdown.length >= existingLen) {
        plan = doc.items;
        planDoc = doc;
        planEntry = entries.length - 1;
      } else if (!planDoc && raw.trim()) {
        // Keep the full answer even when it is not a numbered checklist.
        planDoc = { title: "Plan", items: plan, markdown: raw };
        planEntry = entries.length - 1;
      }
    }
  }
  const built = s.planPhase === "building" && !e.error;
  if (built) {
    plan = plan.map((p) => ({ ...p, status: "completed" as const }));
    if (planDoc) planDoc = { ...planDoc, items: plan };
  }
  return {
    ...s,
    status: e.error ? "failed" : "idle",
    error: e.error ? String(e.error) : null,
    tookMs: Date.now() - s.turnAt,
    changes: Number(e.changes ?? s.changes),
    entries,
    plan,
    planDoc,
    planEntry,
    planPhase: built ? "built" : s.planPhase === "building" && e.error ? "ready" : s.planPhase,
  };
}

export function usageSeen(s: Session, e: AgentEvent): Session {
  const usage = {
    used: Number(e.used),
    window: Number(e.window),
    total: typeof e.total === "number" ? e.total : undefined,
    at: Date.now(),
  };
  // After a compact the offer may come back the next time it fills up.
  const compactDismissed = s.compactDismissed && usage.used / usage.window >= COMPACT_AT;
  return { ...s, usage, compactDismissed };
}

export function planDocSeen(s: Session, e: AgentEvent): Session {
  const raw = String(e.text ?? "");
  const doc = parsePlanDocument(raw);
  const planEntry = lastTextEntry(s.entries);
  if (!doc) {
    return {
      ...s,
      planDoc: { title: "Plan", items: s.plan, markdown: raw },
      planEntry,
      planPhase: s.planPhase === "building" ? "building" : "ready",
    };
  }
  return {
    ...s,
    plan: doc.items.length > 0 ? doc.items : s.plan,
    planDoc: doc,
    planEntry,
    planPhase: s.planPhase === "building" ? "building" : "ready",
  };
}
