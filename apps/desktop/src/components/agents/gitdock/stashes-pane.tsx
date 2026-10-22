"use client";

// Stashes: Pop, Apply, and Drop (which asks once more before it deletes).

import { useState } from "react";
import { api } from "@/lib/bridge";
import type { StashRow } from "@/lib/types";
import { Ic } from "../../icon";

export function StashesPane({ path, stashes, reload }: { path: string; stashes: StashRow[]; reload: () => void }) {
  const [note, setNote] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<string | null>(null);
  const run = (work: Promise<string>) =>
    void work
      .then(setNote)
      .catch((e) => setNote(String(e)))
      .finally(reload);

  if (stashes.length === 0) {
    return (
      <div className="gbody single">
        <p className="gempty">No stashes.</p>
      </div>
    );
  }
  return (
    <div className="gbody single">
      <div className="stash-list">
        {stashes.map((s) => (
          <div key={s.name} className="stash-row">
            <Ic name="box" size={14} />
            <span className="min-w-0 flex-1">
              <span className="block truncate">{s.message}</span>
              <span className="mono cnt">
                {s.name}, {s.when}
              </span>
            </span>
            <button type="button" className="btn primary sm" onClick={() => run(api.gitStashApply(path, s.name, true))}>
              Pop
            </button>
            <button type="button" className="btn ghost sm" onClick={() => run(api.gitStashApply(path, s.name, false))}>
              Apply
            </button>
            {confirm === s.name ? (
              <button
                type="button"
                className="btn ghost danger sm"
                onClick={() => {
                  setConfirm(null);
                  run(api.gitStashDrop(path, s.name));
                }}
              >
                Drop for good
              </button>
            ) : (
              <button
                type="button"
                className="btn ghost sm icon"
                aria-label={`Drop ${s.name}`}
                onClick={() => setConfirm(s.name)}
              >
                <Ic name="trash" size={12} />
              </button>
            )}
          </div>
        ))}
        {note && (
          <p className="hint" role="status">
            {note}
          </p>
        )}
      </div>
    </div>
  );
}
