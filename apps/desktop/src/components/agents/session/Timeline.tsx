"use client";

// A session's entries in order, the newest 28 first on long sessions, with
// the plan and debug panels where they belong and Rewind on your messages.

import { Fragment, useEffect, useState } from "react";
import { type Session, sendToSession } from "@/lib/agents";
import { DebugPanel } from "../DebugPanel";
import { PlanPanel } from "../PlanPanel";
import { EntryRow } from "./EntryRow";
import { RewindConfirm } from "./RewindConfirm";

/** Long sessions paint the recent tail first (open lag was parsing every Markdown block). */
const TAIL = 28;

export function Timeline({
  session: s,
  done,
  rewindAt,
  onRewindAt,
  onRewound,
  onDraft,
  onReview,
}: {
  session: Session;
  done: boolean;
  rewindAt: number | null;
  onRewindAt: (at: number | null) => void;
  /** After a rewind or a failed one: the note to show, and the message to edit again. */
  onRewound: (message: string | null, draft?: string) => void;
  onDraft: (text: string) => void;
  onReview: () => void;
}) {
  const [showEarlier, setShowEarlier] = useState(false);
  // biome-ignore lint/correctness/useExhaustiveDependencies: reset the tail fold when the session switches
  useEffect(() => setShowEarlier(false), [s.id]);
  const entryStart = showEarlier || s.entries.length <= TAIL ? 0 : s.entries.length - TAIL;
  const visibleEntries = s.entries.slice(entryStart);
  let lastAgentText = -1;
  for (let k = s.entries.length - 1; k >= 0; k--) {
    if (s.entries[k].kind === "text") {
      lastAgentText = k;
      break;
    }
  }
  const planEntry = s.planEntry ?? null;
  const planAboveFold = planEntry != null && planEntry < entryStart;

  return (
    <>
      {entryStart > 0 && (
        <button type="button" className="ak-chip chip self-start" onClick={() => setShowEarlier(true)}>
          Show earlier ({entryStart} more)
        </button>
      )}
      {planAboveFold && <PlanPanel session={s} onDraft={onDraft} />}
      {(s.activeMode ?? s.mode) === "debug" && <DebugPanel session={s} />}
      {visibleEntries.map((e, j) => {
        const i = entryStart + j;
        // Last agent prose (idle or still "working" after a clarifying ask).
        const lastText = e.kind === "text" && !s.question && i === lastAgentText;
        // Full plan lives in PlanPanel under planEntry - hide that turn's prose.
        const planCovers = planEntry === i && !!s.planDoc?.markdown && e.kind === "text";
        const showPlanHere = planEntry === i || (planEntry == null && i === lastAgentText && s.mode === "plan");
        return (
          <Fragment key={i}>
            {!planCovers && (
              <EntryRow
                entry={e}
                choices={lastText}
                onPick={(t) => sendToSession(s.id, t)}
                onReview={onReview}
                onRewind={e.kind === "you" && done && s.reviewable ? () => onRewindAt(i) : undefined}
              />
            )}
            {rewindAt === i && <RewindConfirm session={s} entry={i} onDone={onRewound} />}
            {showPlanHere && <PlanPanel session={s} onDraft={onDraft} />}
          </Fragment>
        );
      })}
      {/* Plan with no agent text yet still needs a home while planning. */}
      {planEntry == null && lastAgentText < 0 && s.mode === "plan" && <PlanPanel session={s} onDraft={onDraft} />}
    </>
  );
}
