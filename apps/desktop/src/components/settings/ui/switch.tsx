"use client";

// Part of ui: Switch, Toggle, Slider, TextField, Field, SelectOption.

import { type ReactNode, useEffect, useState } from "react";
import { Segmented } from "./settings-query";

/** On or off, as the plan's two-part switch. */
export function Switch({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <Segmented
      label={label}
      value={checked ? "on" : "off"}
      options={[
        ["on", "On"],
        ["off", "Off"],
      ]}
      onChange={(v) => {
        if ((v === "on") !== checked) onChange(v === "on");
      }}
    />
  );
}

export function Toggle({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 text-[14px]">
      <div className="min-w-0">
        <p>{label}</p>
        {hint && <p className="text-[12px] text-(--muted)">{hint}</p>}
      </div>
      <Switch checked={checked} onChange={onChange} label={label} />
    </div>
  );
}

export function Slider({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <label className="flex flex-1 items-center justify-between gap-3 text-sm capitalize">
      {label}
      <input
        type="range"
        min={0}
        max={1}
        step={0.05}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-36 accent-(--accent)"
      />
    </label>
  );
}

/** A text input that saves on Enter or when it loses focus, not per key. */
export function TextField({
  value,
  onCommit,
  placeholder,
  className = "",
  mono,
  label,
}: {
  label?: string;
  value: string;
  onCommit: (v: string) => void;
  placeholder?: string;
  className?: string;
  mono?: boolean;
}) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  const commit = () => {
    if (draft !== value) onCommit(draft.trim());
  };
  return (
    <input
      value={draft}
      aria-label={label}
      placeholder={placeholder}
      spellCheck={false}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") commit();
        if (e.key === "Escape") setDraft(value);
      }}
      className={`rounded-md border border-(--border) bg-transparent px-2 py-1 text-[13px] outline-none focus:border-(--accent) ${
        mono ? "font-mono text-[12px]" : ""
      } ${className}`}
    />
  );
}

export function Field({
  label,
  hint,
  children,
  stack = false,
}: {
  label: string;
  hint?: ReactNode;
  children: ReactNode;
  /** Label above the control, for wide forms that crush a side-by-side row. */
  stack?: boolean;
}) {
  if (stack) {
    return (
      <div className="flex flex-col gap-2 text-[13px]">
        <span>
          {label}
          {hint && <span className="mt-0.5 block text-[11.5px] text-(--muted)">{hint}</span>}
        </span>
        {children}
      </div>
    );
  }
  return (
    <div className="flex items-center justify-between gap-4 text-[13px]">
      <span className="min-w-0">
        {label}
        {hint && <span className="block text-[11.5px] text-(--muted)">{hint}</span>}
      </span>
      {children}
    </div>
  );
}

/** One choice in a dropdown: a value and its label, or a richer row with a
 * line under it, a letter icon and a separator before it. */
export type SelectOption =
  | [string, string]
  | {
      value: string;
      label: string;
      sub?: string;
      /** Full text for the Tip (e.g. a complete path). */
      title?: string;
      icon?: string;
      /** Picture instead of the letter icon (e.g. Claude Code's Clawd). */
      image?: string;
      color?: string;
      sepBefore?: boolean;
      /** Keep actions such as Browse available while filtering choices. */
      alwaysVisible?: boolean;
    };
