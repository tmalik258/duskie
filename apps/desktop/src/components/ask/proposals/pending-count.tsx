"use client";

// Part of proposals: pendingCount, useAltDigits, UndoProposal, Ran.

import { type RefObject, useEffect, useRef, useState } from "react";
import { api } from "@/lib/bridge";
import { undoProposal } from "@/lib/store";
import type { Proposal } from "@/lib/types";

/** Buttons still waiting for a tap; they take Alt 1, Alt 2... first. */
export function pendingCount(items: Proposal[] | undefined): number {
  return (items ?? []).filter((p) => !p.ran).length;
}

/** Alt + a digit, from the island's own keys (it has focus in Ask). */
export function useAltDigits(count: number, start: number, run: (n: number) => void) {
  const runRef = useRef(run);
  runRef.current = run;
  useEffect(() => {
    if (count === 0) return;
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (!e.altKey || e.ctrlKey || e.metaKey) return;
      const n = Number(e.key) - start;
      if (Number.isInteger(n) && n >= 1 && n <= count) {
        e.preventDefault();
        runRef.current(n - 1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [count, start]);
}

export function UndoProposal({
  proposal,
  buttonRef,
}: {
  proposal: Proposal;
  buttonRef?: RefObject<HTMLButtonElement | null>;
}) {
  const [state, setState] = useState<string | null>(null);
  if (state) return <span className="shrink-0 text-[12px] text-[rgb(235_235_245/0.62)]">{state}</span>;
  return (
    <button
      ref={buttonRef}
      type="button"
      onClick={() =>
        void undoProposal(proposal.id)
          .then((m) => setState(m))
          .catch((e) => setState(String(e)))
      }
      className="ak-chip chip"
    >
      Undo
      {buttonRef && (
        <kbd>
          <i className="alt-pre">Alt </i>U
        </kbd>
      )}
    </button>
  );
}

/** What one action did, with Undo and Show when they apply. */
export function Ran({ p, undoRef }: { p: Proposal; undoRef?: RefObject<HTMLButtonElement | null> }) {
  if (!p.ran) return null;
  return (
    <span className="flex min-w-0 basis-full items-center gap-2 text-[12.5px]">
      <span className={`size-1.5 shrink-0 rounded-full ${p.ran.ok ? "bg-[#30d158]" : "bg-[#ff453a]"}`} />
      <span className="min-w-0 flex-1 truncate text-[rgb(235_235_245/0.75)]">{p.ran.message}</span>
      {p.ran.ok && p.ran.undoId != null && !p.ran.undone && <UndoProposal proposal={p} buttonRef={undoRef} />}
      {p.ran.ok && p.ran.path && (
        <button type="button" onClick={() => void api.revealPath(p.ran?.path ?? "")} className="ak-chip chip">
          Show
        </button>
      )}
    </span>
  );
}
