"use client";

// The paperclip button and a chip per attached file, with an X to remove it.

import { useRef } from "react";
import { Ic } from "../icon";
import type { Attachment } from "./use-attachments";

export function AttachButton({ onFiles }: { onFiles: (files: File[]) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <>
      <button
        type="button"
        className="ak-attach"
        aria-label="Attach files"
        title="Attach files (or paste, or drop)"
        onClick={() => ref.current?.click()}
      >
        <Ic name="clip" size={13} />
      </button>
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

export function AttachChips({
  items,
  error,
  onRemove,
}: {
  items: Attachment[];
  error: string | null;
  onRemove: (a: Attachment) => void;
}) {
  if (!items.length && !error) return null;
  return (
    <div className="ak-attachments">
      {items.map((a) => (
        <span key={a.path} className="ak-att" title={a.path}>
          {a.url ? <img src={a.url} alt="" /> : <Ic name="file" size={12} />}
          <span className="truncate">{a.name}</span>
          <button type="button" aria-label={`Remove ${a.name}`} onClick={() => onRemove(a)}>
            <Ic name="x" size={10} />
          </button>
        </span>
      ))}
      {error && <span className="ak-err">{error}</span>}
    </div>
  );
}
