// Moving between Ask's tabs: Ask, Agents, History, Repos and Settings.

import { type AskTab, setTab, showGit } from "@/lib/agents";
import { api } from "@/lib/bridge";
import { setAsk } from "@/lib/store";
import type { PanelTab } from "../../panel-tabs";
import type { AskState } from "./use-ask-state";

export function goTab(s: AskState, next: AskTab) {
  setTab(next);
  s.setPick(0);
  s.setOpenWhere(null);
  if (next === "history") {
    s.setClips(null);
    void api
      .chatsList()
      .then(s.setChats)
      .catch(() => s.setChats([]));
  }
  // Agents focuses its own composer; Ask/History use this input.
  if (next !== "agents") s.focusAndSelectInput();
}

export function pickTab(s: AskState, tab: AskTab, next: PanelTab) {
  return next === "settings"
    ? setAsk({ view: "settings" })
    : next === "repos" && tab !== "repos"
      ? void showGit()
      : goTab(s, next);
}
