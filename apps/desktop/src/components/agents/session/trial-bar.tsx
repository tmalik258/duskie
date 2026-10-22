"use client";

// Try mode: the session works on a copy. Keep brings the changes into the
// project folder; Throw away deletes the copy. Either way the session ends.

import { useState } from "react";
import { closeSession, type Session } from "@/lib/agents";
import { api } from "@/lib/bridge";

export function TrialBar({ session: s, working }: { session: Session; working: boolean }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!s.trial) return null;
  const run = async (keep: boolean) => {
    setBusy(true);
    setError(null);
    try {
      await (keep ? api.agentKeep(s.id) : api.agentDiscard(s.id));
      closeSession(s.id);
    } catch (e) {
      setError(String(e));
      setBusy(false);
    }
  };
  return (
    <div className="ag-trial" role="status">
      <span>Trying on a copy. Your code is untouched.</span>
      {!working && s.changes > 0 && (
        <span className="ag-trial-acts">
          <button type="button" className="ag-trial-btn" disabled={busy} onClick={() => void run(false)}>
            Throw away
          </button>
          <button type="button" className="ag-trial-btn keep" disabled={busy} onClick={() => void run(true)}>
            Keep
          </button>
        </span>
      )}
      {!working && s.changes === 0 && (
        <button type="button" className="ag-trial-btn" disabled={busy} onClick={() => void run(false)}>
          Close copy
        </button>
      )}
      {error && <p className="ag-trial-err">{error}</p>}
    </div>
  );
}
