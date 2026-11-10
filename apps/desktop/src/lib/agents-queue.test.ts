import { describe, expect, it, vi } from "vitest";

const agentStart = vi.fn();
vi.mock("./bridge", () => ({ api: { agentStart } }));

const { cancelQueued, SLOTS, startSession, useAgents } = await import("./agents");

describe("agent queue", () => {
  it("queues a new agent when every slot is busy, and can drop it", async () => {
    const busy = Array.from({ length: SLOTS }, (_, i) => ({ id: `s${i}`, status: "working" }));
    useAgents.setState({ sessions: busy as never, queued: [] });
    const id = await startSession("claude_code", "/repo", "Fix the build", "edit");
    expect(agentStart).not.toHaveBeenCalled();
    expect(useAgents.getState().queued.map((q) => q.prompt)).toEqual(["Fix the build"]);
    cancelQueued(id);
    expect(useAgents.getState().queued).toEqual([]);
  });
});
