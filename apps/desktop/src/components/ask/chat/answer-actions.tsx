"use client";

// Part of chat: AnswerActions.

import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/bridge";
import { askAgain, thinkHarder, useDuskie } from "@/lib/store";
import { Tip } from "../../tip";
import { Retry } from "./retry";
import { ActIcon, SaveRecipe, StopIcon } from "./yaml-block";

/** The coding agent that gets handoffs, or null when neither is installed. */
/** Copy, Retry and Think harder under an answer. Who answered and how fast
 * sit behind the info button: hover to peek, click to keep them shown, click
 * again to hide. Keys work on the last answer only. */
export function AnswerActions({
  text,
  keys,
  again,
  think,
  recipe,
  detail,
}: {
  text: string;
  keys: boolean;
  again: boolean;
  think: boolean;
  recipe: string;
  detail: string;
}) {
  const [copied, setCopied] = useState(false);
  const [pinned, setPinned] = useState(false);
  const speaking = useDuskie((s) => s.speaking);
  const [loading, setLoading] = useState(false);
  const readGen = useRef(0);
  useEffect(() => {
    if (speaking) setLoading(false);
  }, [speaking]);
  const phase = loading ? "loading" : speaking ? "playing" : "idle";
  const read = () => {
    if (phase === "playing" || phase === "loading") {
      readGen.current += 1;
      setLoading(false);
      void api.voiceStop();
      return;
    }
    const id = ++readGen.current;
    setLoading(true);
    void api
      .voiceRead(text)
      .then(() => {
        // Invoke can finish before audio starts; keep the spinner until then.
        window.setTimeout(() => {
          if (readGen.current !== id) return;
          setLoading(false);
        }, 2000);
      })
      .catch(() => {
        if (readGen.current !== id) return;
        setLoading(false);
      });
  };
  const copy = () => {
    void api
      .clipboardCopy(text)
      .then(() => setCopied(true))
      .catch(() => undefined);
  };
  useEffect(() => {
    if (!keys) return;
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (!e.altKey || e.ctrlKey || e.shiftKey) return;
      const k = e.key.toLowerCase();
      if (k === "c") copy();
      else if (k === "t" && again) askAgain();
      else if (k === "k" && think) thinkHarder();
      else if (k === "l") read();
      else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });
  const key = (k: string) =>
    keys && (
      <kbd>
        <i className="alt-pre">Alt </i>
        {k}
      </kbd>
    );
  const readLabel = phase === "loading" ? "Starting…" : phase === "playing" ? "Stop reading" : "Read aloud · Alt L";
  return (
    <div className="grid gap-1">
      <div className="ak-acts" data-detail={detail}>
        <Tip label={copied ? "Copied" : "Copy · Alt C"}>
          <button
            type="button"
            onClick={copy}
            onMouseLeave={() => setCopied(false)}
            aria-label={copied ? "Copied" : "Copy"}
            className="ak-act ico chip"
          >
            <ActIcon
              d={
                copied
                  ? "M5 12.5l4.5 4.5L19 7.5"
                  : "M8 8h12v12H8zM16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"
              }
            />
          </button>
        </Tip>
        <Tip label={readLabel}>
          <button type="button" onClick={read} aria-label={readLabel} className="ak-act ico chip">
            {phase === "loading" ? (
              <span
                aria-hidden="true"
                className="size-3 animate-spin rounded-full border border-current border-r-transparent"
              />
            ) : phase === "playing" ? (
              <StopIcon />
            ) : (
              <ActIcon d="M11 5 6 9H3v6h3l5 4zM15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13" />
            )}
          </button>
        </Tip>
        {again && (
          <Tip label="Retry · Alt T">
            <button type="button" onClick={() => askAgain()} aria-label="Retry" className="ak-act ico chip">
              <ActIcon d="M20 12a8 8 0 1 1-2.3-5.6M20 4v4.5h-4.5" />
            </button>
          </Tip>
        )}
        {think && (
          <Tip label="Think harder · Alt K">
            <button type="button" onClick={() => thinkHarder()} className="ak-act chip">
              <ActIcon d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1" />
              Think harder {key("K")}
            </button>
          </Tip>
        )}
        {recipe && (
          <span className="ak-acts-hover">
            <SaveRecipe prompt={recipe} />
          </span>
        )}
        {detail && (
          <span className="ak-info">
            <button
              type="button"
              aria-label="Details"
              aria-pressed={pinned}
              onClick={() => setPinned(!pinned)}
              className="ak-ibtn chip"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" aria-hidden="true">
                <g fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="1.6">
                  <circle cx="12" cy="12" r="8.5" />
                  <path d="M12 11v5.5M12 7.8v.1" />
                </g>
              </svg>
            </button>
            {!pinned && <span className="ak-info-tip">{detail}</span>}
          </span>
        )}
      </div>
      {pinned && <p className="ak-info-line">{detail}</p>}
    </div>
  );
}
