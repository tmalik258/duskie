"use client";

// Ask's commands: pause, mute, screen, clipboard, Git, settings, new chat.

import { useMemo } from "react";
import { openGit } from "@/lib/agents";
import { api } from "@/lib/bridge";
import { sendChat, setAsk, updateSettings, useDuskie } from "@/lib/store";
import { isPaused } from "@/lib/types";
import type { Command } from "../starters/command";

export function useAskCommands(
  setClips: (clips: { text: string; ts: string }[]) => void,
  resetChat: () => void,
): Command[] {
  const settings = useDuskie((s) => s.settings);
  const turnCount = useDuskie((s) => s.turns.length);
  const paused = isPaused(settings.pause);
  return useMemo<Command[]>(() => {
    const all: Command[] = [
      paused
        ? { id: "resume", label: "Resume Duskie", icon: "play", run: () => void api.sensorsResume() }
        : { id: "pause15", label: "Pause for 15 minutes", icon: "pause", run: () => void api.sensorsPause(15) },
      ...(paused
        ? []
        : [{ id: "pause60", label: "Pause for 1 hour", icon: "pause" as const, run: () => void api.sensorsPause(60) }]),
      {
        id: "mute",
        label: settings.muted ? "Turn sounds on" : "Mute sounds",
        icon: settings.muted ? "play" : "pause",
        run: () => void updateSettings({ muted: !settings.muted }),
      },
      {
        id: "screen",
        label: "What's on my screen?",
        hint: "Reads the window you were in",
        icon: "screen",
        run: () =>
          sendChat("What's on my screen? Explain it briefly and point out anything I should act on.", { screen: true }),
        stay: true,
      },
      {
        id: "clipboard",
        label: "Clipboard history",
        hint: "Copy something again",
        icon: "undo",
        run: () => {
          void api.clipboardHistory().then(setClips);
        },
        stay: true,
      },
      { id: "git", label: "Open Git", icon: "branch", run: openGit, stay: true },
      { id: "settings", label: "Open settings", icon: "settings", run: () => setAsk({ view: "settings" }), stay: true },
      ...(turnCount
        ? [
            {
              id: "new",
              label: "New chat",
              hint: "Clears this conversation",
              icon: "plus" as const,
              run: resetChat,
              stay: true,
            },
          ]
        : []),
    ];
    return all;
  }, [paused, settings.muted, turnCount, resetChat, setClips]);
}
