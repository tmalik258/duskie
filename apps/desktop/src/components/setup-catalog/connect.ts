// Setup rows for connections. Titles mirror apps/desktop/src-tauri/src/setup.rs.

import type { CatalogRow } from "./row";

export const CONNECT_ROWS: CatalogRow[] = [
  {
    id: "claude_hooks",
    group: "connect",
    title: "Claude Code hooks",
    why: "See when it finishes, allow or deny from the island.",
    recommended: true,
  },
  {
    id: "claude_mcp",
    group: "connect",
    title: "Duskie tools in Claude Code",
    why: "Lets Claude Code use Duskie's tools.",
    recommended: false,
  },
  {
    id: "codex_notify",
    group: "connect",
    title: "Codex notifications",
    why: "See when a Codex turn is done.",
    recommended: false,
  },
  {
    id: "codex_mcp",
    group: "connect",
    title: "Duskie tools in Codex",
    why: "Lets Codex use Duskie's tools.",
    recommended: false,
  },
  {
    id: "browser",
    group: "connect",
    title: "Browser extension",
    why: "Page help, tabs and sessions on the island.",
    recommended: true,
  },
  {
    id: "code_folders",
    group: "connect",
    title: "Code folders",
    why: "Project status, the project launcher and the end-of-day check.",
    recommended: true,
  },
  {
    id: "composio",
    group: "connect",
    title: "Composio",
    why: "One sign-in for your calendar, mail, Slack and more.",
    recommended: true,
  },
  {
    id: "search_folders",
    group: "connect",
    title: "Folders to search",
    why: "Search inside your documents and notes from Ask mode.",
    recommended: false,
  },
  {
    id: "voice",
    group: "connect",
    title: "Voice",
    why: 'Say "Duskie" and hear answers. About 205 MB, all on this PC.',
    recommended: false,
  },
];
