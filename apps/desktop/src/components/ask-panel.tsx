"use client";

// Ask mode: the island itself becomes the place to run a
// command or ask Duskie, with the app you were in and the clipboard
// attachable on request. Rendered inside the island shell; the island owns
// the morph, this owns the content.

import { useCallback, useEffect, useRef } from "react";
import { type AskTab, activeCount, listenToAgents, setView, useAgents } from "@/lib/agents";
import { api } from "@/lib/bridge";
import { useAltHeld } from "@/lib/hooks";
import {
  setAsk,
  setAskFormText,
  setAskModel,
  startListening,
  stopListening,
  updateSettings,
  useDuskie,
} from "@/lib/store";
import { AgentsTab } from "./agents/agents-tab";
import { Repos } from "./agents/repos";
import { AskBody } from "./ask/panel/ask-body";
import { AskField } from "./ask/panel/ask-field";
import { AskFooter } from "./ask/panel/ask-footer";
import { ChatHead } from "./ask/panel/chat-head";
import { onInputKey, submitComposer } from "./ask/panel/input-handlers";
import { INTENT_PENDING } from "./ask/panel/item";
import { goTab as goTabIn, pickTab as pickTabIn } from "./ask/panel/tabs";
import { useAskPanel } from "./ask/panel/use-ask-panel";
import { ContextLine } from "./ask/starters/command";
import { Timings } from "./ask/timings";
import { LayoutSwitch } from "./layout-switch";
import { PanelShell } from "./panel-shell";
import { nextTab, type PanelTab } from "./panel-tabs";

/** Ask's padding inside the island: top, sides, bottom. */
export const ASK_PAD = { top: 8, x: 10, bottom: 5 } as const;

export function AskPanel() {
  const m = useAskPanel();
  const { ask, s, tab, coder, hearing, streaming, keys } = m;
  const voiceReady = useDuskie((st) => st.settings.voice.enabled && (st.voiceStatus?.listening ?? false));
  const askModel = useDuskie((st) => st.askModel);
  const speak = useDuskie((st) => st.settings.voice.speakAnswers);
  const alt = useAltHeld();
  const working = useAgents((st) => activeCount(st.sessions));
  useEffect(listenToAgents, []);
  const toggleSpeak = useCallback(() => {
    const voice = useDuskie.getState().settings.voice;
    void updateSettings({ voice: { ...voice, speakAnswers: !voice.speakAnswers } });
  }, []);
  // Ask tab only: Ctrl+N starts a fresh chat; leave streams running unbound.
  keys.askTabRef.current = tab === "ask";
  keys.newChatRef.current = () => {
    if (tab !== "ask") return;
    const streamingNow = useDuskie.getState().chatId !== null;
    m.resetChat({ cancel: !streamingNow });
  };

  // Keep Agents mounted while Ask stays open (tab switches), not across Ask close.
  const agentsKept = useRef(tab === "agents");
  if (tab === "agents") agentsKept.current = true;
  const keepAgents = coder && (agentsKept.current || tab === "agents");

  if (!ask) return null;

  // Models that can answer now; the picked one (if still there) goes first.
  const choices = s.providers.filter((p) => p.available && (!ask.localOnly || p.local) && p.id !== "semif");
  const pickedModel = choices.find((p) => p.id === askModel) ?? null;
  const best = pickedModel ?? choices[0];

  const goTab = (next: AskTab) => goTabIn(s, next);
  const pickTab = (next: PanelTab) => pickTabIn(s, tab, next);

  keys.altKeys.current = {
    s: toggleSpeak,
    v: () => (hearing !== null ? stopListening() : voiceReady && !streaming && startListening()),
    p: () => setAsk({ localOnly: !ask.localOnly }),
    h: () => !streaming && goTab(tab === "history" ? "ask" : "history"),
    a: () => tab === "agents" && setView("home"),
    o: () => tab === "agents" && setView("one"),
    b: () => tab === "agents" && setView("board"),
    tab: (back) => pickTab(nextTab(tab, coder, !!back)),
    m: () => {
      if (streaming || choices.length < 2) return;
      // Auto, then each model that can answer now.
      const ids = [null, ...choices.map((c) => c.id)];
      setAskModel(ids[(ids.indexOf(pickedModel?.id ?? null) + 1) % ids.length]);
    },
  };

  // Stable Agents mount across tab switches (hidden when not active). Tab row lives in PanelShell.
  const agentsBody = keepAgents ? (
    <div data-agents-host="" hidden={tab !== "agents"} aria-hidden={tab !== "agents"}>
      <AgentsTab maxHeight={s.scrollMax} active={tab === "agents"} />
    </div>
  ) : null;

  const shell = {
    current: tab as PanelTab,
    onPick: pickTab,
    coder,
    working,
    alt,
    extra: tab === "agents" ? <LayoutSwitch alt={alt} /> : null,
    enter: tab === "agents",
  };

  if (tab === "repos" && coder) {
    return (
      <PanelShell {...shell}>
        {agentsBody}
        <Repos maxHeight={s.scrollMax} />
      </PanelShell>
    );
  }

  if (tab === "agents" && coder) {
    return <PanelShell {...shell}>{agentsBody}</PanelShell>;
  }

  return (
    <PanelShell {...shell} chat={m.showChat}>
      {agentsBody}
      {m.showChat && (
        <ChatHead
          name={s.chatName ?? m.turns.find((t) => t.role === "user")?.content ?? ""}
          onName={s.setChatName}
          inputRef={s.inputRef}
          alt={alt}
          onNewChat={() => m.resetChat({ cancel: !streaming })}
        />
      )}
      {/* Launcher + chat: context, then composer on top, then the scrollable body. */}
      <div className={m.showChat ? "ak-askc" : "contents"}>
        {!m.inHistory && <ContextLine keys={alt} />}
        <AskField
          inputRef={s.inputRef}
          text={m.text}
          hearing={hearing}
          inHistory={m.inHistory}
          inChat={m.inChat}
          showChat={m.showChat}
          streaming={streaming}
          alt={alt}
          assistant={m.assistant}
          speak={speak}
          voiceReady={voiceReady}
          historyKind={s.historyKind}
          choices={choices}
          best={best}
          picked={pickedModel}
          onChange={(value) => {
            setAskFormText(value);
            api.voiceTyping(value.trim() !== "").catch(() => undefined);
            s.setOpenWhere(null);
            s.setSelected(INTENT_PENDING);
            s.setPick(0);
          }}
          onKeyDown={(e) => onInputKey(m.input, e)}
          onHistoryKind={s.setHistoryKind}
          onToggleSpeak={toggleSpeak}
          onNewChat={() => m.resetChat()}
          onSend={() => submitComposer(m.input)}
        />
      </div>
      <AskBody m={m} />
      {s.handoffError && <p className="ak-err">{s.handoffError}</p>}
      <AskFooter
        noAi={!best && !m.firstRun}
        checking={s.providersData === null}
        localOnly={ask.localOnly ?? false}
        alt={alt}
        item={m.items[m.active]}
        asking={m.asking}
        showClips={m.showClips}
        showHits={m.showHits}
        inHistory={m.inHistory}
        inChat={m.inChat}
        agent={m.agent}
        hearing={hearing !== null}
        streaming={streaming}
      />
      <Timings />
    </PanelShell>
  );
}
