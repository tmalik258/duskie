"use client";

import { LEVELS } from "./levels";

/** The thinking popover: On/Off for local models, levels for the rest. */
export function ThinkingBody({
  local,
  effort,
  shown,
  onEffort,
  close,
}: {
  local: boolean;
  effort: string | null | undefined;
  shown: string | null | undefined;
  onEffort: (e: string | null) => void;
  close: () => void;
}) {
  const level = LEVELS.find(([v]) => v === shown);
  return local ? (
    <>
      <div className="ak-pop-h">
        <span>Thinking</span>
      </div>
      <fieldset className="ak-tseg" aria-label="Thinking">
        {[
          ["", "On"],
          ["off", "Off"],
        ].map(([v, l]) => (
          <button
            key={v}
            type="button"
            aria-pressed={(effort ?? "") === v}
            onClick={() => {
              onEffort(v || null);
              close();
            }}
          >
            {l}
          </button>
        ))}
      </fieldset>
      <p className="ak-pop-m">For models that think. Off answers faster.</p>
    </>
  ) : (
    <>
      <div className="ak-pop-h">
        <span>How hard it thinks</span>
        <span className="ak-dots" aria-hidden="true">
          {LEVELS.map(([v], i) => (
            <i key={v} className="ak-dot" data-on={level ? i <= LEVELS.indexOf(level) : false} />
          ))}
        </span>
      </div>
      <fieldset className="ak-tseg" aria-label="How hard it thinks">
        {LEVELS.map(([v, l]) => (
          <button key={v} type="button" aria-pressed={shown === v} onClick={() => onEffort(v)}>
            {l}
          </button>
        ))}
      </fieldset>
      <p className="ak-pop-m">{level?.[2]}</p>
    </>
  );
}
