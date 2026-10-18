"use client";

// One / Board layout toggle for the Agents tab, shown in the panel tab row.

import { setLayout, useAgents } from "@/lib/agents";
import { KeyHint } from "./ask/parts";
import { Tip } from "./Tip";

export function LayoutSwitch({ alt = false }: { alt?: boolean }) {
  const layout = useAgents((s) => s.layout);
  return (
    <fieldset aria-label="Layout" className="ak-lay ak-seg border-0">
      {(
        [
          ["one", "One", "Alt O"],
          ["board", "Board", "Alt B"],
        ] as const
      ).map(([id, label, key]) => (
        <Tip key={id} label={`${label} (${key})`}>
          <button
            type="button"
            aria-pressed={layout === id}
            aria-label={label}
            onClick={() => setLayout(id)}
            className="chip relative"
          >
            <svg viewBox="0 0 16 16" aria-hidden="true" className="size-3.5">
              {id === "one" ? (
                <rect x="3" y="3" width="10" height="10" rx="2" fill="none" stroke="currentColor" strokeWidth="1.4" />
              ) : (
                <path
                  d="M3 3h4v4H3zM9 3h4v4H9zM3 9h4v4H3zM9 9h4v4H9z"
                  fill="currentColor"
                  stroke="currentColor"
                  strokeWidth="0.6"
                  strokeLinejoin="round"
                />
              )}
            </svg>
            <KeyHint show={alt}>{key}</KeyHint>
          </button>
        </Tip>
      ))}
    </fieldset>
  );
}
