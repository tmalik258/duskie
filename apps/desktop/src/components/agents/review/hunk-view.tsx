"use client";

import type { FileChange } from "@/lib/types";
import { Ic } from "../../icon";
import { pairs, rows } from "./hunk";

type Hunk = FileChange["hunks"][number];

/** One change: its header with keep / drop, the lines, and the comment box. */
export function HunkView({
  file,
  h,
  hi,
  ok,
  current,
  mode,
  comment,
  onPick,
  onUndo,
  onDrop,
  onKeep,
  setComment,
  sendComment,
}: {
  file: FileChange;
  h: Hunk;
  hi: number;
  ok: boolean;
  current: boolean;
  mode: "unified" | "split";
  comment: string | null;
  onPick: () => void;
  onUndo: () => void;
  onDrop: () => void;
  onKeep: () => void;
  setComment: (c: string | null) => void;
  sendComment: (c: string) => void;
}) {
  const rs = rows(h);
  return (
    <div className={`rv-hunk${ok ? " ok" : ""}`} data-hunk-i={hi}>
      {/* biome-ignore lint/a11y/useKeyWithClickEvents: J and K move between changes */}
      {/* biome-ignore lint/a11y/noStaticElementInteractions: a click picks the change */}
      <div className={`rv-hunk-h${current ? " cur" : ""}`} onClick={onPick}>
        <span className="n">
          Change {hi + 1} of {file.hunks.length}
        </span>
        <span className="mono hd">{h.header.match(/@@[^@]*@@/)?.[0] ?? h.header}</span>
        <span className="acts">
          {ok ? (
            <>
              <span className="rv-ok">
                <Ic name="check" size={12} /> Kept
              </span>
              <button type="button" className="rv-btn ghost" onClick={onUndo}>
                Undo
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                className="rv-ico danger"
                aria-label="Drop this change, N"
                title="Drop (N)"
                onClick={onDrop}
              >
                <Ic name="x" size={12} />
              </button>
              <button
                type="button"
                className="rv-yes"
                aria-label="Keep this change, Y"
                title="Keep (Y)"
                onClick={onKeep}
              >
                <Ic name="check" size={12} />
                <kbd>Y</kbd>
              </button>
            </>
          )}
        </span>
      </div>
      <div className={`rv-body mono${mode === "split" ? " split" : ""}`}>
        {mode === "unified"
          ? rs.slice(0, 400).map((r, ri) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: lines of one hunk
              <div key={ri} className={`dl ${r.kind}`}>
                <span className="ln">{r.o ?? ""}</span>
                <span className="ln">{r.n ?? ""}</span>
                <span className="sg">{r.kind === "add" ? "+" : r.kind === "del" ? "-" : ""}</span>
                <span className="c">{r.text || " "}</span>
              </div>
            ))
          : pairs(rs)
              .slice(0, 400)
              .map(([a, b], ri) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: lines of one hunk
                <div key={ri} className="dl2">
                  <span className="ln">{a?.o ?? ""}</span>
                  <span className={`c ${a?.kind === "del" ? "del" : a ? "" : "nil"}`}>{a?.text || " "}</span>
                  <span className="ln">{b?.n ?? ""}</span>
                  <span className={`c ${b?.kind === "add" ? "add" : b ? "" : "nil"}`}>{b?.text || " "}</span>
                </div>
              ))}
      </div>
      {comment !== null && current && (
        <form
          className="rv-comment"
          onSubmit={(e) => {
            e.preventDefault();
            sendComment(comment);
          }}
        >
          <input
            // biome-ignore lint/a11y/noAutofocus: opened by the C key for typing right away
            autoFocus
            value={comment}
            placeholder="Tell the agent what to change here"
            onChange={(e) => setComment(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                e.stopPropagation();
                setComment(null);
              }
            }}
          />
          <button type="submit" className="rv-btn">
            Send
          </button>
        </form>
      )}
    </div>
  );
}
