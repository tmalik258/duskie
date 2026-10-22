"use client";
import { useEffect, useRef, useState } from "react";
import { joinMultiPicks } from "@/lib/options";
import { sendChat } from "@/lib/store";
import { useAltDigits } from "./proposals/pending-count";

/** Clarifying choices: pick one, pick several + Confirm, or type your own. */
export function AnswerOptions({
  options: all,
  start = 0,
  multi = false,
  onPick,
}: {
  options: string[];
  start?: number;
  /** Checkbox list; Confirm sends the joined picks. */
  multi?: boolean;
  onPick?: (text: string) => void;
}) {
  const pick = onPick ?? sendChat;
  // Proposals above take the first Alt digits; leave room for Something else.
  const options = all.slice(0, Math.max(0, Math.min(6, 8 - start)));
  const [custom, setCustom] = useState(false);
  const [draft, setDraft] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const total = options.length + 1;
  const shown = Math.max(0, Math.min(total, 9 - start));
  const toggle = (o: string) => {
    setSelected((prev) => (prev.includes(o) ? prev.filter((x) => x !== o) : [...prev, o]));
  };
  const canConfirm = selected.length > 0 || draft.trim().length > 0;
  const confirmMulti = () => {
    const parts = [...selected];
    const extra = draft.trim();
    if (extra) parts.push(extra);
    const text = joinMultiPicks(parts);
    if (text) pick(text);
  };
  const confirmRef = useRef(confirmMulti);
  confirmRef.current = confirmMulti;
  useAltDigits(shown, start, (n) => {
    const opt = options[n];
    if (opt) {
      if (multi) toggle(opt);
      else pick(opt);
      return;
    }
    setCustom(true);
    requestAnimationFrame(() => inputRef.current?.focus());
  });
  useEffect(() => {
    if (custom) inputRef.current?.focus();
  }, [custom]);
  useEffect(() => {
    if (!multi) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Enter" || !e.altKey || e.ctrlKey || e.metaKey) return;
      if (!canConfirm) return;
      e.preventDefault();
      confirmRef.current();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [multi, canConfirm]);
  const sendCustom = () => {
    if (multi) {
      confirmMulti();
      return;
    }
    const q = draft.trim();
    if (q) pick(q);
  };
  return (
    <fieldset className={`ak-askq ak-in${multi ? " multi" : ""}`}>
      <legend className="sr-only">{multi ? "Choose any that apply" : "Choose an option"}</legend>
      {multi && <p className="ak-askq-hint">Select all that apply</p>}
      <div className="ak-askq-list">
        {options.map((o, i) => {
          const on = selected.includes(o);
          return (
            <button
              key={o}
              type="button"
              onClick={() => (multi ? toggle(o) : pick(o))}
              className={`ak-askq-opt${on ? " on" : ""}`}
              style={{ animationDelay: `${i * 40}ms` }}
              aria-pressed={multi ? on : undefined}
            >
              <span className={`ak-askq-${multi ? "check" : "radio"}${on ? " on" : ""}`} aria-hidden="true" />
              <span className="min-w-0 flex-1 text-left leading-snug">{o}</span>
              {i < shown && (
                <kbd>
                  <i className="alt-pre">Alt </i>
                  {start + i + 1}
                </kbd>
              )}
            </button>
          );
        })}
        <button
          type="button"
          onClick={() => setCustom(true)}
          className={`ak-askq-opt${custom ? " on" : ""}`}
          style={{ animationDelay: `${options.length * 40}ms` }}
          aria-expanded={custom}
        >
          <span className={`ak-askq-${multi ? "check" : "radio"}${custom ? " on" : ""}`} aria-hidden="true" />
          <span className="min-w-0 flex-1 text-left leading-snug">Something else</span>
          {options.length < shown && (
            <kbd>
              <i className="alt-pre">Alt </i>
              {start + options.length + 1}
            </kbd>
          )}
        </button>
      </div>
      {custom && (
        <div className="ak-askq-custom">
          <input
            ref={inputRef}
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                sendCustom();
              }
              if (e.key === "Escape") {
                e.preventDefault();
                setCustom(false);
                setDraft("");
              }
            }}
            placeholder={multi ? "Add another…" : "Type your answer…"}
            className="ak-askq-input"
            aria-label="Your own answer"
          />
          {!multi && (
            <button type="button" onClick={sendCustom} disabled={!draft.trim()} className="ak-askq-send">
              Send
            </button>
          )}
        </div>
      )}
      {multi && (
        <div className="ak-askq-confirm">
          <button type="button" onClick={confirmMulti} disabled={!canConfirm} className="ak-askq-send">
            Confirm{selected.length > 0 ? ` (${selected.length})` : ""}
          </button>
          <kbd>
            <i className="alt-pre">Alt </i>Enter
          </kbd>
        </div>
      )}
    </fieldset>
  );
}
