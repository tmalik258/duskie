// Part of types: Activity, ActivitySnapshot, AgentReviewTurn.

import type { FileChange } from "./composio-status";

export interface Activity {
  id: string;
  source: string;
  parentId: string | null;
  label: string;
  phase:
    | "running"
    | "downloading"
    | "verifying"
    | "installing"
    | "awaitingUser"
    | "completed"
    | "failed"
    | "unconfirmed";
  startedAt: number;
  lastProgressAt: number;
  transferred: number | null;
  total: number | null;
  outcome: string | null;
  dismissed: boolean;
  revision: number;
  destination: string | null;
}

export interface ActivitySnapshot {
  revision: number;
  activities: Activity[];
}

export interface AgentReviewTurn {
  id: string;
  entry: number;
  files: FileChange[];
  decisions: Record<string, "accepted" | "rejected">;
  error: string | null;
}
