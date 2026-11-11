"use client";

// What the composer can suggest: the session's slash commands, and files
// in the project matching what follows an @.

import { useEffect, useState } from "react";
import { type AgentCommand, commandCatalog } from "@/lib/agent-commands";
import type { Session } from "@/lib/agents";
import { api } from "@/lib/bridge";

export function useComposerLists(s: Session, text: string) {
  const [commands, setCommands] = useState<AgentCommand[]>(commandCatalog(s.agent, []));
  const [files, setFiles] = useState<string[]>([]);
  useEffect(() => {
    void api
      .agentCommands(s.id)
      .then((cmds) => setCommands(commandCatalog(s.agent, cmds)))
      .catch(() => setCommands(commandCatalog(s.agent, [])));
  }, [s.id, s.agent]);
  const slash = text.startsWith("/") && !text.includes(" ");
  const mention = /(^|\s)@([^\s@]*)$/.exec(text);
  const query = mention?.[2] ?? null;
  useEffect(() => {
    if (query === null) {
      setFiles([]);
      return;
    }
    let live = true;
    const id = setTimeout(() => {
      void api
        .agentFiles(s.id, query)
        .then((f) => live && setFiles(f))
        .catch(() => undefined);
    }, 80);
    return () => {
      live = false;
      clearTimeout(id);
    };
  }, [query, s.id]);
  const shownCommands = slash ? commands.filter((c) => c.name.startsWith(text.toLowerCase())) : [];
  const count = slash ? shownCommands.length : query !== null ? files.length : 0;
  return { commands, shownCommands, files, slash, mention, query, count };
}
