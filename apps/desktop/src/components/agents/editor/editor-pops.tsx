"use client";

import { useMemo } from "react";
import type { EditorHit, TreeEntry } from "@/lib/types";

/** Ctrl P: go to a file by name. */
export function QuickOpen({
  quick,
  tree,
  setQuick,
  onOpen,
}: {
  quick: string;
  tree: TreeEntry[];
  setQuick: (q: string | null) => void;
  onOpen: (path: string) => void;
}) {
  const matches = useMemo(() => {
    const q = quick.toLowerCase();
    return tree.filter((f) => !f.dir && f.path.toLowerCase().includes(q)).slice(0, 30);
  }, [tree, quick]);
  return (
    <div className="ed-pop" role="dialog" aria-label="Open file">
      <input
        // biome-ignore lint/a11y/noAutofocus: the picker opens for typing.
        autoFocus
        aria-label="File name"
        placeholder="Go to file"
        value={quick}
        onChange={(e) => setQuick(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && matches[0]) {
            // Keep the Enter from reaching the file that opens.
            e.preventDefault();
            e.stopPropagation();
            onOpen(matches[0].path);
            setQuick(null);
          }
        }}
      />
      {matches.map((f) => (
        <button
          key={f.path}
          type="button"
          onClick={() => {
            onOpen(f.path);
            setQuick(null);
          }}
        >
          {f.path}
        </button>
      ))}
    </div>
  );
}

/** Ctrl Shift F: search text across the project. */
export function ProjectSearch({
  find,
  hits,
  setFind,
  onOpen,
}: {
  find: string;
  hits: EditorHit[];
  setFind: (f: string | null) => void;
  onOpen: (path: string, line: number) => void;
}) {
  return (
    <div className="ed-pop" role="dialog" aria-label="Search the project">
      <input
        // biome-ignore lint/a11y/noAutofocus: the search opens for typing.
        autoFocus
        aria-label="Search text"
        placeholder="Search in files"
        value={find}
        onChange={(e) => setFind(e.target.value)}
      />
      {hits.map((h) => (
        <button
          key={`${h.path}:${h.line}`}
          type="button"
          onClick={() => {
            onOpen(h.path, h.line);
            setFind(null);
          }}
        >
          <span className="mono">
            {h.path}:{h.line}
          </span>{" "}
          {h.text}
        </button>
      ))}
    </div>
  );
}
