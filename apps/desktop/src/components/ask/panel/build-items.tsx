// The rows under the input: starters, then everything that matches by
// name (instant, no AI), then Search and Teach at the end.

import { sendChat, setAskFormText } from "@/lib/store";
import type { Command } from "../starters/command";
import type { OpenHow } from "./file-open";
import { commandItem, type Item } from "./item";
import { openWhereItems } from "./open-where-items";
import { type TypedCtx, typedItems } from "./typed-items";

export interface RowsCtx extends TypedCtx {
  assistant: string;
  asking: boolean;
  slash: boolean;
  inChat: boolean;
  /** Clips, search results, history or the mic own the body: no rows. */
  listOpen: boolean;
  starters: Command[];
  openWhere: { name: string; path: string } | null;
  editorName: string | null;
  closeOpenWhere: () => void;
  showAll: () => void;
}

export function buildItems(c: RowsCtx): Item[] {
  if (c.openWhere) {
    return openWhereItems(c.openWhere, c.editorName, (p, how: OpenHow) => c.openFile(p, how), c.closeOpenWhere);
  }
  if (c.listOpen) return [];
  const items: Item[] = [];
  if (c.asking) {
    // Math answers itself: Enter copies the result.
    const result = c.instant.calc;
    if (!c.inChat && result) {
      items.push({
        id: "calc",
        group: "Calculator",
        icon: <span className="text-[12px] font-bold">=</span>,
        label: result,
        hint: "Enter copies",
        run: () => void navigator.clipboard.writeText(result).catch(() => undefined),
      });
    }
    items.push({
      id: "ask",
      icon: <span className="text-[12px]">✦</span>,
      label: (
        <>
          Ask {c.assistant}: <span className="text-[rgb(235_235_245/0.6)]">“{c.text.trim()}”</span>
        </>
      ),
      run: () => {
        sendChat(c.text.trim());
        // Agent turns clear the field; app/file/folder hits keep the draft.
        setAskFormText("");
        c.focusAndSelectInput();
      },
      stay: true,
      keepText: true,
    });
    if (!c.inChat) items.push(...typedItems(c));
  } else if (c.slash) {
    for (const cmd of c.commands.filter((x) => x.label.toLowerCase().includes(c.q))) items.push(commandItem(cmd));
  } else if (!c.inChat) {
    for (const s of c.starters) items.push(commandItem(s));
    const pause = c.commands.find((x) => x.id === "pause60" || x.id === "resume");
    if (pause)
      items.push(commandItem(pause.id === "pause60" ? { ...pause, label: "Pause suggestions for an hour" } : pause));
    items.push({
      id: "all",
      icon: <span className="text-[11px]">···</span>,
      label: "All commands",
      hint: "Screen, clipboard, mute, settings",
      key: "/",
      run: c.showAll,
      stay: true,
      keepText: true,
    });
  }
  return items;
}
