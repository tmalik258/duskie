"use client";

// Keys that work wherever focus is in Ask: Ctrl Tab, Ctrl N, Ctrl G, the Alt
// shortcuts and Esc. What they act on changes every render, so they read it
// from refs the panel refreshes.

import { type RefObject, useEffect, useRef } from "react";
import { openGit } from "@/lib/agents";

export function useAskKeys(inputRef: RefObject<HTMLInputElement | null>) {
  const altKeys = useRef<Record<string, (back?: boolean) => void>>({});
  const newChatRef = useRef<() => void>(() => undefined);
  const askTabRef = useRef(false);
  const escRef = useRef<() => void>(() => undefined);
  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      // Ctrl Tab / Ctrl Shift Tab move between Ask, Agents and History.
      if (e.ctrlKey && e.key === "Tab") {
        e.preventDefault();
        altKeys.current.tab?.(e.shiftKey);
        return;
      }
      // Ctrl/Cmd N on Ask: new chat without aborting a stream. Agents keeps Ctrl N.
      if (askTabRef.current && (e.ctrlKey || e.metaKey) && !e.altKey && e.key.toLowerCase() === "n" && !e.repeat) {
        e.preventDefault();
        newChatRef.current();
        return;
      }
      // Ctrl G: the Git dock for the repo with changes, on the Repos tab.
      if ((e.ctrlKey || e.metaKey) && !e.altKey && e.key.toLowerCase() === "g" && !e.repeat) {
        e.preventDefault();
        openGit();
        return;
      }
      if (!e.altKey || e.ctrlKey || e.metaKey || e.repeat) return;
      const run = altKeys.current[e.key.toLowerCase()];
      if (!run) return;
      e.preventDefault();
      run();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  // Esc works wherever focus is in Ask (after clicking a button or chip);
  // the input handles it itself.
  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key !== "Escape" || e.repeat || e.defaultPrevented || e.target === inputRef.current) return;
      e.preventDefault();
      escRef.current();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [inputRef]);
  return { altKeys, newChatRef, askTabRef, escRef };
}
