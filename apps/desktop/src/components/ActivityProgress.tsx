"use client";
import {
  acceptActivities,
  activityLabel,
  dismissLocal,
  INACTIVITY_MS,
  useActivities,
  visibleActivities,
} from "@/lib/activities";
import { api } from "@/lib/bridge";
import { useNow } from "@/lib/hooks";

function needsActions(a: { phase: string; lastProgressAt: number; source: string }, now: number): boolean {
  // Chat/agent rows stay one line while healthy; Check again / Dismiss only
  // when stuck. Other sources keep actions (setup, downloads, updates).
  if (a.source !== "chat" && a.source !== "agent") return true;
  if (a.phase === "failed" || a.phase === "unconfirmed" || a.phase === "awaitingUser") return true;
  if (a.phase === "completed") return true;
  return now - a.lastProgressAt >= INACTIVITY_MS;
}

export function ActivityProgress({ sources }: { sources?: string[] } = {}) {
  const state = useActivities();
  const now = useNow(1000);
  const activities = visibleActivities([...state.activities, ...state.local], now).filter(
    (a) => !sources || sources.includes(a.source),
  );
  return (
    <div className="flex flex-col gap-2">
      {activities.map((a) => {
        const actions = needsActions(a, now);
        return (
          <div key={a.id}>
            <p className="text-[13px] leading-4.5 text-[var(--ink,#f5f5f7)]" role="status">
              {activityLabel(a, now)}
            </p>
            {actions ? (
              <div className="mt-1.5 flex gap-3 text-[12px] text-[var(--i3,rgb(235_235_245/0.55))]">
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
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
