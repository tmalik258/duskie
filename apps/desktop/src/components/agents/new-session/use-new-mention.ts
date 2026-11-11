"use client";

// @ files in the new-session box, listed from the picked project folder.

import { type KeyboardEvent, useRef, useState } from "react";
import { api } from "@/lib/bridge";
import { dropMention } from "../../attach/context";
import { useMentionFiles } from "../composer/use-mention-files";
import { usePopPlace } from "../composer/use-pop-place";

export function useNewMention(
  prompt: string,
  setPrompt: (t: string) => void,
  path: string | null,
  onPick: (f: string) => void,
) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [sel, setSel] = useState(0);
  const { files } = useMentionFiles(prompt, path ? (q) => api.projectFiles(path, q) : null, path ?? "");
  const { float, popRef } = usePopPlace(wrapRef, files.length, prompt);
  const at = Math.min(sel, Math.max(files.length - 1, 0));
  const pickFile = (f: string) => {
    setPrompt(dropMention(prompt));
    onPick(f);
    setSel(0);
  };
  /** Handles the list keys; true when the key was used. */
  const onKey = (e: KeyboardEvent) => {
    if (!files.length) return false;
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      setSel((at + (e.key === "ArrowDown" ? 1 : -1) + files.length) % files.length);
    } else if (e.key === "Enter" || e.key === "Tab") {
      if (files[at]) pickFile(files[at]);
    } else if (e.key === "Escape") {
      setPrompt(prompt.replace(/(^|\s)@[^\s@]*$/, "$1"));
    } else return false;
    e.preventDefault();
    e.stopPropagation();
    return true;
  };
  return { wrapRef, popRef, float, files, at, setSel, pickFile, onKey };
}
