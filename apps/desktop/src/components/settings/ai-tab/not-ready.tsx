"use client";

// Part of ai-tab: NOT_READY, PROVIDER_HINTS, PROVIDER_SETUP, CLOUD_KEYS, CODING_AGENTS, DragRow, isCloud.

import { Reorder, useDragControls } from "motion/react";
import type { ReactNode } from "react";
import { type AiProviderId, CLOUD_IDS, type CloudId } from "@/lib/types";
import { Tip } from "../../tip";

/** Shown instead of On/Off while a model cannot be used. */
export const NOT_READY: Record<AiProviderId, string> = {
  local: "Not running",
  claude_code: "Not installed",
  codex: "Not installed",
  anthropic: "No key",
  gemini: "No key",
  groq: "No key",
  openrouter: "No key",
  openai: "No key",
  xai: "No key",
};

export const PROVIDER_HINTS: Record<AiProviderId, string> = {
  claude_code: "Your Claude plan, through the claude CLI.",
  codex: "Your ChatGPT plan, through the codex CLI.",
  anthropic: "Pay as you go with ANTHROPIC_API_KEY.",
  local: "Ollama on this PC. Nothing leaves it.",
  gemini: "Free with a Google account. Questions may be used to train Google's models.",
  groq: "Free and fast; takes over when Gemini is busy. Questions may be used for training.",
  openrouter: "One key for hundreds of models, each with its price. Some are free.",
  openai: "Pay as you go with an OpenAI API key.",
  xai: "Pay as you go with an xAI API key.",
};

/** Setup steps shown inside each provider's card, until they are done. */
export const PROVIDER_SETUP: Record<AiProviderId, string[]> = {
  claude_code: ["claude_code", "claude_hooks", "claude_mcp"],
  codex: ["codex", "codex_notify", "codex_mcp"],
  anthropic: ["anthropic"],
  local: ["ollama", "ollama_chat", "ollama_embed", "ollama_vision", "ollama_light"],
  gemini: [],
  groq: [],
  openrouter: [],
  openai: [],
  xai: [],
};

/** Where each cloud provider hands out keys, and its default model. */
export const CLOUD_KEYS: Record<CloudId, { url: string; site: string; model: string }> = {
  gemini: { url: "https://aistudio.google.com/apikey", site: "Google AI Studio", model: "gemini-2.5-flash" },
  groq: { url: "https://console.groq.com/keys", site: "GroqCloud", model: "openai/gpt-oss-120b" },
  openrouter: { url: "https://openrouter.ai/settings/keys", site: "OpenRouter", model: "openrouter/auto" },
  openai: { url: "https://platform.openai.com/api-keys", site: "OpenAI", model: "gpt-5-mini" },
  xai: { url: "https://console.x.ai", site: "xAI", model: "grok-4-fast" },
};

export const CODING_AGENTS: [string, string][] = [
  ["auto", "Higher of Claude Code / Codex in the list above"],
  ["claude_code", "Claude Code"],
  ["codex", "Codex"],
  ["copilot", "GitHub Copilot CLI"],
  ["cursor", "Cursor agent CLI"],
];

/** A provider row you can drag by its handle; arrow keys on the handle move it too. */
export function DragRow({
  value,
  onDrop,
  onStep,
  children,
}: {
  value: AiProviderId;
  onDrop: () => void;
  onStep: (delta: number) => void;
  children: (handle: ReactNode) => ReactNode;
}) {
  const controls = useDragControls();
  const handle = (
    <Tip label="Drag to reorder">
      <button
        type="button"
        aria-label="Drag to reorder, or use the arrow keys"
        onPointerDown={(e) => controls.start(e)}
        onKeyDown={(e) => {
          if (e.key === "ArrowUp" || e.key === "ArrowDown") {
            e.preventDefault();
            onStep(e.key === "ArrowUp" ? -1 : 1);
          }
        }}
        className="chip grid h-8 w-5 shrink-0 cursor-grab touch-none place-items-center rounded-md text-(--muted) hover:text-(--text) active:cursor-grabbing"
      >
        <svg aria-hidden="true" viewBox="0 0 8 14" className="h-3.5 w-2">
          <g fill="currentColor">
            <circle cx="2" cy="2" r="1.2" />
            <circle cx="6" cy="2" r="1.2" />
            <circle cx="2" cy="7" r="1.2" />
            <circle cx="6" cy="7" r="1.2" />
            <circle cx="2" cy="12" r="1.2" />
            <circle cx="6" cy="12" r="1.2" />
          </g>
        </svg>
      </button>
    </Tip>
  );
  return (
    <Reorder.Item
      as="li"
      value={value}
      dragListener={false}
      dragControls={controls}
      onDragEnd={onDrop}
      className="flex flex-col gap-2 rounded-xl bg-(--surface) p-3 ring-1 ring-(--border) ring-inset"
    >
      {children(handle)}
    </Reorder.Item>
  );
}

export function isCloud(id: string): id is CloudId {
  return (CLOUD_IDS as string[]).includes(id);
}
