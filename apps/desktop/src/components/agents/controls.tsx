"use client";

// Model, thinking and usage live in the chat box, under what you type: the
// same place for a new session, a running one and the board. Each is a chip
// that opens a small popover above it, so no slash commands are needed.

import type { CSSProperties, ReactNode } from "react";
import { type Session, seenUsage, seenWindows } from "@/lib/agents";
import { Select, type SelectOption } from "../settings/ui";
import {
  ABOUT,
  Brain,
  Caret,
  DEFAULT_EFFORT,
  defaultModel,
  idOf,
  LEVELS,
  markOf,
  modelsFor,
  Pop,
} from "./controls/levels";
import { windowName } from "./controls/mode-chip";
import { UsageBody } from "./controls/usage-body";
import { AGENT_IMAGES } from "./marks";

export function ChatControls({
  agent,
  model,
  effort,
  onModel,
  onEffort,
  usage,
  limit,
  onCompact,
  keys,
  localModel,
  panel,
  onRefresh,
  lead,
  tail,
}: {
  agent: string;
  model: string | null | undefined;
  effort: string | null | undefined;
  onModel: (m: string | null) => void;
  onEffort: (e: string | null) => void;
  usage?: Session["usage"];
  limit?: Session["limit"];
  onCompact?: () => void;
  /** The key hint at the end ("Enter send"). */
  keys?: string;
  /** For Local: the Ollama model it runs. */
  localModel?: string;
  panel?: { name: string; at: number };
  onRefresh?: () => void;
  /** Shown before the model chip (the mode chip). */
  lead?: ReactNode;
  /** Shown at the end of the bar, in place of the usage chip (note and send). */
  tail?: ReactNode;
}) {
  const models = modelsFor(agent);
  const [mark, color] = markOf(agent);
  const local = idOf(agent) === "local";
  const shownModel = model ?? defaultModel(agent);
  const shownEffort = local ? effort : (effort ?? DEFAULT_EFFORT);
  const level = LEVELS.find(([v]) => v === shownEffort);

  // Plan windows: this session's warning plus every window Duskie has seen.
  const now = Date.now();
  const byWindow = new Map<string, { used: number; window: string; resetsAt: number | null; at: number }>();
  for (const u of seenWindows(agent)) {
    byWindow.set(u.window, u);
  }
  if (limit && limit.used !== null) {
    byWindow.set(limit.window, {
      used: limit.used,
      window: limit.window,
      resetsAt: limit.resetsAt,
      at: now,
    });
  }
  const plans = [...byWindow.values()].sort((a, b) => {
    const rank = (w: string) => (w === "five_hour" ? 0 : w.startsWith("seven_day") ? 1 : 2);
    return rank(a.window) - rank(b.window);
  });
  const top = seenUsage(agent);
  const planPct = top ? Math.round(top.used <= 1 ? top.used * 100 : top.used) : null;
  const ctxPct = usage && usage.window > 0 ? Math.round(Math.min(1, usage.used / usage.window) * 100) : null;
  const ringPct = ctxPct ?? planPct ?? 0;
  const usageText = [
    ctxPct !== null ? `${ctxPct}% context` : null,
    top && planPct !== null ? `${planPct}% ${windowName(top.window).toLowerCase()}` : null,
  ]
    .filter(Boolean)
    .join(" \u00b7 ");

  const image = AGENT_IMAGES[idOf(agent)];
  const modelOptions: SelectOption[] = [
    ...models.map(([v, l]) => ({
      value: v,
      label: l,
      sub: ABOUT[v] ? `${ABOUT[v][0]} \u00b7 ${ABOUT[v][1]}` : undefined,
      icon: image ? undefined : mark,
      image,
      color,
    })),
  ];
  const modelName = models.find(([v]) => v === shownModel)?.[1] ?? models[0]?.[1] ?? "Model";

  return (
    <div className="ak-ctl">
      {lead}
      {panel?.name === "model" && (
        <Pop label="Choose model" requested={panel.at} chip="Choose model">
          {(close) => (
            <>
              {models.map(([value, label]) => (
                <button
                  type="button"
                  className="chip ak-pop-btn"
                  key={value}
                  onClick={() => {
                    onModel(value);
                    close();
                  }}
                >
                  {label}
                </button>
              ))}
            </>
          )}
        </Pop>
      )}
      {local ? (
        <span className="ak-cchip">
          <i className="ak-cdot" style={{ background: "#30d158" }} />
          {localModel ?? "Local model"}
        </span>
      ) : (
        models.length > 0 && (
          <span className="ak-cmodel">
            <i className="ak-cdot" style={{ background: color }} aria-hidden="true" />
            <Select
              variant="plain"
              overlay
              label="Model"
              menuWidth={324}
              group={`${agent} models, from your next message`}
              current={modelName}
              value={shownModel ?? ""}
              onChange={(v) => onModel(v)}
              options={modelOptions}
            />
          </span>
        )
      )}
      {(models.length > 0 || local) && (
        <Pop
          label="Thinking"
          requested={panel?.name === "effort" ? panel.at : undefined}
          chip={
            <>
              <Brain />
              {local ? (effort === "off" ? "Off" : "On") : (level?.[1] ?? "Medium")}
              <Caret />
            </>
          }
        >
          {(close) =>
            local ? (
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
                    <button key={v} type="button" aria-pressed={shownEffort === v} onClick={() => onEffort(v)}>
                      {l}
                    </button>
                  ))}
                </fieldset>
                <p className="ak-pop-m">{level?.[2]}</p>
              </>
            )
          }
        </Pop>
      )}
      <span className="flex-1" />
      {!tail && (
        <>
          {local ? (
            <span className="ak-cchip ak-cquiet">
              <svg viewBox="0 0 16 16" aria-hidden="true" className="size-3">
                <rect
                  x="3.5"
                  y="7"
                  width="9"
                  height="6.5"
                  rx="1.5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.3"
                />
                <path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2" fill="none" stroke="currentColor" strokeWidth="1.3" />
              </svg>
              On this PC {"\u00b7"} no limits
            </span>
          ) : (
            (usageText || panel?.name === "usage") && (
              <Pop
                label="Usage"
                requested={panel?.name === "usage" ? panel.at : undefined}
                className="ak-cusage"
                chip={
                  <>
                    <span className="ak-ring" aria-hidden="true">
                      <i className="ak-cring" style={{ "--p": ringPct } as CSSProperties} />
                    </span>
                    {usageText || "Usage"}
                  </>
                }
              >
                {() => (
                  <UsageBody
                    usage={usage}
                    ctxPct={ctxPct}
                    plans={plans}
                    now={now}
                    agent={agent}
                    onCompact={onCompact}
                    onRefresh={onRefresh}
                  />
                )}
              </Pop>
            )
          )}
        </>
      )}
      {keys && <span className="ckeys mono">{keys}</span>}
      {tail}
    </div>
  );
}
