// Keys for a Select: arrows move, Enter picks, Escape clears the filter or closes.

import type { KeyboardEvent as ReactKeyboardEvent } from "react";
import type { Row } from "./row";

export interface SelectKeys {
  open: boolean;
  setOpen: (open: boolean) => void;
  query: string;
  setQuery: (q: string) => void;
  shown: Row[];
  active: number;
  move: (dir: 1 | -1) => void;
  pick: (v: string) => void;
}

/** Keys while focus is inside the open menu. */
export function onMenuKey(k: SelectKeys, e: ReactKeyboardEvent) {
  if (e.key === "Escape") {
    e.preventDefault();
    if (k.query) k.setQuery("");
    else k.setOpen(false);
    return;
  }
  if (e.key === "ArrowDown") {
    e.preventDefault();
    k.move(1);
    return;
  }
  if (e.key === "ArrowUp") {
    e.preventDefault();
    k.move(-1);
    return;
  }
  if (e.key === "Enter") {
    e.preventDefault();
    const next = k.shown[k.active];
    if (next) k.pick(next.value);
  }
}

/** Keys on the closed or open chip. */
export function onChipKey(k: SelectKeys, e: ReactKeyboardEvent<HTMLButtonElement>) {
  if (e.key === "Escape") {
    e.preventDefault();
    k.setOpen(false);
    return;
  }
  if (e.key === "ArrowDown" || e.key === "ArrowUp") {
    e.preventDefault();
    if (!k.open) {
      k.setOpen(true);
      return;
    }
    k.move(e.key === "ArrowDown" ? 1 : -1);
    return;
  }
  if (e.key === "Enter" || e.key === " ") {
    e.preventDefault();
    if (!k.open) {
      k.setOpen(true);
      return;
    }
    const next = k.shown[k.active];
    if (next) k.pick(next.value);
  }
}
