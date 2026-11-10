"use client";

// Everything Ask shows and does, worked out from state each render: which
// body shows, the rows, the active row, and what each key runs.

import { useCallback, useMemo } from "react";
import { useAgents } from "@/lib/agents";
import { api } from "@/lib/bridge";
import { useCached } from "@/lib/cache";
import { newChat, setAskFormText, setAskHits, stopListening, useAssistantName, useDuskie } from "@/lib/store";
import type { CalendarToday } from "@/lib/types";
import { historyRows } from "../history";
import { contextStarters } from "../starters";
import { soonestMeeting } from "../starters/command";
import { useAgentName } from "../use-agent-name";
import { buildItems } from "./build-items";
import { type OpenHow, openFile, openHit } from "./file-open";
import { askEscape, type InputCtx, runRow } from "./input-handlers";
import { INTENT_PENDING, intentRow } from "./item";
import { useAskCommands } from "./use-ask-commands";
import { useAskKeys } from "./use-ask-keys";
import { useAskState } from "./use-ask-state";
import { useChatFollow } from "./use-chat-follow";

export function useAskPanel() {
  const ask = useDuskie((st) => st.ask);
  const turns = useDuskie((st) => st.turns);
  const text = useDuskie((st) => st.askForm.text);
  const hits = useDuskie((st) => st.askForm.hits);
  const hearing = useDuskie((st) => st.hearing);
  const chatPage = useDuskie((st) => st.chatPage);
  const tab = useAgents((st) => st.tab);
  const agentSessions = useAgents((st) => st.sessions);
  // "Do you work with code?" No hides Agents and Repos; unanswered counts as yes.
  const coder = useDuskie((st) => st.settings.codes !== false);
  const assistant = useAssistantName();
  const agent = useAgentName();
  const s = useAskState(tab);
  const { focusAndSelectInput, setSelected, setClips, setOpenWhere, setPick } = s;
  const keys = useAskKeys(s.inputRef);
  const follow = useChatFollow(turns);
  const { data: calendar } = useCached<CalendarToday>("calendar-today", api.calendarToday);
  const starters = useMemo(
    () =>
      contextStarters({
        context: ask?.context ?? null,
        page: chatPage,
        meeting: soonestMeeting(calendar),
        coder,
        // After the row runs, type the prefix in and select it.
        focusInput: (prefix) =>
          requestAnimationFrame(() => {
            setAskFormText(prefix);
            focusAndSelectInput();
          }),
      }),
    [ask?.context, chatPage, calendar, coder, focusAndSelectInput],
  );
  const { nearBottom } = follow;
  const resetChat = useCallback(
    (opts?: { cancel?: boolean }) => {
      if (useDuskie.getState().hearing !== null) stopListening();
      newChat(opts);
      s.setChatName(null);
      setSelected(0);
      setClips(null);
      setOpenWhere(null);
      setPick(0);
      nearBottom.current = true;
      // Keep the Ask draft and search hits; highlight so they are easy to replace.
      focusAndSelectInput();
    },
    [focusAndSelectInput, s.setChatName, setSelected, setClips, setOpenWhere, setPick, nearBottom],
  );
  const commands = useAskCommands(setClips, resetChat);

  const streaming = useDuskie((st) => st.chatId !== null);
  const inHistory = tab === "history";
  // "/" lists every command; what follows filters them.
  const slash = !inHistory && s.clips === null && text.startsWith("/");
  const q = (slash ? text.slice(1) : text).trim().toLowerCase();
  // While clipboard history is open, typing filters it instead of asking.
  const clipFilter = s.clips !== null ? q : "";
  const asking = q.length > 0 && !slash && s.clips === null && !inHistory;
  const shownClips = s.clips?.filter((c) => !clipFilter || c.text.toLowerCase().includes(clipFilter)) ?? [];
  const history = historyRows(s.chats, agentSessions, s.historyKind, inHistory ? q : "", (id) => {
    void api.chatDelete(id).then(() => api.chatsList().then(s.setChats));
  });
  const clearChats = () => {
    void Promise.all(s.chats.map((c) => api.chatDelete(c.id)))
      .then(() => api.chatsList())
      .then(s.setChats);
  };
  // With a conversation going, the body keeps showing it while you type
  // the next question; commands show only before the first one.
  const inChat = turns.length > 0;
  const showClips = s.clips !== null && !inHistory;
  const showHits = hits !== null && !asking && !showClips && !inHistory && !slash;
  const showChat = inChat && !showHits && !showClips && !inHistory && !slash && !(asking && !inChat);

  const open = (path: string, how?: OpenHow) =>
    openFile(path, how, setOpenWhere, {
      noApp: () => {
        s.setHandoffError(null);
        setSelected(0);
      },
      failed: s.setHandoffError,
    });
  const items = buildItems({
    text,
    q,
    instant: s.instant,
    commands,
    projects: s.projects,
    chats: s.chats,
    openFile: open,
    focusAndSelectInput,
    assistant,
    asking,
    slash,
    inChat,
    listOpen: inHistory || showClips || showHits || hearing !== null,
    starters,
    openWhere: s.openWhere,
    editorName: s.editorName,
    closeOpenWhere: () => setOpenWhere(null),
    showAll: () => {
      setAskFormText("/");
      setSelected(0);
      s.inputRef.current?.focus({ preventScroll: true });
    },
  });
  const rows = items.length;
  const intent = intentRow(items, text, asking, s.openWhere !== null);
  const active = Math.min(s.selected === INTENT_PENDING ? intent : s.selected, Math.max(rows - 1, 0));

  // Clipboard, search results, and history: arrows move, Enter uses it.
  const listLen = showClips ? shownClips.length : inHistory ? history.length : showHits && hits ? hits.items.length : 0;
  const openListItem = (i: number) => {
    if (showClips) {
      const c = shownClips[i];
      if (c) void api.clipboardCopy(c.text).then(() => api.askClose());
    } else if (inHistory) {
      history[i]?.open();
    } else if (showHits && hits) {
      const h = hits.items[i];
      if (h) openHit(h.source, h.reference, h.title);
    }
  };
  const escapeAsk = () =>
    askEscape({
      agentsTab: tab === "agents",
      openWhere: s.openWhere !== null,
      closeOpenWhere: () => setOpenWhere(null),
      showHits,
      inHistory,
      slash,
      focusAndSelectInput,
      resetChat: () => resetChat(),
    });
  keys.escRef.current = escapeAsk;
  const input: InputCtx = {
    items,
    active,
    listLen,
    openListItem,
    pick: s.pick,
    setPick,
    setSelected,
    asking,
    inChat,
    agent,
    turns,
    text,
    focusAndSelectInput,
    setHandoffError: s.setHandoffError,
    escape: escapeAsk,
  };
  const closeHits = () => {
    setAskHits(null);
    focusAndSelectInput();
  };
  // First-run card only when nothing is set up yet. If a provider is
  // configured but not running, the footer says so, not this picker.
  const firstRun = !s.anySetUp && s.providersData !== null && !inChat && !asking && !slash && !inHistory && !showClips;

  return {
    ...{ ask, turns, text, hits, hearing, tab, coder, assistant, agent, s, keys, streaming },
    ...{ inHistory, slash, asking, shownClips, clipFilter, history, clearChats, inChat },
    ...{ showClips, showHits, showChat, items, active, input, closeHits, firstRun, resetChat },
    chatRef: follow.chatRef,
    onScroll: follow.onScroll,
    scrollMax: s.scrollMax,
    runRow: (i: number) => runRow(input, i),
  };
}

export type AskPanelModel = ReturnType<typeof useAskPanel>;
