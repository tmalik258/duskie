"use client";

// The paperclip button and a chip per attached file, with an X to remove it.

import { useRef } from "react";
import { Ic } from "../icon";
import { Tip } from "../tip";
import { type ContextItem, parents } from "./context";
import { Thumb } from "./image-view";

export function AttachButton({ onFiles }: { onFiles: (files: File[]) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <>
      <Tip label="Attach files (or paste, or drop)">
        <button type="button" className="ak-attach" aria-label="Attach files" onClick={() => ref.current?.click()}>
          <Ic name="clip" size={13} />
        </button>
      </Tip>
      <input
        ref={ref}
        type="file"
        multiple
        hidden
        onChange={(e) => {
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
