// One row under the Ask input, and which row Enter picks before you move.

import type { ReactNode } from "react";
import { Ic } from "../../icon";
import type { Command } from "../starters/command";

/** One row under the input. */
export interface Item {
  id: string;
  /** Starts a named group ("Projects"). */
  group?: string;
  icon: ReactNode;
  label: ReactNode;
  hint?: string;
  /** A key shown at the end ("/"). */
  key?: string;
  run: () => void;
  /** Ctrl Enter: e.g. show a file's parent folder. Not used for folders. */
  ctrlRun?: () => void;
  /** Footer label for Ctrl Enter ("folder"). */
  ctrlHint?: string;
  /** Keep Ask open after running. */
  stay?: boolean;
  /** The row clears the input itself (or keeps it). */
  keepText?: boolean;
}

/** Selected row not chosen yet: the panel picks by what was typed. */
export const INTENT_PENDING = -1;

export function commandItem(c: Command): Item {
  return {
    id: c.id,
    icon:
      c.id === "starter:error" ? <span className="text-[11px] font-semibold">!</span> : <Ic name={c.icon} size={12} />,
    label: c.label,
    hint: c.hint,
    run: c.run,
    stay: c.stay,
  };
}

/** A short name ("slack", "dark mode", "settings"), not a question. */
function looksLikeName(text: string): boolean {
  const t = text.trim();
  if (!t || /[?]/.test(t)) return false;
  if (/^(what|why|how|who|when|where|which|can|could|should|is|are|do|does|explain|tell|write|summari[sz]e)\b/i.test(t))
    return false;
  return t.split(/\s+/).length <= 3;
}

/** A short name ("slack", "settings") picks its match; a question picks Ask.
 * "turn on hotspot" picks the switch itself. */
export function intentRow(items: Item[], text: string, asking: boolean, openWhere: boolean): number {
  if (openWhere) return 0;
  const switchRow = /\b(on|off|enable|disable)\b/i.test(text) ? items.findIndex((i) => i.id.startsWith("switch:")) : -1;
  if (asking && switchRow > 0) return switchRow;
  return asking && items.length > 3 && looksLikeName(text) ? 1 : 0;
}
