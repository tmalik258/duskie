"use client";

// A small dropdown for the Git bar. It sits under its trigger (the parent
// `.gpop`), closes on an outside press or Esc. `data-gmenu` lets the dock know
// a menu is open, so the first Esc closes the menu and not the whole dock.

import { type ReactNode, useEffect, useRef } from "react";

export function GitMenu({
  onClose,
  right = false,
  label,
  children,
}: {
  onClose: () => void;
  right?: boolean;
  label: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const host = ref.current?.parentElement;
    const down = (e: PointerEvent) => {
      if (e.target instanceof Node && !host?.contains(e.target)) onClose();
    };
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("pointerdown", down);
    window.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("pointerdown", down);
      window.removeEventListener("keydown", key);
    };
  }, [onClose]);
  return (
    <div ref={ref} className={`menu gmenu${right ? " right" : ""}`} role="menu" aria-label={label} data-gmenu="">
      {children}
    </div>
  );
}
