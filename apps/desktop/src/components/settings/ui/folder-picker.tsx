"use client";

// Part of ui: FolderPicker, RESERVED, reservedBy, KEY_NAMES, comboFrom.

import { useState } from "react";
import { Button } from "./settings-query";

/** Folder checkboxes: found ones first, then any already chosen. */
export function FolderPicker({
  found,
  chosen,
  onChange,
  empty,
}: {
  found: { path: string; label: string; repos?: number }[];
  chosen: string[];
  onChange: (next: string[]) => void;
  empty: string;
}) {
  const known = new Set(found.map((f) => f.path));
  const rows = [
    ...found,
    ...chosen.filter((c) => !known.has(c)).map((path) => ({ path, label: path.split(/[\\/]/).pop() || path })),
  ];
  const [draft, setDraft] = useState("");
  return (
    <div className="flex flex-col gap-1.5 text-[13px]">
      {rows.length === 0 && empty && <p className="text-[12px] text-(--muted)">{empty}</p>}
      {rows.map((f) => (
        <label key={f.path} className="flex cursor-pointer items-center gap-2.5">
          <input
            type="checkbox"
            checked={chosen.includes(f.path)}
            onChange={(e) => onChange(e.target.checked ? [...chosen, f.path] : chosen.filter((c) => c !== f.path))}
            className="check shrink-0"
          />
          <span className="min-w-0">
            <span className="font-medium">{f.label}</span>
            {"repos" in f && typeof f.repos === "number" && f.repos > 0 && (
              <span className="text-(--muted)">
                {" "}
                · {f.repos} {f.repos === 1 ? "repo" : "repos"}
              </span>
            )}
            <span className="block truncate font-mono text-[11px] text-(--muted)">{f.path}</span>
          </span>
        </label>
      ))}
      <div className="mt-1 flex gap-2">
        <input
          value={draft}
          placeholder="Add another folder (paste its path)"
          aria-label="Add a folder"
          spellCheck={false}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && draft.trim()) {
              onChange([...chosen, draft.trim()]);
              setDraft("");
            }
          }}
          className="min-w-0 flex-1 rounded-md border border-(--border) bg-transparent px-2 py-1 font-mono text-[12px] outline-none focus:border-(--accent)"
        />
        <Button
          small
          disabled={!draft.trim()}
          onClick={() => {
            onChange([...chosen, draft.trim()]);
            setDraft("");
          }}
        >
          Add
        </Button>
      </div>
    </div>
  );
}

/** Keys other apps commonly take, with who takes them. */
const RESERVED: Record<string, string> = {
  "Alt+R": "the NVIDIA overlay",
  "Alt+Z": "the NVIDIA overlay",
  "Alt+F9": "the NVIDIA overlay",
  "Alt+F10": "the NVIDIA overlay",
  "Alt+Shift+F10": "the NVIDIA overlay",
  "Alt+Tab": "Windows",
  "Alt+F4": "Windows",
  "Ctrl+Shift+Escape": "Windows",
  "Super+G": "the Xbox Game Bar",
  "Super+Alt+R": "the Xbox Game Bar",
  "Alt+Space": "the Google app and PowerToys Run",
  "Ctrl+Alt+Space": "the Google app",
  "Ctrl+Space": "VS Code suggestions",
  "Ctrl+Shift+Space": "VS Code parameter hints",
  "Super+Space": "Windows (keyboard language)",
  "Ctrl+Super+Space": "Windows (keyboard language)",
  "Shift+Super+Space": "Windows (keyboard language)",
};

/** Who else uses `keys`, or null. */
export function reservedBy(keys: string): string | null {
  return RESERVED[keys] ?? null;
}

const KEY_NAMES: Record<string, string> = {
  " ": "Space",
  ",": "Comma",
  ".": "Period",
  "/": "Slash",
  ";": "Semicolon",
  "'": "Quote",
  "[": "BracketLeft",
  "]": "BracketRight",
  "-": "Minus",
  "=": "Equal",
  ArrowUp: "Up",
  ArrowDown: "Down",
  ArrowLeft: "Left",
  ArrowRight: "Right",
};

/** "Ctrl+Alt+K" from a key event, or null while only modifiers are held. */
export function comboFrom(e: { key: string; ctrlKey: boolean; altKey: boolean; shiftKey: boolean; metaKey: boolean }) {
  if (["Control", "Alt", "Shift", "Meta", "AltGraph"].includes(e.key)) return null;
  const mods = [e.ctrlKey && "Ctrl", e.altKey && "Alt", e.shiftKey && "Shift", e.metaKey && "Super"].filter(Boolean);
  // A shortcut needs a modifier, except the function keys.
  if (mods.length === 0 && !/^F\d{1,2}$/.test(e.key)) return null;
  const key = KEY_NAMES[e.key] ?? (e.key.length === 1 ? e.key.toUpperCase() : e.key);
  return [...mods, key].join("+");
}
