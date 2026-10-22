// What matches the typed name before a chat starts: apps, commands,
// projects, files, Windows and Duskie settings, past chats, then Search
// and Teach at the end.

import { api } from "@/lib/bridge";
import { openChat, runOpen, setAsk, setAskHits, startSkill, useDuskie } from "@/lib/store";
import type { ChatSummary, InstantResults } from "@/lib/types";
import { Ic } from "../../icon";
import { SETTINGS_TABS } from "../../settings-panel/settings-tabs";
import type { Command } from "../starters/command";
import { appItems } from "./app-items";
import type { OpenHow } from "./file-open";
import { commandItem, type Item } from "./item";
import { windowsCommands } from "./windows-commands";

export interface TypedCtx {
  text: string;
  q: string;
  instant: InstantResults;
  commands: Command[];
  projects: { name: string; path: string }[];
  chats: ChatSummary[];
  openFile: (path: string, how?: OpenHow) => void;
  focusAndSelectInput: () => void;
}

export function typedItems({ text, q, instant, commands, projects, chats, openFile, focusAndSelectInput }: TypedCtx) {
  const items: Item[] = [];
  const named = (group: string, list: Command[]) => {
    for (const [n, c] of list.entries()) items.push({ ...commandItem(c), group: n === 0 ? group : undefined });
  };
  items.push(...appItems(instant.apps));
  named(
    "Commands",
    commands.filter((c) => c.label.toLowerCase().includes(q)),
  );
  for (const [n, p] of projects
    .filter((p) => p.name.toLowerCase().includes(q.replace(/^open\s+/, "")))
    .slice(0, 3)
    .entries()) {
    items.push({
      id: `project:${p.path}`,
      group: n === 0 ? "Projects" : undefined,
      icon: <Ic name="folder" size={12} />,
      label: p.name,
      hint: "Editor and terminal",
      run: () =>
        void runOpen(async () => {
          await api.projectLaunch(p.path);
          return true;
        }, `Opened ${p.name}`),
      keepText: true,
    });
  }
  for (const [n, f] of instant.files.entries()) {
    items.push({
      id: `file:${f.path}`,
      group: n === 0 ? "Files" : undefined,
      icon: <Ic name={f.folder ? "folder" : "file"} size={12} />,
      label: f.name,
      hint: f.place,
      // Enter opens; for files, Ctrl Enter shows the parent folder.
      // Folders are already folders, Enter alone is enough.
      run: () => openFile(f.path),
      ...(f.folder ? {} : { ctrlRun: () => openFile(f.path, "reveal"), ctrlHint: "folder" }),
      stay: true,
      keepText: true,
    });
  }
  named("Windows settings", windowsCommands(q));
  named(
    "Settings",
    SETTINGS_TABS.filter((t) => t.label.toLowerCase().includes(q.replace(/^settings?\s*/, "")))
      .slice(0, 2)
      .map((t) => ({
        id: `settings:${t.id}`,
        label: t.label,
        hint: "Settings",
        icon: "settings" as const,
        run: () => setAsk({ view: "settings", settingsTab: t.id }),
        stay: true,
      })),
  );
  named(
    "Chats",
    chats
      .filter((c) => c.title.toLowerCase().includes(q))
      .slice(0, 2)
      .map((c) => ({
        id: `chat:${c.id}`,
        label: c.title,
        hint: "Past chat",
        icon: "history" as const,
        run: () => void openChat(c.id),
        stay: true,
      })),
  );
  items.push(
    {
      id: "search",
      group: "More",
      icon: <Ic name="spark" size={12} />,
      label: "Search my stuff",
      hint: "Files, pages, chats",
      run: () => {
        const query = text.trim();
        // Show the list at once; results fill in when the search returns.
        setAskHits({ query, items: [], loading: true });
        void api
          .search(query)
          .catch(() => [])
          .then((found) => {
            if (useDuskie.getState().askForm.hits?.query === query) setAskHits({ query, items: found });
          });
        focusAndSelectInput();
      },
      stay: true,
      keepText: true,
    },
    {
      id: "skill",
      icon: <Ic name="gear" size={12} />,
      label: "Teach Duskie a skill",
      run: () => {
        startSkill(text.trim());
        focusAndSelectInput();
      },
      stay: true,
      keepText: true,
    },
  );
  return items;
}
