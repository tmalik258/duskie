// Running things from the island: waits in the background, extension and update installs, opening files.

import { beginActivity, finishActivity, ownsWorking, useActivities } from "../activities";
import { api } from "../bridge";
import type { ExtensionGuide } from "../types";
import { updateBusy } from "../updates";
import { showDone } from "./done-pill";
import { useDuskie } from "./duskie-state";
import { startWaiting, stopWaiting } from "./waiting";

/** The guide's Cancel: stop waiting, and carry on with the welcome if unfinished. */
export function cancelWaiting() {
  stopWaiting();
  const { settings, ask } = useDuskie.getState();
  if (!settings.onboarded && !ask) void api.askResumeWelcome();
}

/**
 * Opens a browser's extensions page and keeps the steps on the island until
 * the extension connects. Shared by the welcome and Settings.
 */
export async function installExtension(id: string, name: string): Promise<ExtensionGuide> {
  const guide = await api.extensionInstall(id);
  const firefox = guide.page.startsWith("about:");
  startWaiting("browser", `the ${name} extension`, {
    resumeTab: "connections",
    target: id,
    steps: guide.steps,
    copies: [
      { label: "Copy extensions address", text: guide.page },
      { label: firefox ? "Copy file path" : "Copy folder path", text: guide.copied },
    ],
    again: () => void installExtension(id, name).catch(() => undefined),
  });
  return guide;
}

/** Wait as a pill only: hover no longer opens the guide; success still finishes normally. */
export function backgroundWaiting() {
  const waiting = useDuskie.getState().waiting;
  if (waiting) useDuskie.setState({ waiting: { ...waiting, minimized: true, background: true } });
}

/** Immediately acknowledges a click; Rust broadcasts progress to every window. */
export async function installUpdate(): Promise<void> {
  if (updateBusy(useDuskie.getState().updateProgress)) return;
  useDuskie.setState({ updateProgress: { phase: "preparing", done: 0, total: null, error: null } });
  try {
    await api.updateInstall();
  } catch (error) {
    const progress = await api.updateProgress().catch(() => null);
    useDuskie.setState({
      updateProgress: progress ?? { phase: "failed", done: 0, total: null, error: String(error) },
    });
    throw error;
  }
}

/**
 * Close Ask, show Opening…, run an open, then Opened… (or an error card).
 * `open` returns false when nothing was opened (caller may show a picker).
 */
let openGeneration = 0;

function mayFinishOpen(generation: number, id: string): boolean {
  const activities = useActivities.getState();
  return (
    generation === openGeneration &&
    ![...activities.activities, ...activities.local].some((a) => a.id !== id && ownsWorking(a))
  );
}

export async function runOpen(open: () => Promise<boolean>, doneMessage: string): Promise<boolean> {
  const generation = ++openGeneration;
  const label = doneMessage.replace(/^Opened\b/i, "Opening");
  const id = beginActivity(label);
  void api.askClose();
  useDuskie.setState({ mascot: "working", running: label });
  try {
    await api.activityOpenStart(id, label).catch(() => {});
    const opened = await open();
    const outcome = opened ? doneMessage : "Nothing opened";
    // Finish on the backend before the done pill so a still-Running sync cannot
    // flash "Opening…" again after the tick.
    finishActivity(id, true, outcome);
    await api.activityOpenFinish(id, true, outcome).catch(() => {});
    if (mayFinishOpen(generation, id)) {
      useDuskie.setState({ running: null, mascot: "idle" });
      if (opened) showDone(outcome);
    }
    return opened;
  } catch (e) {
    finishActivity(id, false, String(e));
    await api.activityOpenFinish(id, false, String(e)).catch(() => {});
    if (mayFinishOpen(generation, id))
      useDuskie.setState({
        running: null,
        mascot: "error",
        lastResult: { ok: false, message: String(e), path: null, auto: false, undoId: null },
      });
    return false;
  } finally {
    if (mayFinishOpen(generation, id) && useDuskie.getState().mascot === "working")
      useDuskie.setState({ running: null, mascot: "idle" });
  }
}
