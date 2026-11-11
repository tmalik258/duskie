import { useAgents } from "@/lib/agents";
import { api } from "@/lib/bridge";
import type { BubbleItem } from "../island-bubbles";
import { openBoard } from "../island-voice/tail";
import type { IslandFace } from "./use-island-face";
import type { IslandHover } from "./use-island-hover";
import type { IslandShape } from "./use-island-shape";
import type { IslandStore } from "./use-island-store";
import type { IslandWork } from "./use-island-work";

/** Side bubbles: a split agent, a held suggestion and other live activities. */
export function useBubbles(c: IslandStore & IslandWork & IslandHover & IslandFace & IslandShape) {
  const { splitAgent, working, agentWorking, busy, registryId, liveActivities } = c;
  const { displayedActivity, doneOpen, suggestion, peekId, setPeekId } = c;
  const agentBubble: BubbleItem[] =
    splitAgent && working !== agentWorking
      ? [
          {
            id: `agent-${splitAgent.id}`,
            label: splitAgent.total > 1 ? `${splitAgent.done + 1} of ${splitAgent.total}` : splitAgent.agent,
            ring: { mark: splitAgent.mark, done: splitAgent.done, total: splitAgent.total },
          },
        ]
      : [];
  // Bubbles sit beside any open state, so nothing in flight is hidden by it.
  const sideOpen = busy || !["idle", "quiet-glance", "glance", "activities"].includes(registryId);
  const activityBubble = (a: (typeof liveActivities)[number]): BubbleItem => {
    const frac = a.total && a.transferred != null ? a.transferred / a.total : null;
    return {
      id: a.id,
      label: a.label || a.source,
      icon: ["browser", "file"].includes(a.source) ? "dl" : undefined,
      sub:
        a.phase === "failed"
          ? "Failed"
          : a.phase === "awaitingUser"
            ? "Paused"
            : frac !== null
              ? `${Math.round(frac * 100)}%`
              : a.transferred != null
                ? `${Math.round(a.transferred / 1e6)} MB`
                : "Working",
      progress: a.phase === "failed" ? null : frac,
      tone: a.phase === "failed" ? "err" : undefined,
    };
  };
  // A bubble opens its peek card; an agent's bubble (the split ring, or its
  // live activity "agent:<id>") opens that session, or the board when gone.
  const openBubble = (id: string) => {
    const agentId = id.startsWith("agent-") ? id.slice(6) : id.startsWith("agent:") ? id.slice(6) : null;
    if (agentId === null) return setPeekId((cur) => (cur === id ? null : id));
    if (!useAgents.getState().sessions.some((x) => x.id === agentId)) return openBoard();
    useAgents.setState({ tab: "agents", current: agentId });
    void api.askOpen();
  };
  const peekSuggestion = suggestion && peekId === suggestion.id ? suggestion : null;
  const bubbleItems = [
    ...agentBubble,
    ...(sideOpen && suggestion && registryId !== "suggestion" && registryId !== "suggest-peek"
      ? [{ id: suggestion.id, label: suggestion.title || "Suggestion", sub: suggestion.detail || undefined }]
      : []),
    ...(sideOpen
      ? liveActivities
          .filter((a) => a !== displayedActivity && !doneOpen(a))
          .slice(0, 4)
          .map(activityBubble)
      : []),
  ];

  return { bubbleItems, openBubble, peekSuggestion };
}
