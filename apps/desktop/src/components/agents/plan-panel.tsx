"use client";

import { useEffect, useState } from "react";
import { Ic } from "@/components/icon";
import { buildSessionPlan, type Session, sendToSession, setSessionPlan } from "@/lib/agents";
import { Markdown } from "@/lib/markdown";
import { claimsPlanReady, looksLikeQuestionPlan, parsePlanDocument, planFromSession } from "@/lib/plan";

/** Full plan document for Plan mode - raw markdown from the agent, not a compressed checklist. */
export function PlanPanel({ session: s, onDraft }: { session: Session; onDraft?: (text: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const plan = s.plan;
  const doc = s.planDoc;
  const phase = s.planPhase ?? (hasPlan(s) ? "ready" : null);
  const lastText = [...s.entries].reverse().find((e) => e.kind === "text");
  const readyClaim = lastText?.kind === "text" && claimsPlanReady(lastText.text) && !doc?.markdown && plan.length === 0;
  const showEmpty = s.mode === "plan" && !doc?.markdown && plan.length === 0 && readyClaim && s.status === "idle";
  const hasBody = !!doc?.markdown || plan.length > 0;

  useEffect(() => {
    if (s.mode !== "plan") return;
    if (s.planDoc?.markdown) return;
    const { items, doc: next } = planFromSession(s.plan, s.entries);
    if (items.length === 0 && !next) return;
    const bad = looksLikeQuestionPlan(s.plan);
    const richer =
      items.length > s.plan.length || bad || (items.some((p) => !!p.detail) && !s.plan.some((p) => !!p.detail));
    const needDoc = !!next && (!s.planDoc || s.planDoc.markdown !== next.markdown);
    if (richer || needDoc) setSessionPlan(s.id, items, next);
  }, [s.id, s.mode, s.plan, s.planDoc, s.entries]);

  useEffect(() => {
    if (!editing) setDraft(doc?.markdown ?? plan.map((p, i) => `${i + 1}. ${p.text}`).join("\n"));
  }, [editing, doc, plan]);

  if (!hasBody && !showEmpty) return null;

  const saveEdits = () => {
    const parsed = parsePlanDocument(draft);
    const items =
      parsed?.items ??
      draft
        .split("\n")
        .map((line) =>
          line
            .replace(/^\s*\d+[.)]\s*/, "")
            .replace(/\*\*/g, "")
            .trim(),
        )
        .filter((t) => t.length > 0)
        .map((text) => ({ text, status: "pending" as const }));
    const nextDoc = parsed ?? { title: "Plan", items, markdown: draft.trim() };
    if (!nextDoc.markdown.trim() && items.length === 0) return;
    setSessionPlan(s.id, items.length > 0 ? items : plan, nextDoc, s.planEntry ?? null);
    setEditing(false);
    sendToSession(s.id, `Please revise the plan to:\n\n${draft.trim()}`);
  };

  const askForPlan = () => {
    sendToSession(
      s.id,
      "Show the full plan as a numbered list of concrete steps with detail under each. Update the collaboration plan with those steps.",
    );
  };

  if (!hasBody) {
    return (
      <div className="ak-plan-doc ak-in">
        <div className="ak-plan-doc-h">
          <span>Plan</span>
          <span>Not listed yet</span>
        </div>
        <p className="ak-plan-doc-empty">
          {readyClaim ? "The agent said the plan is ready, but no steps were listed." : "Waiting for plan steps."}
        </p>
        <div className="ak-chips mt-1">
          <button type="button" className="ak-chip primary chip" onClick={askForPlan}>
            Show plan steps
          </button>
        </div>
      </div>
    );
  }

  const done = plan.filter((p) => p.status === "completed").length;
  const at = plan.length > 0 ? Math.min(done + 1, plan.length) : 0;
  const title = doc?.title || "Plan";
  const showReadyActions = s.mode === "plan" && s.status === "idle" && phase !== "building" && phase !== "built";

  return (
    <div className="ak-plan-doc ak-in">
      <div className="ak-plan-doc-h">
        <span>Plan</span>
        <span>
          {phase === "built"
            ? "Built"
            : phase === "building"
              ? "Building"
              : plan.length > 0
                ? `${at} of ${plan.length}`
                : title}
        </span>
      </div>
      {editing ? (
        <textarea
          className="ak-plan-edit"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={Math.min(28, Math.max(10, draft.split("\n").length + 2))}
          aria-label="Edit plan"
        />
      ) : (
        <div className="ak-plan-doc-body">
          {doc?.markdown ? (
            <div className="ak-plan-md">
              <Markdown text={doc.markdown} />
            </div>
          ) : (
            <>
              <p className="ak-plan-doc-title">{title}</p>
              <ol className="ak-plan-doc-steps">
                {plan.map((p, i) => (
                  <li key={`${p.status}:${p.text}`} className="ak-plan-step" data-s={p.status}>
                    <div className="ak-plan-step-h">
                      <span className="ak-cb" aria-hidden="true" />
                      <span className="ak-plan-step-n">{i + 1}.</span>
                      <span className="ak-plan-step-t">{p.text}</span>
                    </div>
                    {p.detail && (
                      <div className="ak-plan-step-d">
                        <Markdown text={p.detail} />
                      </div>
                    )}
                  </li>
                ))}
              </ol>
            </>
          )}
        </div>
      )}
      {phase === "built" ? (
        <div className="ak-chips mt-1.5">
          <button type="button" className="ak-chip chip ak-plan-built" disabled aria-label="Built">
            <Ic name="check" size={12} />
            Built
          </button>
        </div>
      ) : phase === "building" ? (
        <div className="ak-chips mt-1.5">
          <button type="button" className="ak-chip chip" disabled aria-busy="true">
            Building...
          </button>
        </div>
      ) : showReadyActions ? (
        <div className="ak-chips mt-1.5">
          {editing ? (
            <>
              <button type="button" className="ak-chip primary chip" onClick={saveEdits}>
                Save &amp; send
              </button>
              <button type="button" className="ak-chip chip" onClick={() => setEditing(false)}>
                Cancel
              </button>
            </>
          ) : (
            <>
              <button type="button" className="ak-chip primary chip" onClick={() => void buildSessionPlan(s.id)}>
                Build
              </button>
              <button type="button" className="ak-chip chip" onClick={() => setEditing(true)}>
                Edit
              </button>
              <button type="button" className="ak-chip chip" onClick={() => onDraft?.("Please revise the plan: ")}>
                Ask to revise
              </button>
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}

function hasPlan(s: Session): boolean {
  return !!s.planDoc?.markdown || s.plan.length > 0;
}
