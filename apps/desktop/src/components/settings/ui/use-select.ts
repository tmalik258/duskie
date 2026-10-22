"use client";

// A Select's state: the rows shown, the highlight, and where the menu opens
// (floated over the island, or in place, up or down by the room there is).

import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { setOverlayHit, useDuskie } from "@/lib/store";
import { type Row, toRow } from "./row";
import type { SelectOption } from "./switch";

export function useSelect({
  value,
  options,
  onChange,
  group,
  currentLabel,
  overlay,
  searchable,
  menuWidth,
}: {
  value: string;
  options: SelectOption[];
  onChange: (v: string) => void;
  group?: string;
  currentLabel?: string;
  overlay: boolean;
  searchable?: boolean;
  menuWidth?: number;
}) {
  const rows = options.map(toRow);
  // Keep an unknown current value visible, but never invent a second row that
  // matches an existing option (empty/"Default" aliases, same label).
  const list: Row[] = (() => {
    if (rows.some((r) => r.value === value)) return rows;
    const labelFor = value || "Default";
    if (rows.some((r) => r.value === "" || r.label.toLowerCase() === labelFor.toLowerCase())) return rows;
    return [{ value, label: labelFor }, ...rows];
  })();
  const current = currentLabel ?? list.find((r) => r.value === value)?.label ?? (value || "Default");
  const islandColor = useDuskie((s) => s.settings.islandColor);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const shown = q
    ? list.filter((r) => r.alwaysVisible || `${r.label} ${r.sub ?? ""} ${r.value}`.toLowerCase().includes(q))
    : list;
  const [active, setActive] = useState(() =>
    Math.max(
      0,
      list.findIndex((r) => r.value === value),
    ),
  );
  const root = useRef<HTMLDivElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const listId = useId();
  const rich = list.some((r) => r.sub || r.icon || r.image);
  // Opens upward when the panel has no room below the chip.
  const [up, setUp] = useState(false);
  const [float, setFloat] = useState<{ left: number; top: number; width: number; above: boolean } | null>(null);

  const menuChrome = (group ? 30 : 0) + (searchable ? 44 : 0) + 16;
  const placeOverlay = () => {
    const el = root.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const want = Math.min(288, Math.max(shown.length, 1) * (rich ? 44 : 32) + menuChrome);
    // Prefer above when there is not enough room below. The island window is
    // short; opening down near the bottom clips the menu off-screen.
    const spaceBelow = window.innerHeight - r.bottom;
    const spaceAbove = r.top;
    const above = spaceBelow < want && spaceAbove >= spaceBelow;
    // Don't shrink to a short chip ("Male 3") when labels are longer.
    const width = menuWidth ?? Math.min(296, Math.max(rich ? 220 : 200, r.width));
    const left = Math.min(Math.max(8, r.left), window.innerWidth - width - 8);
    const top = above ? r.top - 4 : r.bottom + 4;
    setUp(above);
    setFloat((prev) =>
      prev && prev.left === left && prev.top === top && prev.width === width && prev.above === above
        ? prev
        : { left, top, width, above },
    );
    // Expand the island's clickable area so the menu is not click-through.
    setOverlayHit({
      x: left,
      y: above ? top - want : top,
      width,
      height: want,
    });
  };

  // biome-ignore lint/correctness/useExhaustiveDependencies: list is rebuilt every render; reseat from value when opened
  useEffect(() => {
    if (!open) {
      setFloat(null);
      setQuery("");
      if (overlay) setOverlayHit(null);
      return;
    }
    const idx = shown.findIndex((r) => r.value === value);
    setActive(Math.max(0, idx));
    const el = root.current;
    if (el && overlay) {
      placeOverlay();
    } else if (el) {
      let box: Element | null = el.parentElement;
      while (box && box !== document.body && getComputedStyle(box).overflowY === "visible") box = box.parentElement;
      const limit = box && box !== document.body ? box.getBoundingClientRect().bottom : window.innerHeight;
      const want = Math.min(288, Math.max(shown.length, 1) * (rich ? 44 : 32) + menuChrome);
      const r = el.getBoundingClientRect();
      const spaceBelow = limit - r.bottom;
      const spaceAbove = r.top - (box && box !== document.body ? box.getBoundingClientRect().top : 0);
      setUp(spaceBelow < want && spaceAbove >= spaceBelow);
    }
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!root.current?.contains(t) && !menu.current?.contains(t)) setOpen(false);
    };
    const onScroll = (e: Event) => {
      // Scrolling the menu itself must not re-place it (jitters at the edges).
      if (e.target instanceof Node && menu.current?.contains(e.target)) return;
      if (overlay) placeOverlay();
      else setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    if (overlay) {
      window.addEventListener("resize", placeOverlay);
      window.addEventListener("scroll", onScroll, true);
    }
    return () => {
      document.removeEventListener("mousedown", onDoc);
      window.removeEventListener("resize", placeOverlay);
      window.removeEventListener("scroll", onScroll, true);
      if (overlay) setOverlayHit(null);
    };
  }, [open, value, overlay]);

  useEffect(() => {
    if (!open || !searchable) return;
    requestAnimationFrame(() => searchRef.current?.focus({ preventScroll: true }));
  }, [open, searchable]);

  // Keep the highlight on a visible row while filtering.
  useEffect(() => {
    if (!open) return;
    setActive((i) => (shown.length === 0 ? 0 : Math.min(i, shown.length - 1)));
  }, [open, shown.length]);

  // Prefer the painted menu box once it exists (estimated height can be high).
  // biome-ignore lint/correctness/useExhaustiveDependencies: shown.length and query resize the menu, so they re-measure it
  useLayoutEffect(() => {
    if (!open || !overlay || !float) return;
    const m = menu.current;
    if (!m) return;
    const r = m.getBoundingClientRect();
    setOverlayHit({ x: r.left, y: r.top, width: r.width, height: r.height });
  }, [open, overlay, float, shown.length, query]);

  const pick = (v: string) => {
    onChange(v);
    setOpen(false);
  };

  const move = (dir: 1 | -1) => {
    if (shown.length === 0) return;
    setActive((i) => (i + dir + shown.length) % shown.length);
  };
  return {
    list,
    current,
    islandColor,
    open,
    setOpen,
    query,
    setQuery,
    q,
    shown,
    active,
    setActive,
    root,
    menu,
    searchRef,
    listId,
    rich,
    up,
    float,
    pick,
    move,
  };
}
