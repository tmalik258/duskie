"use client";

import { Ic } from "../../icon";

/** Project name, Open file, Search, Terminal and Close. */
export function EditorBar({
  root,
  term,
  onQuick,
  onFind,
  onTerm,
  onClose,
}: {
  root: string;
  term: boolean;
  onQuick: () => void;
  onFind: () => void;
  onTerm: () => void;
  onClose: () => void;
}) {
  return (
    <div className="gd-bar">
      <span className="gd-pick">
        <Ic name="folder" size={14} />
        <span className="truncate">{root.split(/[\\/]/).pop()}</span>
      </span>
      <button type="button" className="rd-btn ghost chip-s" onClick={onQuick}>
        Open file <kbd>Ctrl P</kbd>
      </button>
      <button type="button" className="rd-btn ghost chip-s" onClick={onFind}>
        Search <kbd>Ctrl Shift F</kbd>
      </button>
      <button type="button" className="rd-btn ghost chip-s" aria-pressed={term} onClick={onTerm}>
        Terminal <kbd>Ctrl `</kbd>
      </button>
      <button type="button" className="rd-btn ghost chip-s ic-only ml-auto" aria-label="Close editor" onClick={onClose}>
        <Ic name="x" size={12} />
      </button>
    </div>
  );
}
