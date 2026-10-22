// Files attached in the Ask box until the next question takes them.

import { create } from "zustand";
import type { ContextItem } from "@/components/attach/context";

export const useAskFiles = create<{ items: ContextItem[] }>(() => ({ items: [] }));

export function addAskFile(i: ContextItem) {
  useAskFiles.setState((s) => ({ items: s.items.some((x) => x.path === i.path) ? s.items : [...s.items, i] }));
}

export function removeAskFile(i: ContextItem) {
  if (i.url) URL.revokeObjectURL(i.url);
  useAskFiles.setState((s) => ({ items: s.items.filter((x) => x !== i) }));
}

/** The attached paths, emptied for the next question. */
export function takeAskFiles(): string[] {
  const { items } = useAskFiles.getState();
  if (!items.length) return [];
  useAskFiles.setState({ items: [] });
  return items.map((i) => i.path);
}
