"use client";

// The conversation: turns, live steps, the streamed answer, retry and handoff.

import { extractChoices, splitOptions } from "@/lib/options";
import { useDuskie } from "@/lib/store";
import { PROVIDER_LABELS, type Turn } from "@/lib/types";
import { MessageText } from "../attach/message-text";
import { AnswerActions } from "./chat/answer-actions";
import { Answer, LiveStep, OfflineChips, TryAnother } from "./chat/retry";
import { AddSkill, modelOf, Steps, seconds, TAG_NAMES, yamlBlock } from "./chat/yaml-block";
import { AnswerOptions } from "./proposals";
import { pendingCount } from "./proposals/pending-count";
import { Proposals } from "./proposals/proposals";
import { FailureCard } from "./states/failure";

export function Chat({ turns }: { turns: Turn[] }) {
  const skillMode = useDuskie((s) => s.chatSkill);
  const ai = useDuskie((s) => s.settings.ai);
  const last = turns.at(-1);
  // A reply that is only chips (a weak model copying its instructions) is no answer.
  const blank = (t: Turn) => !t.streaming && !t.error && !extractChoices(t.content).body.trim();
  const lastChoices =
    last?.role === "assistant" && !last.streaming && !blank(last) ? extractChoices(last.content) : null;
  const options = lastChoices?.options ?? [];
  const multi = lastChoices?.multi ?? false;
  return (
    <div className="ak-body py-0.5">
      {turns.map((t, i) => {
        if (t.role === "user") {
          return (
            // biome-ignore lint/suspicious/noArrayIndexKey: turns only ever append
            <div key={i} className="ak-um ak-in">
              <MessageText text={t.content} />
              {t.screen && (
                <span className="mt-0.5 block text-[11px] text-[rgb(235_235_245/0.62)]">with screenshot</span>
              )}
            </div>
          );
        }
        const isLast = i === turns.length - 1;
        const steps = t.steps ?? [];
        return (
          // biome-ignore lint/suspicious/noArrayIndexKey: turns only ever append
          <div key={i} className="group grid grid-cols-[minmax(0,1fr)] gap-2">
            {steps.length > 0 && !t.streaming && <Steps steps={steps} running={false} tookMs={t.tookMs} />}
            {t.streaming && steps.length > 0 && <Steps steps={steps} running since={t.startedAt} tookMs={t.tookMs} />}
            {t.content ? (
              <div className="ak-ans">
                <Answer text={extractChoices(t.content, t.streaming).body} live={isLast && !!t.streaming} />
              </div>
            ) : t.streaming && steps.length === 0 ? (
              <LiveStep step={t.tool ?? null} since={t.startedAt} />
            ) : null}
            {!t.streaming && t.content && t.sources && t.sources.length > 0 && (
              <span className="ak-src">via {t.sources.join(" and ")}</span>
            )}
            {blank(t) && t.provider && (
              <p className="ak-err" role="alert">
                No answer came back. Ask again, or try another model.
              </p>
            )}
            {!t.streaming && isLast && t.provider && (blank(t) || t.handoff) && !t.error && (
              <TryAnother from={t.provider} />
            )}
            {!t.streaming && !blank(t) && splitOptions(t.content).stats.length > 0 && (
              <div className="ak-stats">
                {splitOptions(t.content).stats.map((st) => (
                  <span key={st.label} className={`ak-stat${st.hot ? " hot" : ""}`}>
                    {st.label}
                    <b>{st.value}</b>
                  </span>
                ))}
              </div>
            )}
            {t.streaming && t.content && t.tool && (
              <p className="ak-status">
                <span className="shimmer-text text-[rgb(235_235_245/0.6)]">{t.tool}...</span>
              </p>
            )}
            {t.error && isLast && !t.streaming ? (
              <FailureCard turn={t} turns={turns} />
            ) : (
              t.error && <p className="ak-err">{t.error}</p>
            )}
            {!t.streaming && t.provider && !t.error && (
              <AnswerActions
                text={splitOptions(t.content).body}
                keys={isLast}
                again={isLast && i > 0}
                think={isLast && i > 0 && t.provider === "local" && !skillMode}
                recipe={isLast && i > 0 && !skillMode ? (turns[i - 1]?.content ?? "") : ""}
                detail={[
                  `${TAG_NAMES[t.provider] ?? PROVIDER_LABELS[t.provider] ?? t.provider}${modelOf(ai, t.provider) ? ` · ${modelOf(ai, t.provider)}` : ""}`,
                  t.firstMs !== undefined ? `first word ${seconds(t.firstMs)}` : "",
                  t.cost !== undefined ? (t.cost < 0.01 ? "under 1¢" : `$${t.cost.toFixed(2)}`) : "",
                ]
                  .filter(Boolean)
                  .join(" · ")}
              />
            )}

            {isLast && !t.streaming && !t.error && t.offline && <OfflineChips />}
            {skillMode && !t.streaming && yamlBlock(t.content) && <AddSkill yaml={yamlBlock(t.content) ?? ""} />}
            {t.proposals && t.proposals.length > 0 && <Proposals items={t.proposals} keys={isLast} />}
            {isLast && options.length > 0 && (
              <AnswerOptions options={options} multi={multi} start={pendingCount(t.proposals)} />
            )}
          </div>
        );
      })}
    </div>
  );
}
