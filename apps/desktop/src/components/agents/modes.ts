// The agent modes, from read-only Plan to Full.

import type { AgentMode } from "@/lib/types";

export const MODES: { id: AgentMode; label: string; note: string }[] = [
  { id: "plan", label: "Plan", note: "Reads and plans, changes nothing" },
  { id: "ask", label: "Ask", note: "Asks before every change" },
  { id: "edit", label: "Edit", note: "Edits files, asks before commands" },
  { id: "debug", label: "Debug", note: "Adds temporary logs, finds the cause, fixes it, then removes the logs" },
  { id: "full", label: "Full", note: "Does everything without asking" },
  { id: "try", label: "Try", note: "Works on a copy. Your code is untouched until you keep it" },
];

/** Next Plan → Ask → Edit → Debug → Full (wraps). Bound to Ctrl+. in the composer. */
export function nextAgentMode(mode: AgentMode, withTry = true): AgentMode {
  const list = withTry ? MODES : MODES.filter((m) => m.id !== "try");
  const i = list.findIndex((m) => m.id === mode);
  return list[(i + 1) % list.length].id;
}
