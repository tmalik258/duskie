// The line under Ask: no AI yet, the Alt key list, or an early-sessions hint.

import { SetupSpinner } from "../../setup-checklist-row";
import type { Item } from "./item";

/** The "Hold Alt" hint shows in the first five sessions only. */
const EARLY_SESSIONS = (() => {
  try {
    const n = Number(localStorage.getItem("sk-sessions") ?? "0") + 1;
    localStorage.setItem("sk-sessions", String(n));
    return n <= 5;
  } catch {
    return true;
  }
})();

export function AskFooter(p: {
  noAi: boolean;
  checking: boolean;
  localOnly: boolean;
  alt: boolean;
  item: Item | undefined;
  asking: boolean;
  showClips: boolean;
  showHits: boolean;
  inHistory: boolean;
  inChat: boolean;
  agent: string | null;
  hearing: boolean;
  streaming: boolean;
}) {
  if (p.noAi) {
    return (
      <div className="ak-foot items-center">
        {p.checking ? (
          <SetupSpinner className="text-white/62" />
        ) : (
          <span className="size-1.5 self-center rounded-full bg-[#ffd60a]" aria-hidden="true" />
        )}
        <span className="truncate" aria-live="polite">
          {p.checking ? "Checking AI…" : p.localOnly ? "No local model running" : "No AI set up yet. See Settings > AI"}
        </span>
      </div>
    );
  }
  if (p.alt) {
    return (
      <div className="ak-foot">
        <span>
          <kbd>Enter</kbd>{" "}
          {p.item?.ctrlRun
            ? "open"
            : p.asking
              ? "ask"
              : p.showClips
                ? "copy"
                : p.showHits || p.inHistory
                  ? "open"
                  : "run"}
        </span>
        {p.item?.ctrlRun ? (
          <span>
            <kbd>Ctrl Enter</kbd> {p.item.ctrlHint ?? "open"}
          </span>
        ) : (
          p.agent &&
          (p.asking || p.inChat) && (
            <span>
              <kbd>Ctrl Enter</kbd> continue in {p.agent}
            </span>
          )
        )}
        <span>
          <kbd>Ctrl Tab</kbd> switch tab
        </span>
        <span>
          <kbd>Esc</kbd> {p.hearing ? "stop mic" : p.streaming ? "stop" : p.inChat ? "new chat" : "close"}
        </span>
        {p.inChat && (
          <span>
            <kbd>Ctrl N</kbd> new chat
          </span>
        )}
      </div>
    );
  }
  // Only where you are about to type, for your first few sessions.
  if (!p.inChat && !p.asking && !p.inHistory && EARLY_SESSIONS) {
    return (
      <div className="ak-foot">
        <span>
          Hold <kbd>Alt</kbd> for shortcuts · <kbd>/</kbd> for all commands
        </span>
      </div>
    );
  }
  return null;
}
