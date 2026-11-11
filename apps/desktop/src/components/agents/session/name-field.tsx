"use client";

import { useEffect, useState } from "react";
import { renameSession } from "@/lib/agents";

/** The session's name: click to rename, Enter keeps it, Esc puts it back. */
export function NameField({ id, title }: { id: string; title: string }) {
  const [v, setV] = useState(title);
  useEffect(() => setV(title), [title]);
  return (
    <input
      aria-label="Session name"
      className="ak-title ak-name"
      value={v}
      onChange={(e) => setV(e.target.value)}
      onBlur={() => (v.trim() ? renameSession(id, v) : setV(title))}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
        else if (e.key === "Escape") {
          e.stopPropagation();
          setV(title);
          requestAnimationFrame(() => (document.activeElement as HTMLElement | null)?.blur());
        }
      }}
    />
  );
}
