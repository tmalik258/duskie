// The Settings sidebar: search box and the grouped section links.

import type { RefObject } from "react";
import { Ic } from "../icon";
import { GROUPS, type SettingsTab } from "./settings-tabs";

export function SettingsNav(p: {
  searchRef: RefObject<HTMLInputElement | null>;
  query: string;
  onQuery: (q: string) => void;
  current: SettingsTab | null;
  onPick: (t: SettingsTab) => void;
}) {
  return (
    <nav aria-label="Settings sections" className="st-side">
      <label className="st-search shrink-0">
        <Ic name="search" size={14} />
        <input
          ref={p.searchRef}
          type="search"
          value={p.query}
          onChange={(e) => p.onQuery(e.target.value)}
          placeholder="Search settings"
          aria-label="Search settings"
          spellCheck={false}
        />
        <kbd>/</kbd>
      </label>
      <div className="st-side-links">
        {GROUPS.map((g) => (
          <div key={g.label} className="flex flex-col">
            <p className="st-group">{g.label}</p>
            {g.items.map((i) => (
              <button
                key={i.id}
                type="button"
                className="st-item"
                aria-current={p.current === i.id ? "page" : undefined}
                onMouseDown={(e) => {
                  // Keep the nav from scrolling when the last item is focused.
                  // Focus moved by script from the search box would show
                  // the keyboard ring, so the click is marked as a click.
                  e.preventDefault();
                  (document.activeElement as HTMLElement | null)?.blur();
                  e.currentTarget.focus({ preventScroll: true, focusVisible: false } as FocusOptions);
                }}
                onClick={() => {
                  p.onQuery("");
                  p.onPick(i.id);
                }}
              >
                <span className="inline-flex shrink-0">
                  <Ic name={i.icon} size={15} />
                </span>
                <span className="truncate">{i.label}</span>
              </button>
            ))}
          </div>
        ))}
      </div>
    </nav>
  );
}
