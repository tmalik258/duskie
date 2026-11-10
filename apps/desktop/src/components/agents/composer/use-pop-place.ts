"use client";

// Places the command and file list above the composer, outside the island's
// clip, and tells the window that area takes clicks.

import { type RefObject, useLayoutEffect, useRef, useState } from "react";
import { setOverlayHit } from "@/lib/store";

export interface PopPlace {
  left: number;
  bottom: number;
  maxWidth: number;
}

export function usePopPlace(wrapRef: RefObject<HTMLDivElement | null>, count: number, text: string) {
  const [float, setFloat] = useState<PopPlace | null>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const placePop = () => {
    const el = wrapRef.current;
    if (!el || count === 0) {
      setFloat(null);
      setOverlayHit(null);
      return;
    }
    const r = el.getBoundingClientRect();
    // Cap at the composer / viewport; actual width comes from content.
    const maxWidth = Math.max(200, Math.min(r.width, window.innerWidth - 16));
    const left = Math.min(Math.max(8, r.left), window.innerWidth - maxWidth - 8);
    const bottom = window.innerHeight - r.top + 6;
    const want = Math.min(200, 28 + count * 36);
    setFloat((prev) =>
      prev && prev.left === left && prev.bottom === bottom && prev.maxWidth === maxWidth
        ? prev
        : { left, bottom, maxWidth },
    );
    // Estimate until the pop mounts and the next effect measures it.
    setOverlayHit({ x: left, y: Math.max(8, r.top - 6 - want), width: maxWidth, height: want + 8 });
  };
  // biome-ignore lint/correctness/useExhaustiveDependencies: re-place when the typed text or the list changes (the slash and @ lists come from the text)
  useLayoutEffect(() => {
    placePop();
    if (count === 0) return;
    // Composer sits outside the timeline scroller; only the viewport size
    // moves it. Listening to scroll re-placed the pop on every wheel tick
    // inside the menu and fought the list.
    window.addEventListener("resize", placePop);
    return () => {
      window.removeEventListener("resize", placePop);
      setOverlayHit(null);
    };
  }, [count, text]);
  // biome-ignore lint/correctness/useExhaustiveDependencies: measure again when the list length changes
  useLayoutEffect(() => {
    if (!float || !popRef.current) return;
    const r = popRef.current.getBoundingClientRect();
    setOverlayHit({ x: r.left, y: r.top, width: r.width, height: r.height });
  }, [float, count]);
  return { float, popRef };
}
