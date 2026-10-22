// Connects the island to the core: event listeners, first load and the network watch.

import { acceptActivities } from "../activities";
import { api, EVENTS, listen } from "../bridge";
import { watchNet } from "../net";
import { playSound } from "../sound/play-mood";
import { preloadSounds } from "../sound/snd-sound";
import { onAiAck, onAiDelta, onAiDone, onAiProposal, onAiTool } from "./answer-events";
import { confirmSettings, helloOncePerDay, updateLastTurn } from "./chat-turns";
import { onActionResult, onMascotState, onSuggestionLater, onSuggestionNew } from "./core-events";
import { setHovered, showDone } from "./done-pill";
import { setMood, uiVolume, useDuskie } from "./duskie-state";
import { onAskClose, onAskOpen, onBrowsersChanged, onComposioChanged } from "./panel-events";
import { onVoiceHeard, onVoiceState } from "./voice-events";

export function connect({ sounds }: { sounds: boolean }): () => void {
  let disposed = false;
  const unlisteners: Array<() => void> = [];
  void listen(EVENTS.activityChanged, acceptActivities).then((off) => {
    if (disposed) off();
    else {
      unlisteners.push(off);
      void api
        .activitySnapshot()
        .then((snapshot) => {
          if (!disposed && snapshot) acceptActivities(snapshot);
        })
        .catch(() => {});
    }
  });
  let progressRevision = 0;
  let updateRevision = 0;
  let settingsRevision = 0;
  unlisteners.push(
    useDuskie.subscribe((state, previous) => {
      if (state.updateProgress !== previous.updateProgress) progressRevision++;
      if (state.update !== previous.update) updateRevision++;
    }),
  );
  const loadUpdate = () => {
    const revision = updateRevision;
    void api.updateStatus().then(
      (update) => !disposed && revision === updateRevision && useDuskie.setState({ update }),
      () => {},
    );
  };

  void api.focusStatus().then(
    (f) => !disposed && useDuskie.setState({ focusUntil: f.until }),
    () => {},
  );
  void (async () => {
    const offs = await Promise.all([
      listen(EVENTS.mascotState, (p) => onMascotState(p, sounds)),
      listen(EVENTS.settingsChanged, (settings) => {
        settingsRevision++;
        confirmSettings(settings);
        if (sounds) preloadSounds(settings.soundKit);
        loadUpdate();
        if (!settings.onboarded && !useDuskie.getState().ask) void api.askEnsureWelcome();
      }),
      listen(EVENTS.updateAvailable, (update) => {
        updateRevision++;
        useDuskie.setState({ update });
      }),
      listen(EVENTS.updateProgress, (updateProgress) => {
        progressRevision++;
        useDuskie.setState({ updateProgress });
      }),
      listen(EVENTS.suggestionNew, onSuggestionNew),
      listen(EVENTS.actionResult, (p) => onActionResult(p, sounds)),
      listen(EVENTS.suggestionClear, (id) => {
        if (useDuskie.getState().suggestion?.id === id) {
          useDuskie.setState({ suggestion: null, shiftHeld: false });
        }
      }),
      listen(EVENTS.suggestionLater, (p) => onSuggestionLater(p, sounds)),
      listen(EVENTS.islandHover, setHovered),
      listen(EVENTS.islandShift, (shiftHeld: boolean) => useDuskie.setState({ shiftHeld })),
      listen(EVENTS.islandVisible, (visible) => useDuskie.setState({ visible })),
      listen(EVENTS.islandFullscreen, (fullscreen) => useDuskie.setState({ fullscreen })),
      listen(EVENTS.browsersChanged, () => onBrowsersChanged()),
      listen(EVENTS.composioChanged, onComposioChanged),
      listen(EVENTS.askOpen, onAskOpen),
      listen(EVENTS.askClose, onAskClose),
      listen(EVENTS.voiceState, onVoiceState),
      listen(EVENTS.voiceSpeaking, (speaking) => useDuskie.setState({ speaking })),
      listen(EVENTS.voiceHeard, onVoiceHeard),
      listen(EVENTS.aiDelta, (p) => onAiDelta(p, sounds)),
      listen(EVENTS.connectorsDuplicate, ({ app, used, unused }) =>
        showDone(`${app} is connected through ${[used, ...unused].join(" and ")}. Using the ${used}.`),
      ),
      listen(EVENTS.libraryFound, ({ names }) =>
        showDone(
          names.length === 1
            ? `New skill ${names[0]} found. Add it in Settings, Skills.`
            : `${names.length} new skills found. Add them in Settings, Skills.`,
        ),
      ),
      listen(EVENTS.aiTool, onAiTool),
      listen(EVENTS.aiAck, onAiAck),
      listen(EVENTS.aiProposal, onAiProposal),
      listen(EVENTS.islandFocus, ({ until }) => useDuskie.setState({ focusUntil: until })),
      listen(EVENTS.islandDone, ({ id, text }) => {
        updateLastTurn(id, (t) => ({ ...t, content: text }));
        showDone(text);
      }),
      listen(EVENTS.aiDone, (p) => onAiDone(p, sounds)),
    ]);
    if (disposed) {
      for (const off of offs) off();
      return;
    }
    unlisteners.push(...offs);

    // Recover a download started in another window before this one connected.
    const progressSnapshotRevision = progressRevision;
    void api.updateProgress().then(
      (updateProgress) =>
        !disposed && progressSnapshotRevision === progressRevision && useDuskie.setState({ updateProgress }),
      () => {},
    );
    loadUpdate();

    const settingsSnapshotRevision = settingsRevision;
    const [settings, mascot, suggestion, voiceStatus, later] = await Promise.all([
      api.settingsGet(),
      api.mascotGet(),
      api.suggestionCurrent(),
      api.voiceStatus(),
      api.laterList().catch(() => []),
    ]);
    if (disposed) return;
    if (settingsSnapshotRevision === settingsRevision) confirmSettings(settings);
    useDuskie.setState({ mascot, suggestion, voiceStatus, later: later.length, ready: true });
    if (sounds) preloadSounds(settings.soundKit);
    if (sounds && settings.onboarded) helloOncePerDay();
    // Listeners are live; re-emit welcome if still locked (repairs missed emit).
    if (!settings.onboarded) void api.askEnsureWelcome();
  })();

  const stopNet = watchNet(
    useDuskie.getState,
    (s) => useDuskie.setState(s),
    sounds ? (sound) => playSound(sound, uiVolume(), useDuskie.getState().settings.soundKit) : null,
    () => setMood("happy", 2500),
  );

  return () => {
    disposed = true;
    stopNet();
    for (const off of unlisteners) off();
  };
}
