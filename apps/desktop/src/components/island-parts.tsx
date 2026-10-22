"use client";

import { latestActivity, useActivities } from "@/lib/activities";
import { api } from "@/lib/bridge";
import { installUpdate, useDuskie } from "@/lib/store";
import type { MascotState, Suggestion } from "@/lib/types";
import { Ic } from "./icon";
import { Glance } from "./island-glance";
import { RoundButton } from "./island-glance/settings-shift-history-button";
import { DETAIL, TITLE } from "./island-layout";
import { NetNoticeCard, SourceLine, UndoButton } from "./island-parts/activity";
import { Options } from "./island-parts/dismiss-fill";
import { MergeCard } from "./merge-card";
import { UpdateProgress } from "./update-progress";

export function ExpandedContent({
  mascot,
  paused,
  suggestion,
}: {
  mascot: MascotState;
  paused: boolean;
  suggestion: Suggestion | null;
}) {
  const activityState = useActivities();
  const result = useDuskie((s) => s.lastResult);
  const running = useDuskie((s) => s.running);
  const netNotice = useDuskie((s) => s.netNotice);
  const merge = useDuskie((s) => s.merge);
  const progress = useDuskie((s) => s.updateProgress);
  const reporting = (mascot === "success" || mascot === "error" || mascot === "working") && !suggestion;
  if (merge && !suggestion) return <MergeCard path={merge.path} />;
  if (netNotice && !suggestion) return <NetNoticeCard notice={netNotice} />;
  if (progress && !suggestion && !latestActivity(activityState.activities, "update")?.dismissed) {
    return (
      <div className="flex flex-col gap-3">
        <UpdateProgress progress={progress} />
        {progress.phase === "failed" && (
          <div className="flex gap-3 text-[13px]">
            <button
              type="button"
              className="chip text-white"
              onClick={() => void installUpdate().catch(() => undefined)}
            >
              Retry update
            </button>
            <button
              type="button"
              className="chip text-white/60"
              onClick={() => useDuskie.setState({ updateProgress: null })}
            >
              Dismiss
            </button>
          </div>
        )}
        <Glance paused={paused} />
      </div>
    );
  }
  // Idle / suggesting / agent working / needs-you: one unified glance (activities are a section).
  if (!suggestion && (mascot === "idle" || mascot === "sleeping" || mascot === "suggesting" || mascot === "working")) {
    return <Glance paused={paused} />;
  }
  // Working names what it is doing; done and error say what happened.
  const detail =
    suggestion?.detail ??
    (mascot === "working" && running
      ? `${running}...`
      : reporting && result
        ? result.message
        : paused && mascot !== "sleeping"
          ? "Sensors are paused."
          : DETAIL[mascot]);
  return (
    <div className="flex flex-col">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          {suggestion?.source && <SourceLine source={suggestion.source} at={suggestion.at} />}
          <p className="font-display text-[15px] leading-5 font-semibold tracking-[-0.015em] text-white">
            {suggestion?.title ?? TITLE[mascot]}
          </p>
          <p
            className={`mt-0.5 ${
              suggestion?.skillId.startsWith("notify.") || (!suggestion && detail.includes("\n"))
                ? "line-clamp-6 whitespace-pre-line"
                : "line-clamp-2"
            } text-[13px] leading-4.5 tracking-[-0.005em] text-[rgb(235_235_245/0.6)]`}
          >
            {detail}
          </p>
        </div>
        {!suggestion && reporting && (result?.path || result?.undoId) ? (
          <div className="flex shrink-0 gap-1.5">
            {result.undoId != null && <UndoButton id={result.undoId} />}
            {result.path && (
              <RoundButton label="Show in folder" onClick={() => void api.revealPath(result.path ?? "")}>
                <Ic name="folder" size={15} />
              </RoundButton>
            )}
          </div>
        ) : null}
      </div>

      {suggestion ? <Options key={suggestion.id} suggestion={suggestion} /> : null}
    </div>
  );
}
