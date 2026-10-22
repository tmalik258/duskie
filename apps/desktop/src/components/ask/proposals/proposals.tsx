"use client";

// Part of proposals: Proposals.

import { useEffect, useRef, useState } from "react";
import { runProposal, useDuskie } from "@/lib/store";
import type { Proposal } from "@/lib/types";
import { Ic } from "../../icon";
import { Ran, UndoProposal, useAltDigits } from "./pending-count";
import { Plan } from "./plan";

/** Actions the answer offers: nothing runs until a tap, and Undo follows. */
export function Proposals({ items, keys }: { items: Proposal[]; keys: boolean }) {
  const [skipped, setSkipped] = useState<string[]>([]);
  const pending = items.filter((p) => !p.ran && !skipped.includes(p.id));
  const waiting = pending;
  useAltDigits(keys ? Math.min(pending.length, 9) : 0, 0, (n) => void runProposal(pending[n].id));
  // Alt U undoes the newest action that can be undone.
  const undoable = [...items].reverse().find((p) => p.ran?.ok && p.ran.undoId != null && !p.ran.undone);
  const undoRef = useRef<HTMLButtonElement | null>(null);
  useEffect(() => {
    if (!keys || !undoable) return;
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.altKey && !e.ctrlKey && e.key.toLowerCase() === "u") {
        e.preventDefault();
        undoRef.current?.click();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [keys, undoable]);
  // Do all: one tap runs every waiting action in order, stopping at the
  // first that fails so later steps never run on a broken one.
  const [busy, setBusy] = useState(false);
  const doAll = async () => {
    if (busy) return;
    setBusy(true);
    try {
      for (const p of pending) {
        await runProposal(p.id);
        const ran = useDuskie
          .getState()
          .turns.flatMap((t) => t.proposals ?? [])
          .find((x) => x.id === p.id)?.ran;
        if (!ran?.ok) break;
      }
    } finally {
      setBusy(false);
    }
  };
  const allRef = useRef(doAll);
  allRef.current = doAll;
  const many = pending.length >= 2;
  useEffect(() => {
    if (!keys || !many) return;
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.altKey && !e.ctrlKey && e.key.toLowerCase() === "a") {
        e.preventDefault();
        void allRef.current();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [keys, many]);
  // Steps of one task: a plan that runs in order with one Run.
  if (items.length >= 2 && items.some((p) => p.step)) return <Plan items={items} keys={keys} />;
  // One action is a button; several are a checklist that ticks as each runs.
  if (items.length < 2) {
    return (
      <div className="ak-chips">
        {items.map((p) =>
          p.ran ? (
            <Ran key={p.id} p={p} undoRef={p === undoable && keys ? undoRef : undefined} />
          ) : (
            <button
              key={p.id}
              type="button"
              onClick={() => void runProposal(p.id)}
              className="ak-chip primary chip ak-in"
            >
              {p.label}
              {keys && (
                <kbd>
                  <i className="alt-pre">Alt </i>1
                </kbd>
              )}
            </button>
          ),
        )}
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-1.5">
      <div className="rd-card-head">
        <p className="rd-eyebrow flex items-center gap-1.5">
          <span className="rd-dot" style={{ background: "#95a89a" }} />
          Duskie suggests
        </p>
        <p className="rd-title">
          {waiting.length === 1 ? "1 thing, your call" : `${waiting.length} things, your call`}
        </p>
        <p className="rd-detail">Each one only happens if you approve it.</p>
      </div>
      {items.map((p) => {
        const left = waiting.indexOf(p);
        const off = skipped.includes(p.id);
        return (
          <div key={p.id} className="rd-list-row mg-row" data-off={off || undefined}>
            <span style={{ color: "var(--ink-3)", display: "inline-flex" }}>
              <Ic name={p.ran ? (p.ran.ok ? "check" : "warn") : "dot"} size={12} />
            </span>
            <span className="t" style={{ fontFamily: "inherit", fontSize: 13, opacity: off ? 0.45 : 1 }}>
              {p.ran && !p.ran.ok ? p.ran.message : p.label}
            </span>
            {!p.ran && !off && (
              <span className="inline-flex gap-1">
                <button type="button" className="chip-s" onClick={() => setSkipped((x) => [...x, p.id])}>
                  Skip
                </button>
                <button type="button" className="chip-s" disabled={busy} onClick={() => void runProposal(p.id)}>
                  Approve
                  {keys && left < 9 && <kbd className="ml-1 opacity-60">Alt {left + 1}</kbd>}
                </button>
              </span>
            )}
            {p.ran?.ok && p.ran.undoId != null && !p.ran.undone && <UndoProposal proposal={p} />}
          </div>
        );
      })}
      <div className="mt-1 flex items-center gap-1.5">
        {waiting.length > 0 && (
          <button type="button" className="rd-btn primary" disabled={busy} onClick={() => void doAll()}>
            {busy ? "Working" : "Approve all"}
            {keys && !busy && <kbd className="ml-1.5 opacity-60">Alt A</kbd>}
          </button>
        )}
      </div>
    </div>
  );
}
