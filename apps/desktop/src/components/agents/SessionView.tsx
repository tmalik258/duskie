"use client";

// One session: its steps as they stream, the context ring, memory use,
// its questions, and rewinding to an earlier message.

import { type CSSProperties, Fragment, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { AnswerOptions } from "@/components/ask/Proposals";
import { activityLabel, useActivities } from "@/lib/activities";
import { answerText, type OpenChoice } from "@/lib/agent-questions";
import {
  answerQuestion,
  COMPACT_AT,
  closeReview,
  closeSession,
  dismissCompact,
  type Entry,
  flushAgentsView,
  handOffSession,
  interruptSession,
  messageIndex,
  openReview,
  pauseSession,
  renameSession,
  resumePaused,
  resumeSession,
  rewindSession,
  type Session,
  type Step,
  sendToSession,
  sessionView,
  startHere,
  tuneSession,
} from "@/lib/agents";
import { api } from "@/lib/bridge";
import { useCached } from "@/lib/cache";
import { useNow } from "@/lib/hooks";
import { Markdown } from "@/lib/markdown";
import { extractChoices } from "@/lib/options";
import { stacked } from "@/lib/seam";
import type { EditorList } from "@/lib/types";
import { Ic, Icon } from "../Icon";
import { Tip } from "../Tip";
import { Composer } from "./Composer";
import { ChatControls } from "./Controls";
import { DebugPanel } from "./DebugPanel";
import { AgentMark } from "./marks";
import { PlanPanel } from "./PlanPanel";
import { Review } from "./Review";

/** How much of the context window is used, as a small ring. */
export function ContextRing({ used, window, onCompact }: { used: number; window: number; onCompact?: () => void }) {
  const p = Math.round(Math.min(1, used / window) * 100);
  if (!onCompact) {
    return (
      <Tip label={`${p}% of the context used`}>
        <span className="ak-ring mono">
          <i style={{ "--p": p } as CSSProperties} aria-hidden="true" />
          {p}%
        </span>
      </Tip>
    );
  }
  // One click runs /compact: the conversation is summed up to free room.
  return (
    <Tip label={`${p}% of the context used. Click to compact it.`}>
      <button
        type="button"
        onClick={onCompact}
        aria-label={`${p}% of the context used. Compact`}
        className="ak-ring mono chip rounded-full px-1 hover:text-white"
      >
        <i style={{ "--p": p } as CSSProperties} aria-hidden="true" />
        {p}%
      </button>
    </Tip>
  );
}

/** How much memory the session's CLI uses, checked every 5 seconds. */
function SessionMemory({ id, live }: { id: string; live: boolean }) {
  const [bytes, setBytes] = useState<number | null>(null);
  useEffect(() => {
    if (!live) {
      setBytes(null);
      return;
    }
    let on = true;
    const check = () =>
      void api
        .agentMemory(id)
        .then((b) => on && setBytes(b))
        .catch(() => undefined);
    check();
    const t = setInterval(check, 5000);
    return () => {
      on = false;
      clearInterval(t);
    };
  }, [id, live]);
  if (bytes === null) return null;
  const mb = bytes / (1024 * 1024);
  return (
    <Tip label="Memory this session uses">
      <span className="ak-mi">{mb >= 1024 ? `${(mb / 1024).toFixed(1)} GB` : `${Math.round(mb)} MB`}</span>
    </Tip>
  );
}

/** "1:12", or "8 s" under a minute. */
function clock(ms: number): string {
  const s = Math.round(ms / 1000);
  return s < 60 ? `${s} s` : `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** follow:false + scroll:0 is a bad flush (open before layout); treat as stick-to-bottom. */
function stickBottom(st: { scroll: number; follow: boolean }): boolean {
  return st.follow !== false || st.scroll <= 0;
}

export function SessionView({
  session: s,
  sessions,
  maxHeight,
  active = true,
}: {
  session: Session;
  sessions: Session[];
  maxHeight: number;
  active?: boolean;
}) {
  const [text, setLocalText] = useState(s.view?.draft ?? "");
  const textRef = useRef(text);
  const savedScroll = s.view?.scroll ?? 0;
  const savedFollow = s.view?.follow ?? true;
  const scrollState = useRef({
    scroll: savedScroll,
    // Coerce corrupted prefs so reopen does not land at the top of a 200kpx timeline.
    follow: savedFollow === false && savedScroll <= 0 ? true : savedFollow,
  });
  // biome-ignore lint/correctness/useExhaustiveDependencies: restore draft/scroll only when the session switches
  useEffect(() => {
    const draft = s.view?.draft ?? "";
    textRef.current = draft;
    setLocalText(draft);
    const scroll = s.view?.scroll ?? 0;
    const follow = s.view?.follow ?? true;
    scrollState.current = { scroll, follow: follow === false && scroll <= 0 ? true : follow };
  }, [s.id]);
  const setText = (draft: string) => {
    textRef.current = draft;
    setLocalText(draft);
  };
  const flushView = () => {
    const st = scrollState.current;
    const follow = stickBottom(st);
    sessionView(s.id, { draft: textRef.current, scroll: follow ? st.scroll : st.scroll, follow });
    flushAgentsView();
  };
  const reviewing = s.view?.reviewing ?? false;
  const reviewStacked = reviewing && stacked(typeof window === "undefined" ? 1920 : window.screen.availWidth);
  const setReviewing = (next: boolean) => {
    sessionView(s.id, { draft: textRef.current, ...scrollState.current });
    if (next) openReview(s.id);
    else closeReview(s.id);
  };
  const [rewindAt, setRewindAt] = useState<number | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  /** Bumped after rewind so the composer focuses and selects the restored draft. */
  const [editFocus, setEditFocus] = useState(0);
  const { data: editors } = useCached<EditorList>("editors", api.editorsList);
  const editor = editors?.editors.find((e) => e.id === editors.current)?.name ?? null;
  const scroll = useRef<HTMLDivElement>(null);
  const activity = useActivities((state) => state.activities.find((a) => a.parentId === s.id && !a.dismissed));
  const working = s.status === "working" || s.status === "waiting";
  const now = useNow(active && working ? 250 : 60_000);
  const done = s.status === "idle" || s.status === "ended" || s.status === "failed";
  const current = useMemo(() => {
    const step = [...s.entries].reverse().find((e) => e.kind === "step" && e.step.state === "running");
    return step && step.kind === "step" ? step.step.label : null;
  }, [s.entries]);
  // Restore scroll before paint; ResizeObserver keeps follow pinned while Markdown grows.
  // Skip while warm/hidden, hidden nodes report scrollHeight 0 and would wipe the saved offset.
  // biome-ignore lint/correctness/useExhaustiveDependencies: follow new entry count, not every streamed token array identity
  useLayoutEffect(() => {
    if (!active) return;
    const el = scroll.current;
    if (!el) return;
    const apply = () => {
      el.scrollTop = stickBottom(scrollState.current) ? el.scrollHeight : scrollState.current.scroll;
    };
    apply();
    const ro = new ResizeObserver(() => {
      if (stickBottom(scrollState.current)) el.scrollTop = el.scrollHeight;
    });
    ro.observe(el);
    const id = requestAnimationFrame(apply);
    return () => {
      ro.disconnect();
      cancelAnimationFrame(id);
    };
  }, [s.id, reviewing, s.entries.length, s.plan.length, s.question, s.status, active]);
  // The cleanup intentionally captures the current session identity.
  // biome-ignore lint/correctness/useExhaustiveDependencies: saves on session switch/unmount
  useEffect(() => {
    if (!active) return;
    const onHide = () => flushView();
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", onHide);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", onHide);
      flushView();
    };
  }, [s.id, active]);

  // Alt 1 reviews, Alt 2 (or Alt T) carries on in a terminal.
  // biome-ignore lint/correctness/useExhaustiveDependencies: setReviewing is recreated each render; s.id covers the session
  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (!e.altKey || e.ctrlKey || e.metaKey) return;
      const k = e.key.toLowerCase();
      if (k === "t" || (k === "2" && done)) {
        e.preventDefault();
        void api.agentTerminal(s.id);
      } else if (k === "1" && done && s.reviewable && s.changes !== 0) {
        e.preventDefault();
        setReviewing(true);
      } else if (k === "3" && done && editor) {
        e.preventDefault();
        void api.agentOpenEditor(s.id);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [s.id, done, s.reviewable, s.changes, editor]);

  // Half the context used: offer /compact (Alt K), Claude Code only.
  const offerCompact =
    s.agent === "Claude Code" &&
    done &&
    !s.compactDismissed &&
    !!s.usage &&
    s.usage.used / s.usage.window >= COMPACT_AT;
  useEffect(() => {
    if (!offerCompact) return;
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (!e.altKey || e.ctrlKey || e.metaKey || e.key.toLowerCase() !== "k") return;
      e.preventDefault();
      sendToSession(s.id, "/compact");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [s.id, offerCompact]);

  // Alt A, Y, N answer a question while one waits.
  useEffect(() => {
    if (!s.question) return;
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || !e.altKey) return;
      const k = e.key.toLowerCase();
      const answer = k === "a" ? "allow" : k === "y" ? "always" : k === "n" ? "deny" : null;
      if (!answer) return;
      e.preventDefault();
      answerQuestion(s.id, answer);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [s.id, s.question]);

  const send = () => {
    const t = text.trim();
    if (!t) return;
    sendToSession(s.id, t);
    textRef.current = "";
    setLocalText("");
    sessionView(s.id, { draft: "", ...scrollState.current });
  };
  const usedPct = s.usage ? Math.round(Math.min(1, s.usage.used / s.usage.window) * 100) : null;
  // Long sessions: paint the recent tail first (open lag was parsing every Markdown block).
  const TAIL = 28;
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
  const onPlanDraft = (t: string) => {
    setText(t);
    setEditFocus((n) => n + 1);
  };

  return (
    <>
      <div className="ag-sh">
        <AgentMark agent={s.agent} />
        <div className="min-w-0 flex-1">
          <NameField id={s.id} title={s.title} />
          <p className="ag-sh-sub">
            {s.agent}
            <span className="sep" />
            {s.project}
            {s.branch && (
              <>
                <span className="sep" />
                <span className="mono truncate">{s.branch}</span>
              </>
            )}
          </p>
        </div>
        {s.usage && s.usage.window > 0 && <ContextRing used={s.usage.used} window={s.usage.window} />}
        <span className="ag-acts">
          <SessionMemory id={s.id} live={active && s.status !== "ended" && s.status !== "failed" && !s.restored} />
          {s.changes > 0 && (
            <Tip label="Review changes (Alt 1)">
              <button
                type="button"
                aria-label="Review changes"
                onClick={() => setReviewing(true)}
                className="ak-ibtn chip"
              >
                <Ic name="diff" size={14} />
              </button>
            </Tip>
          )}
          <Tip label="Continue in a terminal (Alt 2)">
            <button
              type="button"
              aria-label="Continue in a terminal"
              onClick={() => void api.agentTerminal(s.id)}
              className="ak-ibtn chip"
            >
              <Ic name="term" size={14} />
            </button>
          </Tip>
          {working && (
            <Tip label={s.paused ? "Resume" : "Pause"}>
              <button
                type="button"
                aria-label={s.paused ? "Resume" : "Pause"}
                onClick={() => (s.paused ? resumePaused(s.id) : pauseSession(s.id))}
                className="ak-ibtn chip"
              >
                <Ic name={s.paused ? "play" : "pause"} size={13} />
              </button>
            </Tip>
          )}
          {working ? (
            <Tip label="Stop (Esc)">
              <button
                type="button"
                aria-label="Stop"
                onClick={() => interruptSession(s.id)}
                className="ak-ibtn chip danger"
              >
                <Ic name="stop" size={13} />
              </button>
            </Tip>
          ) : (
            <Tip label="Close session">
              <button
                type="button"
                aria-label="Close session"
                onClick={() => closeSession(s.id)}
                className="ak-ibtn chip"
              >
                <Ic name="x" size={13} />
              </button>
            </Tip>
          )}
        </span>
      </div>
      {working && s.activeMode !== s.mode && <p className="ak-note ag-sh-note">New mode applies to the next message</p>}

      {reviewStacked ? (
        <Review session={s} maxHeight={maxHeight} onDone={() => setReviewing(false)} />
      ) : (
        <>
          <div
            ref={scroll}
            onScroll={(e) => {
              const el = e.currentTarget;
              scrollState.current = {
                scroll: el.scrollTop,
                follow: el.scrollHeight - el.scrollTop - el.clientHeight < 48,
              };
            }}
            className="ak-tl ak-scroll"
            style={{ maxHeight: maxHeight - 40 }}
          >
            {entryStart > 0 && (
              <button type="button" className="ak-chip chip self-start" onClick={() => setShowEarlier(true)}>
                Show earlier ({entryStart} more)
              </button>
            )}
            {planAboveFold && <PlanPanel session={s} onDraft={onPlanDraft} />}
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
                      onReview={() => setReviewing(true)}
                      onRewind={e.kind === "you" && done && s.reviewable ? () => setRewindAt(i) : undefined}
                    />
                  )}
                  {rewindAt === i && (
                    <RewindConfirm
                      session={s}
                      entry={i}
                      onDone={(msg, draft) => {
                        setRewindAt(null);
                        setNotice(msg);
                        if (draft) {
                          setText(draft);
                          setEditFocus((n) => n + 1);
                        }
                      }}
                    />
                  )}
                  {showPlanHere && <PlanPanel session={s} onDraft={onPlanDraft} />}
                </Fragment>
              );
            })}
            {/* Plan with no agent text yet still needs a home while planning. */}
            {planEntry == null && lastAgentText < 0 && s.mode === "plan" && (
              <PlanPanel session={s} onDraft={onPlanDraft} />
            )}

            {working && !s.question && (
              <p className="ak-status" role="status" aria-live="polite">
                <span className="shimmer-text text-[rgb(235_235_245/0.6)]">
                  {activity
                    ? activityLabel(activity, now, { elapsed: false })
                    : current
                      ? `${current}...`
                      : "Waiting for the next agent step"}
                </span>
                <span className="ak-timer mono">{clock(now - s.turnAt)}</span>
              </p>
            )}

            {s.question && (
              <div className="ak-ask ak-in" role="alertdialog" aria-label={`${s.agent} asks`}>
                <p>
                  {s.agent} wants to: <span className="font-medium text-white">{s.question.label}</span>
                </p>
                {s.question.detail && (
                  <code className="mono ak-scroll">{s.question.detail.replace(/\\\\/g, "\\")}</code>
                )}
                <div className="ak-chips">
                  <button type="button" onClick={() => answerQuestion(s.id, "allow")} className="ak-chip primary chip">
                    Allow{" "}
                    <kbd>
                      <i className="alt-pre">Alt </i>A
                    </kbd>
                  </button>
                  <button type="button" onClick={() => answerQuestion(s.id, "always")} className="ak-chip chip">
                    Allow this session{" "}
                    <kbd>
                      <i className="alt-pre">Alt </i>Y
                    </kbd>
                  </button>
                  <button type="button" onClick={() => answerQuestion(s.id, "deny")} className="ak-chip chip">
                    Deny{" "}
                    <kbd>
                      <i className="alt-pre">Alt </i>N
                    </kbd>
                  </button>
                </div>
              </div>
            )}

            {s.choose && <ChoiceCard open={s.choose} agent={s.agent} onAnswer={(text) => sendToSession(s.id, text)} />}

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
                  <button type="button" onClick={() => setReviewing(true)} className="ak-chip primary chip">
                    Review {s.changes} {s.changes === 1 ? "change" : "changes"}
                    <kbd>
                      <i className="alt-pre">Alt </i>1
                    </kbd>
                  </button>
                )}
                <button type="button" onClick={() => void api.agentTerminal(s.id)} className="ak-chip chip">
                  Open in terminal{" "}
                  <kbd>
                    <i className="alt-pre">Alt </i>2
                  </kbd>
                </button>
                {editor && (
                  <button type="button" onClick={() => void api.agentOpenEditor(s.id)} className="ak-chip chip">
                    Open in {editor}{" "}
                    <kbd>
                      <i className="alt-pre">Alt </i>3
                    </kbd>
                  </button>
                )}
              </div>
            )}
            {offerCompact && s.usage && (
              <div className="ak-ask ak-in" role="status">
                <p>
                  Context is {Math.round((s.usage.used / s.usage.window) * 100)}% full. Compacting now keeps {s.agent}{" "}
                  quick and on track.
                </p>
                <div className="ak-chips">
                  <button
                    type="button"
                    onClick={() => sendToSession(s.id, "/compact")}
                    className="ak-chip primary chip"
                  >
                    Compact{" "}
                    <kbd>
                      <i className="alt-pre">Alt </i>K
                    </kbd>
                  </button>
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
          </div>

          {s.restored || s.status === "ended" || (s.status === "failed" && !working) ? (
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
                  onClick={() => void resumeSession(s.id).catch((e: unknown) => setNotice(String(e)))}
                  className="ak-chip primary chip"
                >
                  Resume
                </button>
                <span className="ak-note">
                  {s.restored ? "Duskie restarted since this ran." : "This session ended."} Resume carries on where it
                  stopped.
                </span>
              </div>
            </div>
          ) : (
            <Composer
              session={s}
              working={working}
              text={text}
              setText={setText}
              editFocus={editFocus}
              onSend={send}
              onBlur={flushView}
              onReview={() => setReviewing(true)}
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

/** The short tag in front of each step, as in a terminal log. */
export const STEP_TAG: Record<string, string> = {
  Read: "Read",
  Edit: "Edit",
  MultiEdit: "Edit",
  Write: "Write",
  NotebookEdit: "Edit",
  Bash: "Run",
  Grep: "Find",
  Glob: "Find",
  WebSearch: "Web",
  WebFetch: "Web",
  Task: "Agent",
  TodoWrite: "Plan",
  command: "Run",
  fileChange: "Edit",
  webSearch: "Web",
};

function EntryRow({
  entry: e,
  onRewind,
  onReview,
  choices,
  onPick,
}: {
  entry: Entry;
  onRewind?: () => void;
  onReview?: () => void;
  /** Last agent reply while idle: show selectable clarifying choices. */
  choices?: boolean;
  onPick?: (text: string) => void;
}) {
  if (e.kind === "review") {
    return (
      <div className="ak-chips">
        <span className="ak-note">{e.error ?? `${e.files} files changed`}</span>
        <button type="button" className="ak-chip chip" onClick={() => onReview?.()}>
          Review
        </button>
      </div>
    );
  }
  if (e.kind === "you") {
    if (!onRewind) return <div className="ak-um ak-in">{e.text}</div>;
    return (
      <div className="ak-um-wrap ak-in">
        <button type="button" onClick={onRewind} className="ak-rwb chip">
          ↺ Rewind to here
        </button>
        <div className="ak-um">{e.text}</div>
      </div>
    );
  }
  if (e.kind === "text") {
    // Always hide OPTION/STAT lines from prose; the selectable UI owns them.
    const parsed = extractChoices(e.text, !choices);
    return (
      <div className="grid gap-2">
        {parsed.body.trim() ? (
          <div className="ak-ans ak-in px-0">
            <Markdown text={parsed.body} />
          </div>
        ) : null}
        {choices && parsed.options.length > 0 && onPick && (
          <AnswerOptions options={parsed.options} multi={parsed.multi} onPick={onPick} />
        )}
      </div>
    );
  }
  const st = e.step;
  return (
    <>
      <div className="ak-tg ak-in" data-s={st.state}>
        <span className="ak-k mono">{STEP_TAG[st.tool] ?? st.tool.slice(0, 5)}</span>
        <span
          className={`shrink-0 ${st.state === "running" ? "text-white" : st.state === "cancelled" ? "text-[var(--i3)]" : ""}`}
        >
          {st.label}
        </span>
        {st.detail && <span className="d mono">{st.detail}</span>}
      </div>
      {st.output && STEP_TAG[st.tool] === "Run" && <Output step={st} />}
    </>
  );
}

/** A command's output: one quiet line with its last line as a preview, opened in place. */
function Output({ step }: { step: Step }) {
  const [open, setOpen] = useState(false);
  const text = (step.output ?? "").replace(/\s+$/, "");
  const lines = text.split("\n");
  const count = lines.length;
  const last = [...lines].reverse().find((l) => l.trim()) ?? "";
  return (
    <div className="ak-term ak-in" data-open={open}>
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="ak-term-h">
        <Icon name="chevron" size={11} className={`ak-term-c ${open ? "" : "-rotate-90"}`} />
        <span className="ak-term-n">
          Output · {count} {count === 1 ? "line" : "lines"}
        </span>
        {!open && last && <span className="ak-term-last mono">{last.trim()}</span>}
      </button>
      {open && <pre className="mono ak-scroll">{text}</pre>}
    </div>
  );
}

/** "Rewind to before this message?" with how many files go back. */
function RewindConfirm({
  session: s,
  entry,
  onDone,
}: {
  session: Session;
  entry: number;
  /** `draft` is the removed user message, put back in the composer to edit. */
  onDone: (message: string | null, draft?: string) => void;
}) {
  const [files, setFiles] = useState<number | null>(null);
  useEffect(() => {
    void api
      .agentRewindPreview(s.id, messageIndex(s, entry))
      .then(setFiles)
      .catch(() => setFiles(0));
  }, [s, entry]);
  const said = s.entries[entry]?.kind === "you" ? (s.entries[entry] as { text: string }).text : "";
  const go = () =>
    void rewindSession(s.id, entry)
      .then((n) => {
        const filesNote = n === 0 ? "No files to put back" : `${n} ${n === 1 ? "file" : "files"} put back`;
        onDone(`↺ Rewound · ${filesNote} · edit and send`, said);
      })
      .catch((e: unknown) => onDone(String(e)));
  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        go();
      } else if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        onDone(null);
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  });
  return (
    <div
      className="ak-ask ak-in"
      style={{
        background: "rgb(255 255 255 / 0.05)",
        color: "var(--ink)",
        boxShadow: "inset 0 0 0 0.5px rgb(255 255 255 / 0.12)",
      }}
    >
      <p>
        Rewind to before “{said.length > 60 ? `${said.slice(0, 57)}...` : said}”?{" "}
        {files === null
          ? ""
          : files === 0
            ? "No files changed since then."
            : `This puts back ${files} ${files === 1 ? "file" : "files"} the agent changed since.`}{" "}
        Your message opens in the box to edit.
      </p>
      <div className="ak-chips">
        <button type="button" onClick={go} className="ak-chip primary chip">
          Rewind <kbd>Enter</kbd>
        </button>
        <button type="button" onClick={() => onDone(null)} className="ak-chip chip">
          Cancel <kbd>Esc</kbd>
        </button>
      </div>
    </div>
  );
}

/** The session's name: click to rename, Enter keeps it, Esc puts it back. */
export function NameField({ id, title }: { id: string; title: string }) {
  const [v, setV] = useState(title);
  useEffect(() => setV(title), [title]);
  return (
    <input
      aria-label="Session name"
      className="ak-title ak-name"
      value={v}
      onChange={(e) => setV(e.target.value)}
      onBlur={() => (v.trim() ? renameSession(id, v) : setV(title))}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
        else if (e.key === "Escape") {
          e.stopPropagation();
          setV(title);
          requestAnimationFrame(() => (document.activeElement as HTMLElement | null)?.blur());
        }
      }}
    />
  );
}

/** "You have used 85% of Claude Code's 5-hour limit. It resets at 3:40 PM." */
export function limitNote(agent: string, l: NonNullable<Session["limit"]>): string {
  const span =
    l.window === "five_hour" ? "5-hour limit" : l.window.startsWith("seven_day") ? "weekly limit" : "usage limit";
  const resets = l.resetsAt
    ? ` It resets at ${new Date(l.resetsAt * 1000).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}.`
    : "";
  if (l.status === "rejected")
    return `${agent} has used up its ${span}.${resets} Ask mode uses another model meanwhile.`;
  const pct = l.used !== null ? `${Math.round(l.used <= 1 ? l.used * 100 : l.used)}% of ` : "most of ";
  return `You have used ${pct}${agent}'s ${span}.${resets}`;
}

/** The agent's own multiple-choice question: tap an option to answer. With
 * several questions, each is answered in turn; "Several" questions allow
 * more than one pick. */
function ChoiceCard({ open, agent, onAnswer }: { open: OpenChoice; agent: string; onAnswer: (text: string) => void }) {
  const [picks, setPicks] = useState<string[][]>([]);
  const at = picks.length;
  const [multi, setMulti] = useState<string[]>([]);
  const q = open.questions[at];
  if (!q) return null;
  const next = (chosen: string[]) => {
    const all = [...picks, chosen];
    setMulti([]);
    if (all.length >= open.questions.length) onAnswer(answerText(open, all));
    else setPicks(all);
  };
  return (
    <section className="ak-ask ak-in" aria-label={`${agent} asks`}>
      <p>
        {agent} asks: <span className="font-medium text-white">{q.question}</span>
      </p>
      <div className="ak-chips">
        {q.options.map((o) => {
          const on = multi.includes(o.label);
          return (
            <button
              key={o.label}
              type="button"
              title={o.description}
              aria-pressed={q.multiSelect ? on : undefined}
              onClick={() =>
                q.multiSelect
                  ? setMulti(on ? multi.filter((m) => m !== o.label) : [...multi, o.label])
                  : next([o.label])
              }
              className={`ak-chip chip ${on ? "primary" : ""}`}
            >
              {o.label}
            </button>
          );
        })}
        {q.multiSelect && (
          <button type="button" onClick={() => next(multi)} className="ak-chip primary chip">
            Done
          </button>
        )}
      </div>
    </section>
  );
}
