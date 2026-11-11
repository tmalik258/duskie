"use client";

// Ask's local state: the highlighted row, open lists, AI providers, what
// instant find returned, and what every open of Ask resets.

import { useCallback, useEffect, useRef, useState } from "react";
import type { AskTab } from "@/lib/agents";
import { api } from "@/lib/bridge";
import { useCached } from "@/lib/cache";
import { sendChat, setAsk, setAskFormText, useDuskie } from "@/lib/store";
import type { ChatSummary, EditorList, InstantResults, ProviderStatus } from "@/lib/types";
import { markSeen } from "../../island-agents/away-ms";
import type { HistoryKind } from "../history";
import { INTENT_PENDING } from "./item";

/** Input + chips + footer + gaps; scroll area keeps the rest under the Ask cap. */
const ASK_CHROME = 118;
/** Two board tile rows at full size (196 + gap + 196); island window is 640 tall. */
const ASK_SCROLL_CAP = 400;
/** Island window is ~640 tall (tauri.conf); leave room for chrome + pad. */
const ASK_SCROLL_FLOOR = 120;

function askScrollMax(): number {
  const available = window.innerHeight - ASK_CHROME - 40;
  return Math.min(ASK_SCROLL_CAP, Math.max(ASK_SCROLL_FLOOR, available));
}

export function useAskState(tab: AskTab) {
  const text = useDuskie((s) => s.askForm.text);
  const hits = useDuskie((s) => s.askForm.hits);
  const seq = useDuskie((s) => s.ask?.seq);
  // INTENT_PENDING: short names ("loom") highlight the app/file match, not Ask.
  const [selected, setSelected] = useState(INTENT_PENDING);
  const { data: providersData, refresh: refreshProviders } = useCached<ProviderStatus[]>("ai-status", api.aiStatus);
  const providers = providersData ?? [];
  // While nothing is set up yet, keep checking so FirstRun goes away once a
  // provider is configured (e.g. This PC install finished writing settings).
  const anySetUp = providers.some((p) => p.id !== "semif" && p.configured);
  useEffect(() => {
    if (anySetUp || providersData === null) return;
    const id = setInterval(() => void refreshProviders().catch(() => undefined), 3000);
    return () => clearInterval(id);
  }, [anySetUp, providersData, refreshProviders]);
  const [handoffError, setHandoffError] = useState<string | null>(null);
  /** The chat's name when renamed; its first question otherwise. */
  const [chatName, setChatName] = useState<string | null>(null);
  const [clips, setClips] = useState<{ text: string; ts: string }[] | null>(null);
  /** File with no default app: Ask shows where to open it. */
  const [openWhere, setOpenWhere] = useState<{ name: string; path: string } | null>(null);
  const [historyKind, setHistoryKind] = useState<HistoryKind>("all");
  const { data: editors } = useCached<EditorList>("editors", api.editorsList);
  const editorName = editors?.current ?? editors?.editors[0]?.name ?? null;
  // The highlighted clip, search result, or history row, moved with the arrow keys.
  const [pick, setPick] = useState(0);
  // biome-ignore lint/correctness/useExhaustiveDependencies: a new list starts at its top
  useEffect(() => setPick(0), [clips, hits, tab, historyKind, openWhere]);
  const [projects, setProjects] = useState<{ name: string; path: string }[]>([]);
  // Apps and files named like what is typed: no model, answers in a blink.
  const [instant, setInstant] = useState<InstantResults>({ apps: [], files: [] });
  useEffect(() => {
    const q = text.trim();
    if (q.length < 2 || q.startsWith("/") || useDuskie.getState().turns.length > 0) {
      setInstant({ apps: [], files: [] });
      return;
    }
    let live = true;
    const id = setTimeout(() => {
      void api
        .instantFind(q)
        .then((r) => live && setInstant(r))
        .catch(() => undefined);
    }, 60);
    return () => {
      live = false;
      clearTimeout(id);
    };
  }, [text]);
  const [chats, setChats] = useState<ChatSummary[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const [scrollMax, setScrollMax] = useState(ASK_SCROLL_CAP);

  /** Focus the Ask field and select the draft so Enter / reopen can replace it. */
  const focusAndSelectInput = useCallback(() => {
    requestAnimationFrame(() => {
      const el = inputRef.current;
      if (!el) return;
      el.focus({ preventScroll: true });
      el.select();
    });
  }, []);

  useEffect(() => {
    const sync = () => setScrollMax(askScrollMax());
    sync();
    window.addEventListener("resize", sync);
    return () => window.removeEventListener("resize", sync);
  }, []);

  // Every open: restore the draft (or a shortcut prompt), focus + select, refresh AI.
  useEffect(() => {
    if (seq === undefined) return;
    const prompt = useDuskie.getState().ask?.prompt ?? "";
    if (prompt) setAskFormText(prompt);
    markSeen();
    // Reuse intent for leftover draft ("loom" → Loom app), not always row 0 (Ask).
    setSelected(INTENT_PENDING);
    setClips(null);
    setOpenWhere(null);
    setHandoffError(null);
    void refreshProviders().catch(() => undefined);
    void api.projectsList().then(setProjects);
    void api
      .chatsList()
      .then(setChats)
      .catch(() => setChats([]));
    // A shortcut can open Ask mode straight into a tool.
    const tool = useDuskie.getState().ask?.tool;
    if (tool) setAsk({ tool: null });
    if (tool === "clipboard") void api.clipboardHistory().then(setClips);
    if (tool === "screen") {
      sendChat("What's on my screen? Explain it briefly and point out anything I should act on.", { screen: true });
    }
    focusAndSelectInput();
  }, [seq, refreshProviders, focusAndSelectInput]);

  return {
    selected,
    setSelected,
    providers,
    providersData,
    anySetUp,
    handoffError,
    setHandoffError,
    chatName,
    setChatName,
    clips,
    setClips,
    openWhere,
    setOpenWhere,
    historyKind,
    setHistoryKind,
    editorName,
    pick,
    setPick,
    projects,
    instant,
    chats,
    setChats,
    inputRef,
    scrollMax,
    focusAndSelectInput,
  };
}

export type AskState = ReturnType<typeof useAskState>;
