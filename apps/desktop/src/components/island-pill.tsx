"use client";

// Compact island: one line with a label, a dim detail and a trailing chip.
// It reports its own width so the shell fits it (the shell springs to whatever
// this measures).

import { motion } from "motion/react";
import { type ReactNode, useLayoutEffect, useRef } from "react";
import { api } from "@/lib/bridge";
import { useNow } from "@/lib/hooks";
import { Ic } from "./icon";
import { Bars, clock, EdgeRing, MorphLabel, type PillModel } from "./island-pill/pill-kind";

export function IslandPill({ model, onWidth }: { model: PillModel; onWidth: (w: number) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const now = useNow(1000);
  const { kind } = model;

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const report = () => onWidth(Math.ceil(el.offsetWidth));
    report();
    const ro = new ResizeObserver(report);
    ro.observe(el);
    return () => ro.disconnect();
  }, [onWidth]);

  let trail: ReactNode = null;
  if (kind === "working")
    trail = (
      <span className="tnum">
        {model.endsAt !== undefined ? clock(Math.max(0, model.endsAt - now)) : clock(now - (model.startedAt ?? now))}
      </span>
    );
  else if (kind === "listening")
    trail = (
      <>
        <Bars />
        {model.onChip && (
          <button
            type="button"
            className="chip-s ic-only"
            aria-label="Stop listening"
            onClick={(e) => {
              e.stopPropagation();
              model.onChip?.();
            }}
          >
            <Ic name="x" size={12} />
          </button>
        )}
      </>
    );
  else if (kind === "caption")
    trail = (
      <>
        {model.chip && <span className="chip-s cap-tool">{model.chip}</span>}
        <button
          type="button"
          className="chip-s ic-only"
          aria-label="Stop"
          onClick={(e) => {
            e.stopPropagation();
            model.onChip?.();
          }}
        >
          <Ic name="x" size={12} />
        </button>
      </>
    );
  else if (kind === "done" && model.chip && model.onChip)
    trail = (
      <button
        type="button"
        className="chip-s"
        onClick={(e) => {
          e.stopPropagation();
          model.onChip?.();
        }}
      >
        {model.chip}
      </button>
    );
  else if (kind === "done" && model.onOpen)
    trail = (
      <button
        type="button"
        className="chip-s ic-only"
        aria-label="Open"
        onClick={(e) => {
          e.stopPropagation();
          model.onOpen?.();
        }}
      >
        <Ic name="folder" size={12} />
      </button>
    );
  else if (kind === "focus")
    trail = (
      <span className="tnum" style={{ color: "var(--ink-2)" }}>
        {model.left}
      </span>
    );
  else if (kind === "paused")
    trail = (
      <>
        <button
          type="button"
          className="chip-s ic-only"
          aria-label="Resume"
          style={{ cursor: "pointer", color: "var(--warn)" }}
          onClick={(e) => {
            e.stopPropagation();
            if (model.onCancel) model.onCancel();
            else void api.sensorsResume();
          }}
        >
          <Ic name="play" size={12} />
        </button>
      </>
    );
  else if (kind === "offline")
    trail = (
      <button
        type="button"
        className="chip-s ic-only"
        aria-label="Details"
        style={{ color: "var(--warn)" }}
        onClick={(e) => {
          e.stopPropagation();
          model.onOpen?.();
        }}
      >
        <Ic name="wifi" size={13} />
      </button>
    );
  else if (kind === "waiting") trail = <span className="badge tnum">{model.count ?? 1}</span>;
  else if ((kind === "suggest" || kind === "notify") && model.chip)
    trail = (
      <button
        type="button"
        className="chip-s"
        onClick={(e) => {
          e.stopPropagation();
          model.onChip?.();
        }}
      >
        {model.chip}
      </button>
    );
  else if (kind === "error")
    trail = (
      <button
        type="button"
        className="chip-s"
        onClick={(e) => {
          e.stopPropagation();
          void api.askOpen();
        }}
      >
        Details
      </button>
    );

  return (
    <>
      {kind === "working" && <EdgeRing progress={model.progress} />}
      <motion.div
        ref={ref}
        className="cmp absolute top-0 left-0"
        initial={{ opacity: 0, filter: "blur(6px)" }}
        animate={{ opacity: 1, filter: "blur(0px)", transition: { duration: 0.28, delay: 0.07 } }}
        exit={{ opacity: 0, filter: "blur(4px)", transition: { duration: 0.11 } }}
        aria-live="polite"
      >
        {kind === "done" && (
          <span style={{ color: "var(--ok)", display: "inline-flex" }}>
            <Ic name="check" size={15} />
          </span>
        )}
        {kind === "suggest" && <span className="dot" style={{ background: "#95a89a" }} />}
        <span
          className={`cmp-label${kind === "suggest" || kind === "notify" ? " nt" : ""}${kind === "listening" ? " words" : ""}${kind === "caption" ? " cap" : ""}`}
        >
          <MorphLabel text={model.label} />
          {model.dim && <span className="dim"> {model.dim}</span>}
        </span>
        {trail && <span className="cmp-trail">{trail}</span>}
      </motion.div>
    </>
  );
}
