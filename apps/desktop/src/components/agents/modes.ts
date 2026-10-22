// The agent modes, from read-only Plan to Full.

import type { AgentMode } from "@/lib/types";

export const MODES: { id: AgentMode; label: string; note: string }[] = [
  { id: "plan", label: "Plan", note: "Reads and plans, changes nothing" },
  { id: "ask", label: "Ask", note: "Asks before every change" },
  { id: "edit", label: "Edit", note: "Edits files, asks before commands" },
  { id: "debug", label: "Debug", note: "Adds temporary logs, finds the cause, fixes it, then removes the logs" },
  { id: "full", label: "Full", note: "Does everything without asking" },
];

/** Next Plan → Ask → Edit → Debug → Full (wraps). Bound to Ctrl+. in the composer. */
export function nextAgentMode(mode: AgentMode): AgentMode {
  const i = MODES.findIndex((m) => m.id === mode);
  return MODES[(i + 1) % MODES.length].id;
}
