// Talks to the Rust core through Tauri. Outside Tauri (plain `pnpm web` in a
// browser) it falls back to an in-memory mock so the UI can be developed and
// previewed without the desktop shell.

import { agentApi } from "./bridge/agent-api";
import { appApi } from "./bridge/app-api";
import { toolsApi } from "./bridge/tools-api";

export { EVENTS, type EventPayloads } from "./bridge/events";
export { isTauri, listen } from "./bridge/invoke";
export type { DiskGroup, RouterModel } from "./bridge/shapes";

export const api = { ...appApi, ...agentApi, ...toolsApi };
