"use client";

// Part of ui: StatusDot, CopyButton, ChipList.

import { useState } from "react";
import { useCopy } from "@/lib/hooks";
import { Tip } from "../../tip";
import { Button } from "./settings-query";

export function StatusDot({ state }: { state: "ok" | "off" | "checking" }) {
  const label = state === "ok" ? "Ready" : state === "off" ? "Not reachable" : "Checking";
  return (
    <Tip label={label}>
      <span
        role="img"
        aria-label={label}
        className={`size-2 shrink-0 rounded-full ${
          state === "ok" ? "bg-[#30d158]" : state === "off" ? "bg-(--muted)/40" : "animate-pulse bg-amber-400"
        }`}
      />
    </Tip>
  );
}

export function CopyButton({ text, label = "Copy" }: { text: string; label?: string }) {
  const { copied, copy } = useCopy(text);
  return (
    <Button small onClick={copy}>
      {copied ? "Copied" : label}
    </Button>
  );
}

/** A list of removable chips with a picker (and typing) to add more. */
export function ChipList({
  items,
  onChange,
  suggestions,
  placeholder,
  label,
  format = (v: string) => v,
}: {
  items: string[];
  onChange: (next: string[]) => void;
  suggestions: string[];
  placeholder: string;
  label: string;
  /** How an item reads, e.g. "bitwarden.exe" as "Bitwarden". */
  format?: (v: string) => string;
}) {
  const [draft, setDraft] = useState("");
  const add = (v: string) => {
    const value = v.trim().toLowerCase();
    if (value && !items.includes(value)) onChange([...items, value]);
    setDraft("");
  };
  const listId = `${label.replace(/\s+/g, "-")}-options`;
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-1.5">
        {items.map((i) => (
          <Tip key={i} label={i}>
            <span className="flex items-center gap-1 rounded-full bg-(--surface) py-0.5 pr-1 pl-2.5 text-[12px]">
              {format(i)}
              <button
                type="button"
                aria-label={`Remove ${format(i)}`}
                onClick={() => onChange(items.filter((x) => x !== i))}
                className="grid size-4 place-items-center rounded-full text-(--muted) hover:bg-(--hover) hover:text-(--text)"
              >
                ×
              </button>
            </span>
          </Tip>
        ))}
        {items.length === 0 && <span className="text-[12px] text-(--muted)">None</span>}
      </div>
      <div className="flex gap-2">
        <input
          list={listId}
          value={draft}
          aria-label={label}
          placeholder={placeholder}
          spellCheck={false}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") add(draft);
          }}
          className="min-w-0 flex-1 rounded-md border border-(--border) bg-transparent px-2 py-1 text-[13px] outline-none focus:border-(--accent)"
        />
        <datalist id={listId}>
          {suggestions
            .filter((s) => !items.includes(s))
            .map((s) => (
              <option key={s} value={s} />
            ))}
        </datalist>
        <Button small onClick={() => add(draft)} disabled={!draft.trim()}>
          Add
        </Button>
      </div>
    </div>
  );
}
