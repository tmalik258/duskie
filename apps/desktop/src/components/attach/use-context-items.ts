"use client";

// The chips above a chat box: @ picks and uploads (paste, drop, paperclip).

import { type ClipboardEvent, type DragEvent, useState } from "react";
import { type ContextItem, fromPick } from "./context";
import { eventFiles, saveFile } from "./save-file";

export function useContextItems() {
  const [items, setItems] = useState<ContextItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const push = (i: ContextItem) => setItems((xs) => (xs.some((x) => x.path === i.path) ? xs : [...xs, i]));
  const pick = (path: string) => push(fromPick(path));
  const upload = async (files: File[]) => {
    setError(null);
    for (const f of files) {
      try {
        const a = await saveFile(f);
        push({ name: a.name, path: a.path, folder: false, url: a.url });
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    }
  };
  const remove = (i: ContextItem) => {
    if (i.url) URL.revokeObjectURL(i.url);
    setItems((xs) => xs.filter((x) => x !== i));
  };
  const clear = () => {
    for (const i of items) if (i.url) URL.revokeObjectURL(i.url);
    setItems([]);
    setError(null);
  };
  const onPaste = (e: ClipboardEvent) => {
    const files = eventFiles(e);
    if (!files.length) return;
    e.preventDefault();
    void upload(files);
  };
  const onDrop = (e: DragEvent) => {
    const files = eventFiles(e);
    if (!files.length) return;
    e.preventDefault();
    void upload(files);
  };
  const onDragOver = (e: DragEvent) => {
    if (e.dataTransfer.types.includes("Files")) e.preventDefault();
  };
  return { items, error, pick, upload, remove, clear, onPaste, onDrop, onDragOver };
}
