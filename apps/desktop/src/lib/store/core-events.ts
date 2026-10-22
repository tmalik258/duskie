// Mascot state, suggestions and action results from the core.

import type { EVENTS, EventPayloads } from "../bridge";
import { moodForSkill, SUGGESTION_MOOD_MS } from "../mood";
import { playCue } from "../sound";
import { cueVolume } from "../sound/snd-sound";
import { helloOncePerDay, MERGE_AT, muteSuggestionCue, reactToResult } from "./chat-turns";
import { openMerge, showDone } from "./done-pill";
import { setMood, useDuskie } from "./duskie-state";

export function onMascotState(t: EventPayloads[typeof EVENTS.mascotState], sounds: boolean) {
  useDuskie.setState({ mascot: t.state });
  const { settings } = useDuskie.getState();
  const suggestionCue = t.cue === "chirp" || t.cue === "pop";
  const shown = useDuskie.getState().suggestion;
  const skipCue = suggestionCue && (muteSuggestionCue(t.state, t.previous) || !!shown?.silent);
  // A compact notification gets the soft version of the cue.
  const soft = suggestionCue && shown?.compact ? 0.45 : 1;
  if (sounds && t.cue && !skipCue) playCue(t.cue, cueVolume(settings, t.cue) * soft, settings.soundKit);
  if (sounds && t.previous === "sleeping" && t.state === "idle") helloOncePerDay();
}

export function onSuggestionNew(suggestion: EventPayloads[typeof EVENTS.suggestionNew]) {
  useDuskie.setState({ suggestion, lastResult: null });
  // The cue already plays for a new suggestion, so the mood is silent.
  const mood = moodForSkill(suggestion.skillId);
  if (mood) setMood(mood, SUGGESTION_MOOD_MS);
}

export function onActionResult(result: EventPayloads[typeof EVENTS.actionResult], sounds: boolean) {
  const merging = result.path?.startsWith(MERGE_AT) ? result.path.slice(MERGE_AT.length) : null;
  const lastResult = merging ? { ...result, path: null } : result;
  useDuskie.setState({ lastResult, running: null });
  if (merging) void openMerge(merging);
  // Done with nothing to undo or open: a compact pill, not a card.
  if (lastResult.ok && !lastResult.undoId && !lastResult.path && !useDuskie.getState().ask) {
    showDone(lastResult.message);
  }
  reactToResult(lastResult, sounds);
}

export function onSuggestionLater(later: EventPayloads[typeof EVENTS.suggestionLater], sounds: boolean) {
  // Everything that was waiting is dealt with: a small celebration.
  const before = useDuskie.getState().later;
  useDuskie.setState({ later });
  if (before >= 2 && later === 0) setMood("celebrate", 3000, sounds ? "tada" : undefined);
}
