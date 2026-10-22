"use client";

// One session: its header, the timeline as it streams, what the agent asks,
// how the turn ended, and the composer (or Resume once it has stopped).

import { useState } from "react";
import { COMPACT_AT, resumeSession, type Session, sendToSession, startHere, tuneSession } from "@/lib/agents";
import { api } from "@/lib/bridge";
import { useCached } from "@/lib/cache";
import type { EditorList } from "@/lib/types";
import { Composer } from "./composer";
import { ChatControls } from "./controls";
import { Review } from "./review";
import { ChoiceCard } from "./session/choice-card";
import { SessionHeader } from "./session/session-header";
import { Timeline } from "./session/timeline";
import { TurnEnd } from "./session/turn-end";
import { QuestionCard, WorkingStatus } from "./session/turn-status";
import { useSessionKeys } from "./session/use-session-keys";
import { useSessionView } from "./session/use-session-view";

export function SessionView({
  session: s,
  maxHeight,
  active = true,
}: {
  session: Session;
  maxHeight: number;
  active?: boolean;
}) {
  const view = useSessionView(s, active);
  const [rewindAt, setRewindAt] = useState<number | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  /** Bumped after rewind so the composer focuses and selects the restored draft. */
  const [editFocus, setEditFocus] = useState(0);
  const { data: editors } = useCached<EditorList>("editors", api.editorsList);
  const editor = editors?.editors.find((e) => e.id === editors.current)?.name ?? null;
  const working = s.status === "working" || s.status === "waiting";
  const done = s.status === "idle" || s.status === "ended" || s.status === "failed";
  const review = () => view.setReviewing(true);
  // Half the context used: offer /compact (Alt K), Claude Code only.
  const offerCompact =
    s.agent === "Claude Code" &&
    done &&
    !s.compactDismissed &&
    !!s.usage &&
    s.usage.used / s.usage.window >= COMPACT_AT;
  useSessionKeys(s, { done, editor, offerCompact, onReview: review });
  const draft = (t: string) => {
    view.setText(t);
    setEditFocus((n) => n + 1);
  };
  const stopped = s.restored || s.status === "ended" || (s.status === "failed" && !working);

  return (
    <>
      <SessionHeader session={s} active={active} working={working} onReview={review} />
      {view.reviewStacked ? (
        <Review session={s} maxHeight={maxHeight} onDone={() => view.setReviewing(false)} />
      ) : (
        <>
          <div
            ref={view.scroll}
            onScroll={view.onScroll}
            className="ak-tl ak-scroll"
            style={{ maxHeight: maxHeight - 40 }}
          >
            <Timeline
              session={s}
              done={done}
              rewindAt={rewindAt}
              onRewindAt={setRewindAt}
              onRewound={(msg, text) => {
                setRewindAt(null);
                setNotice(msg);
                if (text) draft(text);
              }}
              onDraft={draft}
              onReview={review}
            />
            {working && !s.question && <WorkingStatus session={s} active={active} />}
            <QuestionCard session={s} />
            {s.choose && <ChoiceCard open={s.choose} agent={s.agent} onAnswer={(text) => sendToSession(s.id, text)} />}
            <TurnEnd
              session={s}
              done={done}
              editor={editor}
              offerCompact={offerCompact}
              notice={notice}
              onReview={review}
            />
          </div>

          {stopped ? (
            <ResumeBar session={s} onError={setNotice} />
          ) : (
            <Composer
              session={s}
              working={working}
              text={view.text}
              setText={view.setText}
              editFocus={editFocus}
              onSend={view.send}
              onBlur={view.flushView}
              onReview={review}
              onClear={() => {
                void api
                  .agentProject(s.id)
                  .then((path) => startHere(path))
                  .catch((e) => setNotice(String(e)));
              }}
              onRewind={() => {
                const last = s.entries
                  .map((e, i) => (e.kind === "you" ? i : -1))
                  .filter((i) => i > 0)
                  .at(-1);
                if (last !== undefined) setRewindAt(last);
                else setNotice("There is no earlier message to go back to.");
              }}
            />
          )}
        </>
      )}
    </>
  );
}

/** Once a session has stopped: its model controls and Resume. */
function ResumeBar({ session: s, onError }: { session: Session; onError: (message: string) => void }) {
  return (
    <div>
      <ChatControls
        agent={s.agent}
        model={s.model}
        effort={s.effort}
        usage={s.usage}
        limit={s.limit}
        onModel={(m) => tuneSession(s.id, m, s.effort ?? null)}
        onEffort={(e) => tuneSession(s.id, s.model ?? null, e)}
      />
      <div className="ak-chips">
        <button
          type="button"
          onClick={() => void resumeSession(s.id).catch((e: unknown) => onError(String(e)))}
          className="ak-chip primary chip"
        >
          Resume
        </button>
        <span className="ak-note">
          {s.restored ? "Duskie restarted since this ran." : "This session ended."} Resume carries on where it stopped.
        </span>
      </div>
    </div>
  );
}
