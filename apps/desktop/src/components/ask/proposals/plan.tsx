"use client";

// Part of proposals: Plan.

import { useEffect, useRef, useState } from "react";
import { runProposal, undoProposal, useDuskie } from "@/lib/store";
import type { Proposal } from "@/lib/types";

/** A task's steps, shown before anything runs: Run (Enter) does them in
 * order, ticking each off, and stops at the first that fails. Undo all
 * (Alt U) puts back what can be put back. */
export function Plan({ items, keys }: { items: Proposal[]; keys: boolean }) {
  const [state, setState] = useState<"ready" | "running" | "cancelled">("ready");
  const [at, setAt] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const pending = items.filter((p) => !p.ran);
  const started = items.some((p) => p.ran);
  const undoable = items.filter((p) => p.ran?.ok && p.ran.undoId != null && !p.ran.undone);
  const run = async () => {
    if (state !== "ready" || pending.length === 0) return;
    setState("running");
    try {
      for (const p of pending) {
        setAt(p.id);
        await runProposal(p.id);
        const ran = useDuskie
          .getState()
          .turns.flatMap((t) => t.proposals ?? [])
          .find((x) => x.id === p.id)?.ran;
        if (!ran?.ok) break;
      }
    } finally {
      setAt(null);
      setState("ready");
    }
  };
  const undoAll = async () => {
    for (const p of [...undoable].reverse()) await undoProposal(p.id).catch(() => undefined);
    setNote(`Put back ${undoable.length} ${undoable.length === 1 ? "step" : "steps"}.`);
  };
  const runRef = useRef(run);
  runRef.current = run;
  const undoRef = useRef(undoAll);
  undoRef.current = undoAll;
  const live = keys && state !== "cancelled";
  useEffect(() => {
    if (!live) return;
    const onKey = (e: globalThis.KeyboardEvent) => {
      // Enter runs the plan while the box is empty; Alt Z undoes it.
      const empty = !(e.target instanceof HTMLInputElement) || e.target.value.trim() === "";
      if (e.key === "Enter" && !e.altKey && !e.ctrlKey && !e.shiftKey && empty && !started) {
        e.preventDefault();
        void runRef.current();
      } else if (e.altKey && !e.ctrlKey && e.key.toLowerCase() === "u") {
        e.preventDefault();
        void undoRef.current();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [live, started]);
  const stepState = (p: Proposal) =>
    p.ran ? (p.ran.undone ? "undone" : p.ran.ok ? "done" : "failed") : at === p.id ? "running" : "waiting";
  const done = items.filter((p) => p.ran?.ok).length;
  return (
    <div className="ak-body">
      <div className="ak-plan ak-in" aria-live="polite">
        <div className="head">
          Plan · {items.length} steps
          {started && (
            <span className="ak-timer mono">
              {done} of {items.length} done
            </span>
          )}
        </div>
        {items.map((p, i) => {
          const s = stepState(p);
          return (
            <div key={p.id} className="ak-st ak-in" data-s={s} style={{ animationDelay: `${i * 40}ms` }}>
              <span className="n mono">{s === "done" ? "✓" : s === "failed" ? "✕" : i + 1}</span>
              <span className="min-w-0">
                {p.label}
                {!started && (
                  <span className="ml-1.5 text-[11px] opacity-60">
                    {p.undoable ? "can be undone" : "cannot be undone"}
                  </span>
                )}
                {s === "failed" && p.ran && <span className="block text-[12px]">{p.ran.message}</span>}
              </span>
            </div>
          );
        })}
      </div>
      {state === "cancelled" ? (
        <p className="ak-done">Cancelled. Nothing ran.</p>
      ) : note ? (
        <p className="ak-done">{note}</p>
      ) : (
        <div className="ak-chips">
          {!started && (
            <>
              <button type="button" onClick={() => void run()} className="ak-chip primary chip">
                Run <kbd>Enter</kbd>
              </button>
              <button type="button" onClick={() => setState("cancelled")} className="ak-chip chip">
                Cancel
              </button>
            </>
          )}
          {started && pending.length > 0 && state === "ready" && (
            <button type="button" onClick={() => void run()} className="ak-chip primary chip">
              Run the rest
            </button>
          )}
          {undoable.length > 0 && state === "ready" && (
            <button type="button" onClick={() => void undoAll()} className="ak-chip chip">
              Undo all{" "}
              <kbd>
                <i className="alt-pre">Alt </i>U
              </kbd>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
