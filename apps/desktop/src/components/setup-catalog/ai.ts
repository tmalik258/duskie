// Setup rows for AI providers. Titles mirror apps/desktop/src-tauri/src/setup.rs.

import type { CatalogRow } from "./row";

export const AI_ROWS: CatalogRow[] = [
  {
    id: "claude_code",
    group: "ai",
    title: "Claude Code",
    why: "Uses your Claude plan. Run claude once to sign in.",
    recommended: true,
  },
  {
    id: "codex",
    group: "ai",
    title: "Codex",
    why: "Uses your ChatGPT plan. Run codex once to sign in.",
    recommended: false,
  },
  {
    id: "ollama",
    group: "ai",
    title: "Ollama",
    why: "Free local AI on this PC, and search by meaning.",
    recommended: true,
  },
  {
    id: "ollama_chat",
    group: "ai",
    title: "Local chat model",
    why: "Private answers on this PC, from a model that suits it.",
    recommended: false,
  },
  {
    id: "ollama_embed",
    group: "ai",
    title: "Search model",
    why: "Search by meaning. About 270 MB.",
    recommended: true,
  },
  {
    id: "ollama_vision",
    group: "ai",
    title: "Vision model",
    why: "Reads pictures without text. About 1.7 GB.",
    recommended: false,
  },
  {
    id: "ollama_light",
    group: "ai",
    title: "Lighter Ollama",
    why: "8K context with about half the memory, so answers keep the whole question. Restarts Ollama.",
    recommended: true,
  },
  {
    id: "anthropic",
    group: "ai",
    title: "Anthropic API key",
    why: "Pay as you go. Opens PowerShell with the command ready to paste.",
    recommended: false,
  },
];
