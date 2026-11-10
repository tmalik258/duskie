// What Enter, arrows, Ctrl Enter and Esc do in the Ask field, and on a row.

import type { KeyboardEvent } from "react";
import { handOff, interruptSession, setTab, useAgents } from "@/lib/agents";
import { api } from "@/lib/bridge";
import { cancelChat, setAskHits, stopListening, useDuskie } from "@/lib/store";
import type { Turn } from "@/lib/types";
import type { Item } from "./item";

export interface InputCtx {
  items: Item[];
  active: number;
  /** Clipboard, search results, or history rows: arrows move, Enter uses it. */
  listLen: number;
  openListItem: (i: number) => void;
  pick: number;
  setPick: (f: (p: number) => number) => void;
  setSelected: (i: number) => void;
  asking: boolean;
  inChat: boolean;
  agent: string | null;
  turns: Turn[];
  text: string;
  focusAndSelectInput: () => void;
  setHandoffError: (e: string | null) => void;
  escape: () => void;
}

export function runRow(c: Pick<InputCtx, "items" | "focusAndSelectInput">, i: number) {
  const item = c.items[i];
  if (!item) return;
  item.run();
  // Keep the draft; select it so the next type replaces it.
  if (!item.keepText) c.focusAndSelectInput();
  if (!item.stay) void api.askClose();
}

/** Same path as Enter: open a list hit, run the active row, or send a follow-up. */
export function submitComposer(c: InputCtx) {
  if (c.listLen) {
    c.openListItem(Math.min(c.pick, c.listLen - 1));
    return;
  }
  if (c.asking && c.inChat) runRow(c, 0);
  else if (c.items.length) runRow(c, c.active);
}

export function onInputKey(c: InputCtx, e: KeyboardEvent<HTMLInputElement>) {
  const rows = c.items.length;
  const { listLen, active } = c;
  if (listLen && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
    e.preventDefault();
    const step = e.key === "ArrowDown" ? 1 : -1;
    c.setPick((p) => (Math.min(p, listLen - 1) + step + listLen) % listLen);
  } else if (listLen && e.key === "Enter" && !e.ctrlKey && !e.metaKey) {
    e.preventDefault();
    c.openListItem(Math.min(c.pick, listLen - 1));
  } else if (e.key === "ArrowDown" && rows) {
    e.preventDefault();
    c.setSelected((active + 1) % rows);
  } else if (e.key === "ArrowUp" && rows) {
    e.preventDefault();
    c.setSelected((active - 1 + rows) % rows);
  } else if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
    e.preventDefault();
    const item = rows ? c.items[active] : undefined;
    if (item?.ctrlRun) {
      item.ctrlRun();
      return;
    }
    // Otherwise: this conversation (and what is typed) goes to the coding agent.
    if (!c.agent) return;
    const messages = c.turns
      .filter((t) => !t.error && t.content.trim())
      .map(({ role, content }) => ({ role, content }));
    if (c.text.trim()) messages.push({ role: "user", content: c.text.trim() });
    if (messages.length === 0) return;
    c.focusAndSelectInput();
    c.setHandoffError(null);
    // It carries on in the Agents tab, step by step.
    void handOff(messages, null).catch((err: unknown) => c.setHandoffError(String(err)));
  } else if (e.key === "Enter") {
    e.preventDefault();
    submitComposer(c);
  } else if (e.key === "Escape") {
    e.preventDefault();
    if (!e.repeat) c.escape();
  }
}

export interface EscCtx {
  agentsTab: boolean;
  openWhere: boolean;
  closeOpenWhere: () => void;
  showHits: boolean;
  inHistory: boolean;
  slash: boolean;
  focusAndSelectInput: () => void;
  resetChat: () => void;
}

export function askEscape(c: EscCtx) {
  if (c.agentsTab) {
    // Esc interrupts the agent that is working; otherwise it closes Ask.
    const { sessions, current } = useAgents.getState();
    const s = sessions.find((x) => x.id === current);
    if (s && (s.status === "working" || s.status === "waiting")) interruptSession(s.id);
    else void api.askClose();
    return;
  }
  if (c.openWhere) {
    c.closeOpenWhere();
    return;
  }
  if (c.showHits) {
    setAskHits(null);
    c.focusAndSelectInput();
    return;
  }
  if (c.inHistory || c.slash) {
    if (c.inHistory) setTab("ask");
    c.focusAndSelectInput();
    return;
  }
  const current = useDuskie.getState();
  // Listening: Esc only stops the mic and leaves the box ready to type in.
  if (current.hearing !== null || current.mascot === "listening") {
    stopListening();
    c.focusAndSelectInput();
    return;
  }
  // Streaming: cancel only, Ctrl+N starts a new chat without aborting.
  if (current.chatId !== null) {
    cancelChat();
    return;
  }
  if (current.turns.length > 0) c.resetChat();
  else void api.askClose();
}
