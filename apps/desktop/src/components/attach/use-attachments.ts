"use client";

// Files pasted, dropped or picked into a chat box. Each is saved where the
// agent can read it and referenced in the text as @path, so every agent
// (Claude Code, Codex, local) sees it the same way.

import { type ClipboardEvent, type DragEvent, useEffect, useRef, useState } from "react";
import { api } from "@/lib/bridge";

export interface Attachment {
  name: string;
  path: string;
  /** A thumbnail for images. */
  url: string | null;
}

/** How a file appears in the text; quoted when the path has spaces. */
const refOf = (path: string) => (/\s/.test(path) ? `@"${path}"` : `@${path}`);

/** Larger files are refused: an agent reads them by path, but 20 MB is plenty. */
const MAX_BYTES = 20 * 1024 * 1024;

export function useAttachments(text: string, setText: (t: string) => void) {
  const [items, setItems] = useState<Attachment[]>([]);
  const [error, setError] = useState<string | null>(null);
  const textRef = useRef(text);
  textRef.current = text;
  // Removing @path from the text drops its chip too.
  const shown = items.filter((a) => text.includes(refOf(a.path)));
  useEffect(() => {
    if (shown.length === items.length) return;
    for (const a of items) if (!shown.includes(a) && a.url) URL.revokeObjectURL(a.url);
    setItems(shown);
  }, [shown, items]);

  const add = async (files: File[]) => {
    setError(null);
    for (const f of files) {
      if (f.size > MAX_BYTES) {
        setError(`${f.name} is over 20 MB`);
        continue;
      }
      try {
        const data = Array.from(new Uint8Array(await f.arrayBuffer()));
        const name = f.name || (f.type.startsWith("image/") ? `pasted.${f.type.slice(6) || "png"}` : "file");
        const path = await api.saveAttachment(name, data);
        const url = f.type.startsWith("image/") ? URL.createObjectURL(f) : null;
        setItems((xs) => [...xs, { name, path, url }]);
        const t = textRef.current;
        const next = `${t}${t && !/\s$/.test(t) ? " " : ""}${refOf(path)} `;
        textRef.current = next;
        setText(next);
      } catch (e) {
        setError(String(e));
      }
    }
  };
  const remove = (a: Attachment) => setText(textRef.current.replace(refOf(a.path), "").replace(/\s{2,}/g, " "));
  const onPaste = (e: ClipboardEvent) => {
    const files = Array.from(e.clipboardData.files);
    if (!files.length) return;
    e.preventDefault();
    void add(files);
  };
  const onDrop = (e: DragEvent) => {
    const files = Array.from(e.dataTransfer.files);
    if (!files.length) return;
    e.preventDefault();
    void add(files);
  };
  const onDragOver = (e: DragEvent) => {
    if (e.dataTransfer.types.includes("Files")) e.preventDefault();
  };
  return { items: shown, error, add, remove, onPaste, onDrop, onDragOver };
}
