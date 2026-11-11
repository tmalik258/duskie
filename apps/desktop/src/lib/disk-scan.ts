// Disk scan for Settings → Storage. Lives at module scope so results survive
// leaving Settings or closing the island; in-flight work shows as an activity.

import { create } from "zustand";
import { beginActivity, finishActivity } from "./activities";
import { api, type DiskGroup } from "./bridge";

type DiskScanState = {
  groups: DiskGroup[] | null;
  scanning: boolean;
  error: string | null;
  activityId: string | null;
};

export const useDiskScan = create<DiskScanState>(() => ({
  groups: null,
  scanning: false,
  error: null,
  activityId: null,
}));

/** Starts a scan if one is not already running. Safe to call after unmount. */
export function startDiskScan(): void {
  if (useDiskScan.getState().scanning) return;
  const id = beginActivity("Scanning disk");
  useDiskScan.setState({ scanning: true, error: null, activityId: id });
  void api.activityOpenStart(id, "Scanning disk").catch(() => {});
  void api
    .diskGroups()
    .then(
      (groups) => {
        useDiskScan.setState({ groups, error: null });
        const outcome =
          groups.length === 0 ? "Nothing big found" : `Found ${groups.length} group${groups.length === 1 ? "" : "s"}`;
        finishActivity(id, true, outcome);
        void api.activityOpenFinish(id, true, outcome).catch(() => {});
      },
      (e: unknown) => {
        const message = String(e);
        useDiskScan.setState({ error: message });
        finishActivity(id, false, message);
        void api.activityOpenFinish(id, false, message).catch(() => {});
      },
    )
    .finally(() => {
      useDiskScan.setState({ scanning: false, activityId: null });
    });
}
