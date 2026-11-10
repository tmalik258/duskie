"use client";

// Each agent's mark: its letter and colour, or its logo.

/** Letter and colour for each agent in the picker. */
export const AGENT_MARKS: Record<string, [string, string]> = {
  claude_code: ["C", "#d97757"],
  codex: ["X", "#10a37f"],
  copilot: ["G", "#8957e5"],
  cursor: ["R", "#9aa0a6"],
  local: ["L", "#5e9cff"],
};

/** Picture marks when the letter chip is not enough. */
export const AGENT_IMAGES: Record<string, string> = {
  claude_code: "/agents/claude-code.png",
  codex: "/agents/codex.svg",
  cursor: "/agents/cursor.png",
  local: "/agents/ollama.png",
};

const MARK_BY_NAME: Record<string, string> = {
  "Claude Code": "claude_code",
  Codex: "codex",
  "GitHub Copilot": "copilot",
  Cursor: "cursor",
  Local: "local",
};

/** Normalize a display name or id to the AGENT_MARKS key. */
export function agentMarkId(agent: string): string {
  return MARK_BY_NAME[agent] ?? agent.toLowerCase().replace(/\s+/g, "_");
}

/** Letter and colour from a session's agent display name. */
export const markFor = (agent: string): [string, string] => AGENT_MARKS[agentMarkId(agent)] ?? ["L", "#8e8e93"];

/** Agent chip: Clawd / Codex art when we have it, else letter + colour. */
export function AgentMark({ agent, sm, className = "" }: { agent: string; sm?: boolean; className?: string }) {
  const id = agentMarkId(agent);
  const image = AGENT_IMAGES[id];
  const [letter, color] = markFor(agent);
  const cls = `ak-mark${sm ? " sm" : ""}${image ? " ak-mark-pic" : ""} ${className}`.trim();
  if (image) {
    return (
      <span className={cls} aria-hidden="true">
        {/* public/ asset; Next Image is unnecessary for a tiny mark */}
        <img src={image} alt="" draggable={false} />
      </span>
    );
  }
  return (
    <span className={cls} style={{ background: color }} aria-hidden="true">
      {letter}
    </span>
  );
}
