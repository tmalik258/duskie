"use client";

// The settings dropdown: a quiet chip that opens a graphite menu.

import { createPortal } from "react-dom";
import { onChipKey, onMenuKey } from "./select-keys";
import { SelectRow } from "./select-row";
import type { SelectOption } from "./switch";
import { useSelect } from "./use-select";

/** A dropdown in the plan's style: a quiet chip that opens a graphite menu
 * with a tick on the current choice. The current value is kept even if not
 * listed. */
export function Select({
  value,
  options,
  onChange,
  label,
  className = "",
  group,
  current: currentLabel,
  variant = "chip",
  overlay = true,
  searchable,
  menuWidth,
}: {
  value: string;
  options: SelectOption[];
  onChange: (v: string) => void;
  label: string;
  className?: string;
  /** A small heading over the choices ("Open with"). */
  group?: string;
  /** What the closed chip says, when not the option's label. */
  current?: string;
  /** "plain": text with a chevron, for a line of details (Agents). */
  variant?: "chip" | "plain";
  /** Float the menu over the UI (portal to body) so a size-to-content
   * panel does not grow. */
  overlay?: boolean;
  /** A filter field at the top of the menu (long lists). */
  searchable?: boolean;
  /** A wider menu than the chip, for rows with a line under each. */
  menuWidth?: number;
}) {
  const s = useSelect({ value, options, onChange, group, currentLabel, overlay, searchable, menuWidth });
  const { current, islandColor, open, setOpen, query, setQuery, q, shown, active, setActive } = s;
  const { root, menu, searchRef, listId, rich, up, float, pick, move } = s;
  const keys = { open, setOpen, query, setQuery, shown, active, move, pick };

  const menuList = (
    <div
      id={listId}
      role="listbox"
      aria-label={label}
      ref={menu}
      data-color={islandColor}
      onKeyDown={(e) => onMenuKey(keys, e)}
      className={`menu z-30 flex max-h-72 flex-col rounded-[15px] p-1.5 ${
        overlay
          ? `[--menu-origin:${up ? "bottom_left" : "top_left"}]`
          : `absolute ${variant === "plain" ? "left-0" : "right-0"} ${
              up ? "bottom-[calc(100%+4px)] [--menu-origin:bottom_right]" : "top-[calc(100%+4px)]"
            } ${rich ? "w-[296px]" : "w-max min-w-full max-w-64"}`
      }`}
      style={
        overlay && float
          ? {
              position: "fixed",
              left: float.left,
              top: float.above ? undefined : float.top,
              bottom: float.above ? window.innerHeight - float.top : undefined,
              width: float.width,
              zIndex: 100,
            }
          : undefined
      }
    >
      {searchable && (
        <input
          ref={searchRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={`Search ${label.toLowerCase()}…`}
          spellCheck={false}
          aria-label={`Search ${label}`}
          className="mb-1 w-full shrink-0 rounded-[9px] bg-(--surface) px-2.5 py-1.5 text-[12.5px] text-(--text) outline-none placeholder:text-(--muted) focus:bg-(--hover)"
        />
      )}
      {group && (
        <div className="shrink-0 px-[9px] pt-1 pb-[3px] text-[10.5px] tracking-[0.06em] text-(--muted) uppercase">
          {group}
        </div>
      )}
      <div className="island-scroll min-h-0 flex-1 overflow-y-auto">
        {shown.map((r, i) => (
          <SelectRow
            key={r.value || "__default"}
            r={r}
            selected={r.value === value}
            highlighted={i === active}
            filtering={q !== ""}
            onHover={() => setActive(i)}
            onPick={() => pick(r.value)}
          />
        ))}
        {shown.length === 0 && <div className="px-[9px] py-2.5 text-[12.5px] text-(--muted)">No matches</div>}
      </div>
    </div>
  );

  return (
    <div ref={root} className={`relative max-w-56 ${className}`}>
      <button
        type="button"
        aria-label={label}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={(e) => onChipKey(keys, e)}
        className={`chip flex w-full items-center gap-1.5 text-left whitespace-nowrap transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-(--accent) ${
          variant === "plain"
            ? `rounded-md px-1 py-0.5 text-[inherit] ${open ? "bg-(--hover)" : "hover:bg-(--surface)"}`
            : `rounded-[10px] px-2.5 py-1.5 text-[13px] ${open ? "bg-(--hover)" : "bg-(--surface) hover:bg-(--hover)"}`
        }`}
      >
        <span className="min-w-0 flex-1 truncate">{current}</span>
        <svg
          aria-hidden="true"
          viewBox="0 0 10 10"
          className={`size-[9px] shrink-0 transition-[transform,opacity] duration-150 ${open ? "rotate-180 opacity-90" : "opacity-55"}`}
        >
          <path
            d="M2 3.5 5 6.5 8 3.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
      {open && !overlay && menuList}
      {open && overlay && float && createPortal(menuList, document.body)}
    </div>
  );
}
