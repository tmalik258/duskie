"use client";

// When a turn ends: how it went, what to do next (review, terminal, editor),
// the /compact offer, and notes about limits, loops and compaction.

import type { ReactNode } from "react";
import { dismissCompact, handOffSession, type Session, sendToSession } from "@/lib/agents";
import { api } from "@/lib/bridge";
import { clock, limitNote } from "./format";

export function TurnEnd({
  session: s,
  done,
  editor,
  offerCompact,
  notice,
  onReview,
}: {
  session: Session;
  done: boolean;
  editor: string | null;
  offerCompact: boolean;
  notice: string | null;
  onReview: () => void;
}) {
  const usedPct = s.usage ? Math.round(Math.min(1, s.usage.used / s.usage.window) * 100) : null;
  return (
    <>
      {s.error && <p className="ak-err">{s.error}</p>}
      {done && !s.error && (
        <p className="ak-done ak-in">
          <span className="ok">✓</span>
          {[
            s.tookMs !== null ? `Done in ${clock(s.tookMs)}` : "Done",
            s.changes > 0 ? `${s.changes} ${s.changes === 1 ? "file" : "files"} changed` : null,
            usedPct !== null ? `${usedPct}% of context used` : null,
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>
      )}
      {done && (
        <div className="ak-chips">
          {s.reviewable && s.changes > 0 && (
            <AltChip primary keyName="1" onClick={onReview}>
              Review {s.changes} {s.changes === 1 ? "change" : "changes"}
            </AltChip>
          )}
          <AltChip keyName="2" onClick={() => void api.agentTerminal(s.id)}>
            Open in terminal{" "}
          </AltChip>
          {editor && (
            <AltChip keyName="3" onClick={() => void api.agentOpenEditor(s.id)}>
              Open in {editor}{" "}
            </AltChip>
          )}
        </div>
      )}
      {offerCompact && s.usage && (
        <div className="ak-ask ak-in" role="status">
          <p>
            Context is {Math.round((s.usage.used / s.usage.window) * 100)}% full. Compacting now keeps {s.agent} quick
            and on track.
          </p>
          <div className="ak-chips">
            <AltChip primary keyName="K" onClick={() => sendToSession(s.id, "/compact")}>
              Compact{" "}
            </AltChip>
            <button type="button" onClick={() => dismissCompact(s.id)} className="ak-chip chip">
              Not now
            </button>
          </div>
        </div>
      )}
      {s.limit && <p className="ak-note ak-in">{limitNote(s.agent, s.limit)}</p>}
      {s.stuck && (
        <p className="ak-note ak-in flex items-center gap-2">
          <span className="min-w-0 flex-1">{s.agent} is going round in circles on this one.</span>
          <button type="button" onClick={() => void handOffSession(s)} className="ak-chip chip">
            Hand off
          </button>
        </p>
      )}
      {notice && <p className="ak-note ak-in">{notice}</p>}
      {s.compaction && (
        <p role="status" className="ak-note">
          {s.compaction === "running"
            ? "Compacting context…"
            : s.compaction === "done"
              ? "Context compacted"
              : "Compaction failed; see the session error."}
        </p>
      )}
    </>
  );
}

/** A chip with its Alt shortcut shown after the label. */
function AltChip({
  keyName,
  primary,
  onClick,
  children,
}: {
  keyName: string;
  primary?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button type="button" onClick={onClick} className={primary ? "ak-chip primary chip" : "ak-chip chip"}>
      {children}
      <kbd>
        <i className="alt-pre">Alt </i>
        {keyName}
      </kbd>
    </button>
  );
}
