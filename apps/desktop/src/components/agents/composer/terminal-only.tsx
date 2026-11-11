"use client";

import { api } from "@/lib/bridge";

/** A command only the agent's own terminal can run: open it there, or copy it. */
export function TerminalOnly({ id, command, onError }: { id: string; command: string; onError: (e: string) => void }) {
  return (
    <div className="ak-chips">
      <span className="ak-note">
        Terminal only: <code className="mono">{command}</code>
      </span>
      <button
        type="button"
        className="ak-chip chip"
        onClick={() => void api.agentTerminal(id).catch((e) => onError(String(e)))}
      >
        Open in terminal
      </button>
      <button
        type="button"
        className="ak-chip chip"
        onClick={() => void navigator.clipboard.writeText(command).catch((e) => onError(String(e)))}
      >
        Copy command
      </button>
    </div>
  );
}
