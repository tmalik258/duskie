// Which coding agent a chat hands off to (Ctrl Enter), if any is set up.

import { api } from "@/lib/bridge";
import { useCached } from "@/lib/cache";
import type { Agents } from "@/lib/types";

export function useAgentName(): string | null {
  const { data } = useCached<Agents>("agents", api.agentsStatus);
  return data?.handoff ?? null;
}
