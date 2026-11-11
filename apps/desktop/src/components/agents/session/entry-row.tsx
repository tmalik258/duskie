"use client";

// One line of a session's timeline: your message, the agent's reply, a step
// with its output, or a review marker.

import { useState } from "react";
import { AnswerOptions } from "@/components/ask/proposals";
import type { Entry, Step } from "@/lib/agents";
import { Markdown } from "@/lib/markdown";
import { extractChoices } from "@/lib/options";
import { MessageText } from "../../attach/message-text";
import { Icon } from "../../icon";
import { STEP_TAG } from "./format";

export function EntryRow({
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
    if (!onRewind)
      return (
        <div className="ak-um ak-in">
          <MessageText text={e.text} />
        </div>
      );
    return (
      <div className="ak-um-wrap ak-in">
        <button type="button" onClick={onRewind} className="ak-rwb chip">
          ↺ Rewind to here
        </button>
        <div className="ak-um">
          <MessageText text={e.text} />
        </div>
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
