"use client";

// Part of ui: ShortcutRecorder.

import { useEffect, useState } from "react";
import { shortcutBinding, shortcutEnabled } from "@/lib/shortcuts";
import { comboFrom, reservedBy } from "./folder-picker";
import { Button } from "./settings-query";

/** Records a key combination: click, press the keys, done. Off keeps the
 * combo (prefixed with `-`) so turning it back on restores the same keys. */
export function ShortcutRecorder({
  value,
  onChange,
  label,
}: {
  value: string;
  onChange: (keys: string) => void;
  label: string;
}) {
  const [recording, setRecording] = useState(false);
  const binding = shortcutBinding(value);
  const on = shortcutEnabled(value);
  useEffect(() => {
    if (!recording) return;
    const onKey = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.key === "Escape") return setRecording(false);
      const keys = comboFrom(e);
      if (keys) {
        setRecording(false);
        onChange(keys);
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [recording, onChange]);
  return (
    <div className="flex items-center gap-1.5">
      <button
        type="button"
        aria-label={`${label} shortcut`}
        onClick={() => setRecording(true)}
        className={`min-w-32 rounded-md border px-2 py-1 text-center font-mono text-[12px] ${
          recording
            ? "border-(--accent) text-(--accent)"
            : on
              ? "border-(--border)"
              : "border-(--border) text-(--muted)"
        }`}
      >
        {recording ? "Press keys..." : binding || "Off"}
      </button>
      {binding && !recording && (
        <Button small onClick={() => onChange(on ? `-${binding}` : binding)}>
          {on ? "Off" : "On"}
        </Button>
      )}
      {reservedBy(binding) && !recording && (
        <span className="text-[11px] text-[#ff9f0a]">Also used by {reservedBy(binding)}</span>
      )}
    </div>
  );
}
