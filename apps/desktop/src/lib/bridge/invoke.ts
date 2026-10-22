import { mock } from "../mock";
import type { EventPayloads } from "./events";

export function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

let tauriCorePromise: Promise<typeof import("@tauri-apps/api/core")> | null = null;
function getTauriCore() {
  tauriCorePromise ??= import("@tauri-apps/api/core");
  return tauriCorePromise;
}

let tauriEventPromise: Promise<typeof import("@tauri-apps/api/event")> | null = null;
function getTauriEvent() {
  tauriEventPromise ??= import("@tauri-apps/api/event");
  return tauriEventPromise;
}

/** Kept for callers that still invoke it; usually a no-op (window sized at launch). */
export function setIslandWidth(width: number): Promise<void> {
  return invoke<void>("island_width", { width });
}

export async function invoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  if (!isTauri()) return mock.invoke<T>(cmd, args);
  const { invoke } = await getTauriCore();
  return invoke<T>(cmd, args);
}

export async function listen<K extends keyof EventPayloads>(
  event: K,
  handler: (payload: EventPayloads[K]) => void,
): Promise<() => void> {
  if (!isTauri()) return mock.listen(event, handler as (payload: unknown) => void);
  const { listen } = await getTauriEvent();
  return listen<EventPayloads[K]>(event, (e) => handler(e.payload));
}
