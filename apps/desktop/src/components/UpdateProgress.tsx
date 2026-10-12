"use client";

import { activityLabel, latestActivity, useActivities } from "@/lib/activities";
import { useNow } from "@/lib/hooks";
import type { UpdateProgress as Progress } from "@/lib/types";
import { updateBusy, updateDetail, updateLabel, updatePercent } from "@/lib/updates";

export function UpdateProgress({ progress }: { progress: Progress }) {
  const activity = useActivities((s) => latestActivity(s.activities, "update"));
  const now = useNow(1000);
  const percent = updatePercent(progress);
  const downloading = progress.phase === "downloading";
  const busy = updateBusy(progress);
  return (
    <div role={busy ? "status" : "alert"} aria-busy={busy} className="min-w-0 text-[13px]">
      <div className="flex items-center gap-2 text-[var(--ink,#f5f5f7)]">
        {busy && (
          <span
            aria-hidden="true"
            className="size-3 shrink-0 animate-spin rounded-full border-2 border-[rgb(255_255_255/0.25)] border-t-[var(--ink,#f5f5f7)] motion-reduce:animate-none"
          />
        )}
        <span>{activity ? activityLabel(activity, now) : updateLabel(progress)}</span>
      </div>
      <p className={`mt-1 break-words text-[12px] ${busy ? "text-[var(--i3,rgb(235_235_245/0.6))]" : "text-red-300"}`}>
        {updateDetail(progress)}
      </p>
      {downloading && (
        <div
          role="progressbar"
          aria-label="Update download"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={percent ?? undefined}
          aria-valuetext={updateDetail(progress)}
          className="mt-2 h-1.5 overflow-hidden rounded-full bg-[rgb(255_255_255/0.12)]"
        >
          <div
            className={`h-full rounded-full bg-[#0a84ff] transition-[width] ${percent === null ? "animate-pulse motion-reduce:animate-none" : ""}`}
            style={{ width: percent === null ? "30%" : `${percent}%` }}
          />
        </div>
      )}
    </div>
  );
}
