"use client";

// What a setup row's buttons do: one-click adds, the guided Run, and the
// island's waiting steps while a step finishes outside Duskie.

import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/bridge";
import { friendlyError } from "@/lib/friendly";
import { startWaiting, useDuskie } from "@/lib/store";
import type { SetupItem } from "@/lib/types";

export function useSetupActions(
  item: SetupItem,
  onRun: (id: string) => void,
  onDone: () => void,
  onToggleGuide: (id: string) => void,
) {
  const [busy, setBusy] = useState(false);
  const waiting = useDuskie((s) => s.waiting);
  // App connects (app:notion) highlight the Composio row, that is the island done ring.
  const justDone = useDuskie(
    (s) => s.justDone === item.id || (item.id === "composio" && (s.justDone?.startsWith("app:") ?? false)),
  );
  // When Settings reopens after a step finished, show that step.
  const rowRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (justDone) rowRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [justDone]);
  const [actionError, setActionError] = useState<string | null>(null);

  const runDirect = () => {
    if (item.id === "browser" || item.id === "code_folders" || item.id === "search_folders" || item.id === "voice") {
      onToggleGuide(item.id);
      return;
    }
    setBusy(true);
    setActionError(null);
    const work =
      item.id === "claude_hooks"
        ? api.claudeAddHooks().then(() => undefined)
        : item.id === "claude_mcp"
          ? api.claudeAddMcp().catch(() => api.setupRun("claude_mcp"))
          : item.id === "codex_notify"
            ? api.codexAddNotify().then(() => undefined)
            : item.id === "codex_mcp"
              ? api.codexAddMcp().then(() => undefined)
              : api.composioSignIn();
    const outside = item.id === "composio";
    void work
      .then(() => {
        onDone();
        // Finishing happens in the browser: the island keeps the steps until it connects.
        if (outside)
          startWaiting(item.id, item.title, {
            resumeTab: item.tab ?? "connections",
            steps: ["Composio opened in your browser.", "Sign in and press Allow."],
            again: runDirect,
          });
      })
      .catch((e) => setActionError(friendlyError(e)))
      .finally(() => setBusy(false));
  };
  const run = () => {
    onRun(item.id);
    // The island keeps the steps until setup status flips.
    startWaiting(item.id, item.title, {
      resumeTab: item.tab ?? "home",
      steps: item.opensApp
        ? [`Duskie is starting ${item.title} in the background.`, "This finishes by itself when it is running."]
        : item.opensTerminal
          ? [
              "PowerShell is open. The command is already on the clipboard.",
              "Replace your-key with your API key, paste (Ctrl+V), press Enter.",
              "Come back here. Duskie notices when the key is set. No restart needed.",
            ]
          : [
              `A PowerShell window is running: ${item.action} ${item.title}.`,
              "Leave it open and answer any prompts there.",
              "This finishes by itself when it is ready.",
            ],
      copies: item.command ? [{ label: "Copy the command", text: item.command }] : undefined,
      again: () => onRun(item.id),
      doneLine: item.opensApp ? `All set. ${item.title} is running.` : undefined,
    });
  };
  const isWaiting = waiting?.id === item.id && !item.done;

  const isDirect =
    item.id === "claude_hooks" ||
    item.id === "claude_mcp" ||
    item.id === "codex_notify" ||
    item.id === "codex_mcp" ||
    item.id === "composio";

  return { busy, actionError, runDirect, run, isWaiting, isDirect, justDone, rowRef };
}
