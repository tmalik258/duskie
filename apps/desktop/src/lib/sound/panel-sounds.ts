// Part of sound: usePanelSounds, mascotSound. A soft sound when Ask, Agents,
// Git or Settings opens or closes, and the mascot's own life sounds (a yawn,
// dozing, tape), so the island feels alive.

import { useEffect, useRef } from "react";
import { useAgents } from "../agents";
import { useDuskie } from "../store";
import { uiVolume } from "../store/duskie-state";
import type { SynthSound } from "../synth";
import { playMood } from "./play-mood";

type Panel = "ask" | "agents" | "git" | "settings";

const OPEN: Record<Panel, SynthSound> = {
  ask: "askOpen",
  agents: "agentsOpen",
  git: "gitOpen",
  settings: "settingsOpen",
};
const CLOSE: Record<Panel, SynthSound> = {
  ask: "askClose",
  agents: "agentsClose",
  git: "gitClose",
  settings: "settingsClose",
};

function play(sound: SynthSound) {
  playMood(sound, uiVolume(), useDuskie.getState().settings.soundKit);
}

/** Plays a panel's sound as it opens, and as the last one closes. */
export function usePanelSounds() {
  const view = useDuskie((s) => s.ask?.view ?? null);
  const tab = useAgents((s) => s.tab);
  const git = useAgents((s) => s.dock !== null);
  const panel: Panel | null =
    view === null || view === "welcome"
      ? null
      : view === "settings"
        ? "settings"
        : git || tab === "repos"
          ? "git"
          : tab === "agents"
            ? "agents"
            : "ask";
  const last = useRef<Panel | null>(null);
  useEffect(() => {
    const before = last.current;
    last.current = panel;
    if (before === panel) return;
    if (panel) play(OPEN[panel]);
    else if (before) play(CLOSE[before]);
  }, [panel]);
}

/** The island mascot's life sounds (yawn, doze, head shake, tape). */
export function mascotSound(name: string) {
  play(name as SynthSound);
}
