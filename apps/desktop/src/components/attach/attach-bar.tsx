"use client";

// The paperclip button and a chip per attached file, with an X to remove it.

import { useEffect, useRef } from "react";
import { api } from "@/lib/bridge";
import { Ic } from "../icon";
import { Tip } from "../tip";
import { type ContextItem, parents } from "./context";
import { Thumb } from "./image-view";

export function AttachButton({ onFiles }: { onFiles: (files: File[]) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  // The picker would open behind the always-on-top island: step it down
  // while the picker is up.
  useEffect(() => {
    const input = ref.current;
    if (!input) return;
    const back = () => void api.islandDialog(false).catch(() => {});
    input.addEventListener("cancel", back);
    window.addEventListener("focus", back);
    return () => {
      input.removeEventListener("cancel", back);
      window.removeEventListener("focus", back);
    };
  }, []);
  const open = () => {
    void api
      .islandDialog(true)
      .catch(() => {})
      .finally(() => ref.current?.click());
  };
  return (
    <>
      <Tip label="Attach files (or paste, or drop)">
        <button type="button" className="ak-attach" aria-label="Attach files" onClick={open}>
          <Ic name="clip" size={13} />
        </button>
      </Tip>
      <input
        ref={ref}
        type="file"
        multiple
        hidden
        onChange={(e) => {
          void api.islandDialog(false).catch(() => {});
          onFiles(Array.from(e.target.files ?? []));
          e.target.value = "";
        }}
      />
    </>
  );
}

export function ContextChips({
  items,
  error,
  onRemove,
}: {
  items: ContextItem[];
  error: string | null;
  onRemove: (i: ContextItem) => void;
}) {
  if (!items.length && !error) return null;
  return (
    <div className="ak-attachments">
      {items.map((i) => (
        <Tip key={i.path} label={parents(i.path)} className="inline-flex min-w-0">
          <span className="ak-att">
            {i.url ? <Thumb url={i.url} name={i.name} /> : <Ic name={i.folder ? "folder" : "file"} size={12} />}
            <span className="truncate">{i.name}</span>
            <button type="button" aria-label={`Remove ${i.name}`} onClick={() => onRemove(i)}>
              <Ic name="x" size={10} />
            </button>
          </span>
        </Tip>
      ))}
      {error && <span className="ak-err">{error}</span>}
    </div>
  );
}
