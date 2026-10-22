"use client";

// Model, thinking and usage live in the chat box, under what you type: the
// same place for a new session, a running one and the board. Each is a chip
// that opens a small popover above it, so no slash commands are needed.

import type { CSSProperties, ReactNode } from "react";
import type { Session } from "@/lib/agents";
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
import { NoLimits } from "./controls/no-limits";
import { ThinkingBody } from "./controls/thinking-body";
import { UsageBody } from "./controls/usage-body";
import { usageStats } from "./controls/usage-stats";
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

  const { now, plans, ctxPct, ringPct, usageText } = usageStats(agent, usage, limit);

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
          {(close) => (
            <ThinkingBody local={local} effort={effort} shown={shownEffort} onEffort={onEffort} close={close} />
          )}
        </Pop>
      )}
      <span className="flex-1" />
      {!tail && (
        <>
          {local ? (
            <NoLimits />
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
