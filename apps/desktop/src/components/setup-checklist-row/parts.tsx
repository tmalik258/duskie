"use client";

// Small pieces of a setup row: labels, buttons, the status mark and the command line.

import type { ReactNode } from "react";
import { useCopy } from "@/lib/hooks";
import { Tip } from "../tip";

export const TAB_LABELS: Record<string, string> = {
  ai: "AI",
  browser: "Browser",
  general: "General",
  search: "Search",
  today: "Today",
  voice: "Voice",
  connections: "Apps",
  privacy: "Privacy",
};

export const ONE_CLICK = new Set([
  "claude_hooks",
  "claude_mcp",
  "codex_notify",
  "codex_mcp",
  "browser",
  "code_folders",
  "search_folders",
  "voice",
  "composio",
]);

export function oneClickLabel(id: string): string {
  if (id === "claude_hooks" || id === "claude_mcp" || id === "codex_notify" || id === "codex_mcp") return "Add for me";
  if (id === "composio") return "Connect";
  return "Set up";
}

export function Code({ text }: { text: string }) {
  return (
    <Tip label={text} className="block min-w-0 max-w-full">
      <code className="block truncate rounded-lg bg-black/30 px-2.5 py-1.5 font-mono text-[11px] text-white/80 select-all">
        {text}
      </code>
    </Tip>
  );
}

export function SmallButton({
  children,
  onClick,
  disabled,
  primary,
}: {
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  primary?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`chip inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-medium disabled:opacity-50 ${
        primary ? "bg-white text-black hover:bg-white/90" : "bg-white/12 text-white/90 hover:bg-white/20"
      }`}
    >
      {children}
    </button>
  );
}

/** Tiny ring for Check again / other short waits. */
export function SetupSpinner({ className = "" }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={`size-3 shrink-0 animate-spin rounded-full border border-current border-r-transparent ${className}`}
    />
  );
}

/** One status circle for rows and the folded "ready" bar, checking pulses. */
export function SetupStatusMark({ checking, done }: { checking: boolean; done: boolean }) {
  return (
    <span
      role="img"
      aria-label={checking ? "Checking" : done ? "Done" : "Not done"}
      className={`grid size-[18px] shrink-0 place-items-center rounded-full text-[10px] font-bold transition-colors duration-300 ${
        checking ? "animate-pulse bg-white/15" : done ? "bg-[#30d158] text-black" : "ring-1 ring-white/30 ring-inset"
      }`}
    >
      {!checking && done ? "✓" : ""}
    </span>
  );
}

export function CopyCommand({ text }: { text: string }) {
  const { copied, copy } = useCopy(text);
  return <SmallButton onClick={copy}>{copied ? "Copied" : "Copy"}</SmallButton>;
}
