"use client";

// Part of island-parts: DismissFill, choose, showLess, privateOpenLabel, Options.

import { motion, useReducedMotion } from "motion/react";
import { useState } from "react";
import { api } from "@/lib/bridge";
import { playSound } from "@/lib/sound/play-mood";
import { notePick, showDone, uiVolume, useDuskie } from "@/lib/store";
import type { Suggestion } from "@/lib/types";
import { FULL } from "../island-card";
import { Tip } from "../tip";
import { ALWAYS_GLANCE, always, dismiss, runningLabel } from "./activity";

/** A fill inside Dismiss that drains while the card waits to close on its
 * own. Rust restarts that clock while the island is hovered, so it refills.
 * With reduced motion it stays still. */
function DismissFill() {
  const secs = useDuskie((s) => s.settings.collapseAfterSecs);
  const hovered = useDuskie((s) => s.hovered);
  const reduced = useReducedMotion() ?? false;
  if (!secs || reduced) return null;
  return (
    <motion.i
      key={hovered ? "held" : "running"}
      className="rd-dz-fill"
      aria-hidden
      style={{ originX: 0 }}
      initial={{ scaleX: 1 }}
      animate={{ scaleX: hovered ? 1 : 0 }}
      transition={hovered ? { duration: 0 } : { duration: secs, ease: "linear" }}
    />
  );
}

/** Shift+click or Shift+Alt+N opens a link in a private window. */
export function choose(suggestion: Suggestion, index: number, priv = false) {
  playSound("select", uiVolume(), useDuskie.getState().settings.soundKit);
  useDuskie.setState({ running: runningLabel(suggestion, index) });
  notePick(suggestion.skillId, suggestion.options[index] ?? "");
  void api.suggestionChoose(suggestion.id, index, priv);
}

/** Quieter next time; counts toward scoring (Dismiss does not). */
export function showLess(suggestion: Suggestion) {
  playSound("toggle_off", uiVolume(), useDuskie.getState().settings.soundKit);
  const key = suggestion.skillId;
  void api.attentionShowLess(key);
  void api.suggestionDismiss(suggestion.id, "user");
  showDone(`Fewer like this${suggestion.source ? ` from ${suggestion.source}` : ""}`, () => {
    void api.attentionUndoShowLess(key);
    useDuskie.setState({ donePill: null, doneUndo: null });
  });
}

/** Hover with intent: a short delay in (or longer when the pill has actions), a grace period out. */

/** Shift+Alt morph: browser chips become their private/incognito names. */
export function privateOpenLabel(option: string): string {
  if (/\b(private|incognito|inprivate)\b/i.test(option)) return option;
  switch (option.trim().toLowerCase()) {
    case "edge":
      return "Edge InPrivate";
    case "firefox":
      return "Firefox Private";
    case "zen":
      return "Zen Private";
    case "brave":
      return "Brave Incognito";
    case "chrome":
      return "Chrome Incognito";
    case "default browser":
      return "Private window";
    default:
      return `${option} private`;
  }
}

export function Options({ suggestion }: { suggestion: Suggestion }) {
  const alwaysAt = suggestion.always?.findIndex(Boolean) ?? -1;
  const canShowLess = !ALWAYS_GLANCE.has(suggestion.skillId);
  // Shift while hovered, or Shift+Alt anywhere, Rust polls; no hover required.
  const priv = useDuskie((s) => s.shiftHeld);
  const [why, setWhy] = useState(false);
  return (
    <div className="mt-2.5 flex min-w-0 flex-col gap-1.5" style={FULL}>
      <div className="rd-opts flex min-w-0 max-w-full flex-wrap gap-1.5">
        {suggestion.options.map((option, i) => {
          const openUrl = suggestion.actions[i] === "open_url";
          const label = priv && openUrl ? privateOpenLabel(option) : option;
          return (
            <motion.button
              // biome-ignore lint/suspicious/noArrayIndexKey: labels can repeat and the list never reorders
              key={`${i}-${option}`}
              type="button"
              onClick={(e) => choose(suggestion, i, e.shiftKey || (priv && openUrl))}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.22, delay: 0.08 + i * 0.03, ease: [0.23, 1, 0.32, 1] }}
              className={`rd-opt chip gap-2 ${i === 0 ? "rd-opt-primary" : ""}`}
            >
              <span className="min-w-0 truncate leading-snug">{label}</span>
              <kbd className={`shrink-0 font-sans text-[11px] leading-none ${i === 0 ? "opacity-40" : "opacity-45"}`}>
                Alt {i + 1}
              </kbd>
            </motion.button>
          );
        })}
      </div>
      {why && suggestion.why && (
        <p className="px-1 text-[11.5px] leading-4 text-(--ink-3)" role="note">
          {suggestion.why}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5 px-1">
        {alwaysAt >= 0 && (
          <Tip label={`From now on, "${suggestion.options[alwaysAt]}" without asking. Undo in Settings > Skills.`}>
            <button type="button" onClick={() => always(suggestion, alwaysAt)} className="rd-gfoot-btn chip">
              Always {suggestion.options[alwaysAt].toLowerCase()}
            </button>
          </Tip>
        )}
        {canShowLess && (
          <button type="button" onClick={() => showLess(suggestion)} className="rd-gfoot-btn chip">
            Show less
          </button>
        )}
        <span className="ml-auto" />
        {suggestion.why && (
          <button type="button" aria-expanded={why} onClick={() => setWhy((v) => !v)} className="rd-gfoot-btn chip">
            Why this?
          </button>
        )}
        <button type="button" onClick={() => dismiss(suggestion)} className="rd-gfoot-btn rd-dz chip">
          <DismissFill key={suggestion.id} />
          Dismiss
          <kbd className="ml-1.5 font-sans text-[11px] opacity-45">
            <i className="alt-pre">Alt </i>0
          </kbd>
        </button>
      </div>
    </div>
  );
}
