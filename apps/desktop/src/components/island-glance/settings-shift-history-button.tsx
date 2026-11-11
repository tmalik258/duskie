"use client";

// Part of island-glance: SettingsShiftHistoryButton, RoundButton, UpdateButton, useShiftHeld, AskShiftAgentsButton.

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { type ReactNode, useEffect, useState } from "react";
import { api } from "@/lib/bridge";
import { shortcutBinding } from "@/lib/shortcuts";
import { installUpdate, useAssistantName, useDuskie } from "@/lib/store";
import { updateBusy, updateLabel } from "@/lib/updates";
import { Ic } from "../icon";
import { Tip } from "../tip";
import { keyHint } from "./later-list";
import { openAgentsBoard, openHistory, qbClass } from "./qb-class";

/** Settings by default; hold Shift to morph into History (one slot, animated icon). */
export function SettingsShiftHistoryButton({ shift }: { shift: boolean }) {
  const reduced = useReducedMotion() ?? false;
  const history = shift;
  const label = history ? "History" : "Settings · Shift for History";
  return (
    <Tip label={label}>
      <button
        type="button"
        aria-label={label}
        onClick={(e) => {
          if (e.shiftKey || history) openHistory();
          else void api.openSettings();
        }}
        className={qbClass}
      >
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.span
            key={history ? "history" : "settings"}
            className="grid place-items-center"
            initial={reduced ? false : { opacity: 0, scale: 0.7, rotate: history ? -20 : 20 }}
            animate={{ opacity: 1, scale: 1, rotate: 0 }}
            exit={reduced ? undefined : { opacity: 0, scale: 0.7, rotate: history ? 20 : -20 }}
            transition={{ duration: 0.16, ease: [0.23, 1, 0.32, 1] }}
          >
            <Ic name={history ? "clock" : "gear"} size={16} />
          </motion.span>
        </AnimatePresence>
      </button>
    </Tip>
  );
}

export function RoundButton({
  label,
  onClick,
  children,
  disabled = false,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
  disabled?: boolean;
}) {
  return (
    <Tip label={label}>
      <button
        type="button"
        aria-label={label}
        disabled={disabled}
        onClick={onClick}
        className={`${qbClass} disabled:cursor-wait disabled:opacity-60`}
      >
        {children}
      </button>
    </Tip>
  );
}

/** Only while a newer release is waiting: a small button with a dot. */
export function UpdateButton() {
  const update = useDuskie((s) => s.update);
  const progress = useDuskie((s) => s.updateProgress);
  const busy = updateBusy(progress);
  if (!update) return null;
  const install = () => {
    void installUpdate().catch(() => undefined);
  };
  return (
    <span className="relative">
      <RoundButton
        label={progress ? updateLabel(progress) : `Update to ${update.version}`}
        onClick={install}
        disabled={busy}
      >
        {busy ? (
          <span
            aria-hidden="true"
            className="size-4 animate-spin rounded-full border-2 border-white/25 border-t-white motion-reduce:animate-none"
          />
        ) : (
          <Ic name="update" size={16} />
        )}
      </RoundButton>
      <span
        aria-hidden="true"
        className="pointer-events-none absolute top-0 right-0 size-2 rounded-full bg-(--c3,#0a84ff) ring-2 ring-(--c1,#000)"
      />
    </span>
  );
}

/** Shift for glance morphs. The shell stays unfocused, so keydown never
 * arrives, Rust polls while hovered (and Shift+Alt for suggestions); pointer
 * events back it up when the cursor is over the webview. */
export function useShiftHeld(): boolean {
  const fromRust = useDuskie((s) => s.shiftHeld);
  const [fromPointer, setFromPointer] = useState(false);
  useEffect(() => {
    const sync = (e: PointerEvent | KeyboardEvent) => setFromPointer(e.shiftKey);
    const clear = () => setFromPointer(false);
    window.addEventListener("pointermove", sync);
    window.addEventListener("pointerdown", sync);
    window.addEventListener("pointerover", sync);
    window.addEventListener("keydown", sync);
    window.addEventListener("keyup", sync);
    window.addEventListener("blur", clear);
    return () => {
      window.removeEventListener("pointermove", sync);
      window.removeEventListener("pointerdown", sync);
      window.removeEventListener("pointerover", sync);
      window.removeEventListener("keydown", sync);
      window.removeEventListener("keyup", sync);
      window.removeEventListener("blur", clear);
    };
  }, []);
  return fromRust || fromPointer;
}

/** Ask by default; hold Shift to morph into Agents (one slot, animated icon). */
export function AskShiftAgentsButton({ shift }: { shift: boolean }) {
  const askKeys = shortcutBinding(useDuskie((s) => s.settings.paletteHotkey));
  const agentsKeys = shortcutBinding(useDuskie((s) => s.settings.shortcuts.agents ?? ""));
  const name = useAssistantName();
  const reduced = useReducedMotion() ?? false;
  const agents = shift;
  const label = agents
    ? `Agents${keyHint(agentsKeys)}`
    : `Ask ${name}${keyHint(askKeys)} · Shift for Agents${keyHint(agentsKeys)}`;
  return (
    <Tip label={label}>
      <button
        type="button"
        aria-label={label}
        onClick={(e) => {
          if (e.shiftKey || agents) openAgentsBoard();
          else void api.askOpen();
        }}
        className={qbClass}
      >
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.span
            key={agents ? "agents" : "ask"}
            className="grid place-items-center"
            initial={reduced ? false : { opacity: 0, scale: 0.7, rotate: agents ? -20 : 20 }}
            animate={{ opacity: 1, scale: 1, rotate: 0 }}
            exit={reduced ? undefined : { opacity: 0, scale: 0.7, rotate: agents ? 20 : -20 }}
            transition={{ duration: 0.16, ease: [0.23, 1, 0.32, 1] }}
          >
            <Ic name={agents ? "term" : "ask"} size={16} />
          </motion.span>
        </AnimatePresence>
      </button>
    </Tip>
  );
}
