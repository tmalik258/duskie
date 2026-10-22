"use client";

// Says plainly that a session works on a copy of the repo, and brings its
// changes to the user's branch on request.

import { useState } from "react";
import { finishSession, type Session } from "@/lib/agents";

export function WorktreeNote({ session: s, working }: { session: Session; working: boolean }) {
  const [note, setNote] = useState<string | null>(null);
  if (!s.worktree) return null;
  if (s.finished) return note ? <p className="ak-note ag-sh-note">{note}</p> : null;
  const yours = s.base ? <b className="mono">{s.base}</b> : "your branch";
  return (
    <p className="ak-twt ag-sh-note">
      <span>
        Working on a copy (<span className="mono">{s.worktree}</span>) because another session uses this repo. Its
        changes reach {yours} when you bring them over.
      </span>
      <button
        type="button"
        className="ak-chip primary chip"
        disabled={working}
        title={working ? "Wait for it to finish" : undefined}
        onClick={() =>
          void finishSession(s.id)
            .then(setNote)
            .catch((e: unknown) => setNote(String(e)))
        }
      >
        Bring changes to {s.base ?? "my branch"}
      </button>
      {note && <span className="ak-err">{note}</span>}
    </p>
  );
}
