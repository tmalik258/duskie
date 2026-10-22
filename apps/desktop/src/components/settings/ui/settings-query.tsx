"use client";

// Part of ui: SettingsQuery, matches, Section, Button, Segmented.

import { motion, useReducedMotion } from "motion/react";
import { createContext, type ReactNode, useContext, useState } from "react";
import { EASE_OUT_STRONG } from "@/lib/ui-motion";

/** The settings search text; empty shows everything. */
export const SettingsQuery = createContext("");

export function matches(query: string, ...texts: (string | undefined)[]) {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  const hay = texts.filter(Boolean).join(" ").toLowerCase();
  return words.every((w) => hay.includes(w));
}

export function Section({
  title,
  hint,
  keywords,
  collapsible,
  summary,
  children,
}: {
  title: string;
  hint?: string;
  /** Extra words people might search for, e.g. "hotkey keyboard". */
  keywords?: string;
  /** Shown as one row that opens on tap; searching opens it. */
  collapsible?: boolean;
  /** One line under a collapsed title, e.g. the current value. */
  summary?: string;
  children: ReactNode;
}) {
  const query = useContext(SettingsQuery);
  const [open, setOpen] = useState(false);
  const reducedMotion = useReducedMotion() ?? false;
  if (query && !matches(query, title, hint, keywords)) return null;
  if (collapsible && !open && !query) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-expanded={false}
        className="chip flex items-center gap-3 rounded-2xl bg-(--surface) px-4 py-3 text-left shadow-[0_0_0_0.5px_var(--border)] hover:bg-(--hover)"
      >
        <span className="min-w-0 flex-1">
          <span className="block text-[14px] font-medium text-(--text)">{title}</span>
          {summary && <span className="block truncate text-[12px] text-(--muted)">{summary}</span>}
        </span>
        <svg aria-hidden="true" viewBox="0 0 12 12" className="size-3 shrink-0 -rotate-90 text-(--muted)">
          <path
            fill="currentColor"
            d="M2.2 4.2a.75.75 0 0 1 1.06 0L6 6.94l2.74-2.74a.75.75 0 1 1 1.06 1.06l-3.27 3.27a.75.75 0 0 1-1.06 0L2.2 5.26a.75.75 0 0 1 0-1.06Z"
          />
        </svg>
      </button>
    );
  }
  return (
    <motion.section
      className="flex flex-col gap-2"
      initial={reducedMotion ? { opacity: 0 } : { opacity: 0, transform: "translateY(8px)" }}
      animate={reducedMotion ? { opacity: 1 } : { opacity: 1, transform: "translateY(0px)" }}
      transition={{ duration: 0.2, ease: EASE_OUT_STRONG }}
    >
      <div className="flex items-center px-4">
        <h2 className="flex-1 text-[13px] font-semibold tracking-[-0.005em] text-(--muted)">{title}</h2>
        {collapsible && !query && (
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="chip text-[12px] text-(--muted) hover:text-(--text)"
          >
            Close
          </button>
        )}
      </div>
      <div className="flex flex-col gap-3.5 rounded-2xl bg-(--surface) p-4 shadow-[0_0_0_0.5px_var(--border),0_1px_2px_rgb(0_0_0/0.04)]">
        {children}
      </div>
      {hint && <p className="px-4 text-[12px] text-(--muted)">{hint}</p>}
    </motion.section>
  );
}

export function Button({
  children,
  onClick,
  disabled,
  small,
  active,
  primary,
  "aria-label": ariaLabel,
}: {
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  small?: boolean;
  active?: boolean;
  primary?: boolean;
  "aria-label"?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      className={`chip shrink-0 rounded-full font-medium transition-[background-color,transform] duration-150 active:scale-[0.96] disabled:opacity-40 disabled:active:scale-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--accent) ${
        primary ? "bg-(--text) text-(--bg) hover:opacity-90" : "bg-(--surface) text-(--text) hover:bg-(--hover)"
      } ${small ? "px-2.5 py-[5px] text-[12px]" : "px-3 py-[7px] text-[13px]"} ${active ? "shadow-[inset_0_0_0_1.5px_var(--accent)]" : ""}`}
    >
      {children}
    </button>
  );
}

/** A few choices side by side, one picked (Off, Ask, Auto): the plan's
 * segmented control, a white pill on the picked one. */
export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
  disabled,
}: {
  value: T;
  options: [T, string][];
  onChange: (v: T) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <fieldset aria-label={label} className="flex shrink-0 gap-0.5 rounded-[10px] bg-(--surface) p-[3px]">
      {options.map(([v, text]) => (
        <button
          key={v}
          type="button"
          aria-pressed={value === v}
          disabled={disabled}
          onClick={() => onChange(v)}
          className={`chip rounded-[8px] px-2.5 py-[5px] text-[12.5px] leading-none transition-colors duration-150 disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-(--accent) ${
            value === v ? "bg-(--text) font-semibold text-(--bg)" : "text-(--muted) hover:text-(--text)"
          }`}
        >
          {text}
        </button>
      ))}
    </fieldset>
  );
}
