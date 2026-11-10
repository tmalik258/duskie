// Mock skill library and capability commands.

import type { SkillTarget } from "../types";
import { library, settings } from "./handler";

export const libraryCommands: Record<string, (args: Record<string, unknown>) => unknown> = {
  library_list: () => library.v,
  library_import: (a) => {
    for (const name of (a as { names: string[] }).names)
      if (name === "pdf" && !library.v.some((l) => l.name === name))
        library.v.push({
          name,
          description: "Read and fill PDF forms.",
          origin: "claude",
          hash: "a1",
          hasScripts: false,
          targets: { claude: true, codex: true, local: true },
          synced: { claude: "a1" },
          url: null,
          commit: null,
        });
    return library.v;
  },
  library_set_target: (a) => {
    const { name, target, on } = a as { name: string; target: SkillTarget; on: boolean };
    library.v = library.v.map((l) => (l.name === name ? { ...l, targets: { ...l.targets, [target]: on } } : l));
    return library.v;
  },
  library_remove: (a) => {
    library.v = library.v.filter((l) => l.name !== (a as { name: string }).name);
    return library.v;
  },
  library_fetch_url: (a) => {
    const url = (a as { url: string }).url;
    const had = library.v.find((l) => l.name === "pdf-tools");
    return {
      url,
      commit: had ? "def5678" : "abc1234",
      skills: [
        {
          name: "pdf-tools",
          description: "Fill and split PDFs.",
          files: 2,
          bytes: 2048,
          hasScripts: false,
          status: had ? "changed" : "new",
          diff: had ? ["changed SKILL.md"] : [],
        },
        {
          name: "deploy",
          description: "Ship a build.",
          files: 3,
          bytes: 4096,
          hasScripts: true,
          status: "new",
          diff: [],
        },
      ],
    };
  },
  library_install_fetched: (a) => {
    const { url, commit, names } = a as { url: string; commit: string; names: string[] };
    for (const name of names) {
      library.v = library.v.filter((l) => l.name !== name);
      library.v.push({
        name,
        description: "Added from a link.",
        origin: "url",
        hash: commit,
        hasScripts: name === "deploy",
        targets: { claude: true, codex: true, local: true },
        synced: {},
        url,
        commit,
      });
    }
    return library.v;
  },
  library_sync: () => ({ written: library.v.map((l) => l.name), conflicts: [], backups: [] }),
  skills_list: () => [
    {
      id: "dev.open-in-browser",
      name: "Open dev servers in a browser",
      description: "Mock skill for the browser preview.",
      event: "port.listening",
      enabled: true,
      auto: false,
      autoByDefault: false,
      mutedUntil: null,
    },
    {
      id: "files.screenshot",
      name: "Screenshots",
      description: "Copy text out of a new screenshot.",
      event: "file.created",
      enabled: true,
      auto: true,
      autoByDefault: false,
      mutedUntil: null,
    },
    {
      id: "files.download",
      name: "Finished downloads",
      description: "Open or move a file when it lands.",
      event: "file.created",
      enabled: true,
      auto: false,
      autoByDefault: false,
      mutedUntil: new Date(Date.now() + 3 * 86_400_000).toISOString(),
    },
  ],
  skill_set: () => settings.v,
  capabilities_get: () => ({ found: ["Chrome (mock)"], skillsDir: "-", skillErrors: [] }),
  choices_reset: () => 0,
};
