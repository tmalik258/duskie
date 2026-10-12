"use client";
import { acceptActivities, activityLabel, dismissLocal, useActivities, visibleActivities } from "@/lib/activities";
import { api } from "@/lib/bridge";
import { useNow } from "@/lib/hooks";

export function ActivityProgress({ sources }: { sources?: string[] } = {}) {
  const state = useActivities();
  const now = useNow(1000);
  const activities = visibleActivities([...state.activities, ...state.local], now).filter(
    (a) => !sources || sources.includes(a.source),
  );
  return (
    <div className="flex flex-col gap-3">
      {activities.map((a) => (
        <div key={a.id}>
          <p className="text-[13px] text-[var(--ink,#f5f5f7)]" role="status">
            {activityLabel(a, now)}
          </p>
          <div className="mt-2 flex gap-3 text-[12px] text-[var(--i3,rgb(235_235_245/0.55))]">
            <button
              type="button"
              className="ak-chip chip"
              onClick={() =>
                void api
                  .activityCheck(a.id)
                  .then(acceptActivities)
                  .catch(() => {})
              }
            >
              Check again
            </button>
            <button
              type="button"
              className="ak-chip chip"
              onClick={() => {
                if (a.source === "open") dismissLocal(a.id);
                void api.activityDismiss(a.id).catch(() => {});
              }}
            >
              Dismiss
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
