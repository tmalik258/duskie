// Agent sessions in the island: Claude Code and Codex working in a project.
// Rust streams each step as `agent://event`; this keeps one timeline per
// session for the Agents tab.

/** A 1440p screen or bigger fits three board tiles across. */
export const wideScreen = () => typeof window !== "undefined" && window.screen.height >= 1440;

export * from "./agents/hand-off-session";
export * from "./agents/on-event";
export * from "./agents/run-session";
export * from "./agents/session";
export * from "./agents/session-controls";
export * from "./agents/session-view";
export * from "./agents/timeline";
