"use client";

// All agents / One / Board view switch for the Agents tab, shown in the panel tab row.

import { setView, useAgents, viewOf } from "@/lib/agents";
import { KeyHint } from "./ask/parts";
import { Tip } from "./tip";

const VIEWS = [
  ["home", "All agents", "Alt A"],
  ["one", "One agent", "Alt O"],
  ["board", "Board, four at once", "Alt B"],
] as const;

function ViewIcon({ id }: { id: (typeof VIEWS)[number][0] }) {
  if (id === "home")
    return (
      <path d="M3 4h10M3 8h10M3 12h10" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    );
  if (id === "one")
    return <rect x="3" y="3" width="10" height="10" rx="2" fill="none" stroke="currentColor" strokeWidth="1.4" />;
  return (
    <path
      d="M3 3h4v4H3zM9 3h4v4H9zM3 9h4v4H3zM9 9h4v4H9z"
      fill="currentColor"
      stroke="currentColor"
      strokeWidth="0.6"
      strokeLinejoin="round"
    />
  );
}

export function LayoutSwitch({ alt = false }: { alt?: boolean }) {
  const view = useAgents(viewOf);
  return (
    <fieldset aria-label="View" className="ak-lay ak-seg border-0">
      {VIEWS.map(([id, label, key]) => (
        <Tip key={id} label={`${label} (${key})`}>
          <button
            type="button"
            aria-pressed={view === id}
            aria-label={label}
            onClick={() => setView(id)}
            className="chip relative"
          >
            <svg viewBox="0 0 16 16" aria-hidden="true" className="size-3.5">
              <ViewIcon id={id} />
            </svg>
            <KeyHint show={alt}>{key}</KeyHint>
          </button>
        </Tip>
      ))}
    </fieldset>
  );
}
